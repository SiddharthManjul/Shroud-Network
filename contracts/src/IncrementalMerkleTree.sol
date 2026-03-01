// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PoseidonT3Call} from "./PoseidonT3.sol";

/**
 * @title IncrementalMerkleTree
 * @notice Append-only Poseidon Merkle tree used by ShieldedPool to store note
 *         commitments. Each new leaf is inserted at the next available index.
 *
 * Properties:
 *   - Depth      : 20  →  capacity: 2^20 = 1,048,576 leaves
 *   - Hash fn    : Poseidon(2)  (same parameters as Circom circuits)
 *   - Zero values: zero[0] = 0,  zero[i] = Poseidon(zero[i-1], zero[i-1])
 *   - Insertions : O(depth) — only the path of filled subtrees is updated
 *   - Root history: last ROOT_HISTORY_SIZE roots kept (allows stale proofs)
 *
 * @dev Gas estimate per insertion: ~110,000 (dominated by Poseidon calls).
 *      Merkle path positions are implicit in the leaf index, so no path data
 *      is stored on-chain.
 */
library IncrementalMerkleTree {
    uint256 internal constant DEPTH = 20;
    uint256 internal constant MAX_LEAVES = 2 ** DEPTH; // 1,048,576
    uint32 internal constant ROOT_HISTORY_SIZE = 30;

    struct TreeData {
        uint32 nextIndex;
        uint32 currentRootIndex;
        address poseidon; // deployed Poseidon(2) contract
        uint256[DEPTH] filledSubtrees; // rightmost filled subtree at each level
        uint256[ROOT_HISTORY_SIZE] roots; // circular root history
    }

    // -----------------------------------------------------------------------
    // Pre-computed zero values
    // zero[i] = Poseidon(zero[i-1], zero[i-1])
    // Generated from poseidon-solidity with the canonical circomlibjs params.
    // -----------------------------------------------------------------------
    function _zeros(uint256 i) internal pure returns (uint256) {
        // solhint-disable-next-line no-inline-assembly
        if (i == 0) return 0;
        if (i == 1)
            return
                14744269619966411208579211824598458697587494354926760081771325075741142829156;
        if (i == 2)
            return
                7423237065226347324353380772367382631490014989348495481811164164159255474657;
        if (i == 3)
            return
                11286972368698509976183087595462810875513684078608517520839298933882497716792;
        if (i == 4)
            return
                3607627140608796879659380071776844901612302623152076817094415224584923813162;
        if (i == 5)
            return
                19712377064642672829441595136074946683621277828620209496774504837737984048981;
        if (i == 6)
            return
                20775607673010627194014556968476266066927294572720319469184847051418138353016;
        if (i == 7)
            return
                3396914609616007258851405644437304192397291162432396347162513310381425243293;
        if (i == 8)
            return
                21551820661461729022865262380882070649935529853313286572328683688269863701601;
        if (i == 9)
            return
                6573136701248752079028194407151022595060682063033565181951145966236778420039;
        if (i == 10)
            return
                12413880268183407374852357075976609371175688755676981206018884971008854919922;
        if (i == 11)
            return
                14271763308400718165336499097156975241954733520325982997864342600795471836726;
        if (i == 12)
            return
                20066985985293572387227381049700832219069292839614107140851619262827735677018;
        if (i == 13)
            return
                9394776414966240069580838672673694685292165040808226440647796406499139370960;
        if (i == 14)
            return
                11331146992410411304059858900317123658895005918277453009197229807340014528524;
        if (i == 15)
            return
                15819538789928229930262697811477882737253464456578333862691129291651619515538;
        if (i == 16)
            return
                19217088683336594659449020493828377907203207941212636669271704950158751593251;
        if (i == 17)
            return
                21035245323335827719745544373081896983162834604456827698288649288827293579666;
        if (i == 18)
            return
                6939770416153240137322503476966641397417391950902474480970945462551409848591;
        if (i == 19)
            return
                10941962436777715901943463195175331263348098796018438960955633645115732864202;
        if (i == 20)
            return
                15019797232609675441998260052101280400536945603062888308240081994073687793470;
        revert("IncrementalMerkleTree: depth out of range");
    }

    // -----------------------------------------------------------------------
    // Initialise
    // -----------------------------------------------------------------------
    /**
     * @param self      Storage reference to the tree data
     * @param poseidon  Address of the deployed Poseidon(2) contract
     */
    function init(TreeData storage self, address poseidon) internal {
        require(poseidon != address(0), "IMT: zero poseidon address");
        self.poseidon = poseidon;

        // Seed filled subtrees with zero values so the first insertions are
        // consistent with how circom generates the initial Merkle path.
        for (uint256 i = 0; i < DEPTH; i++) {
            self.filledSubtrees[i] = _zeros(i);
        }

        // Initial root = Poseidon of the all-zero empty tree
        self.roots[0] = _zeros(DEPTH);
        self.nextIndex = 0;
        self.currentRootIndex = 0;
    }

    // -----------------------------------------------------------------------
    // Insert
    // -----------------------------------------------------------------------
    /**
     * @notice Insert a new leaf and update the Merkle root.
     * @param self       Storage reference
     * @param leaf       The note commitment to insert
     * @return index     The leaf index of the inserted commitment
     * @return newRoot   The new Merkle root after insertion
     */
    function insert(
        TreeData storage self,
        uint256 leaf
    ) internal returns (uint32 index, uint256 newRoot) {
        require(self.nextIndex < MAX_LEAVES, "IMT: tree full");

        index = self.nextIndex;
        uint256 currentHash = leaf;
        uint32 currentIndex = index;

        for (uint256 i = 0; i < DEPTH; i++) {
            uint256 left;
            uint256 right;

            if (currentIndex % 2 == 0) {
                // Current node is a left child — store it, right sibling is zero
                left = currentHash;
                right = _zeros(i);
                self.filledSubtrees[i] = currentHash;
            } else {
                // Current node is a right child — left sibling is already stored
                left = self.filledSubtrees[i];
                right = currentHash;
            }

            currentHash = PoseidonT3Call.hash(self.poseidon, left, right);
            currentIndex >>= 1;
        }

        newRoot = currentHash;

        // Advance circular root history
        uint32 newRootIndex = (self.currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        self.currentRootIndex = newRootIndex;
        self.roots[newRootIndex] = newRoot;
        self.nextIndex = index + 1;
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------
    /// @notice Returns the current (latest) Merkle root.
    function getRoot(TreeData storage self) internal view returns (uint256) {
        return self.roots[self.currentRootIndex];
    }

    /// @notice Returns true if `root` is any of the last ROOT_HISTORY_SIZE roots.
    function isKnownRoot(
        TreeData storage self,
        uint256 root
    ) internal view returns (bool) {
        if (root == 0) return false;
        uint32 i = self.currentRootIndex;
        // Walk backwards through the circular buffer
        for (uint32 j = 0; j < ROOT_HISTORY_SIZE; j++) {
            if (self.roots[i] == root) return true;
            if (i == 0) {
                i = ROOT_HISTORY_SIZE - 1;
            } else {
                unchecked {
                    i--;
                }
            }
        }
        return false;
    }
}
