// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

/**
 * @title MockToken
 * @dev Minimal ERC20 without SafeERC20 for test isolation.
 */
contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        require(
            allowance[from][msg.sender] >= amount,
            "ERC20: insufficient allowance"
        );
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/**
 * @title MockPoseidon
 * @dev Deterministic stand-in for Poseidon. NOT cryptographically valid;
 *      used only to test contract logic without deploying the real hash.
 */
contract MockPoseidon {
    uint256 internal constant P =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function poseidon(
        uint256[2] calldata inputs
    ) external pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(inputs[0], inputs[1]))) % P;
    }
}

/**
 * @title MockVerifier
 * @dev Configurable verifier that can be switched between always-valid and
 *      always-invalid modes for targeted test cases.
 */
contract MockVerifier is IVerifier {
    bool private _shouldPass;

    constructor(bool shouldPass) {
        _shouldPass = shouldPass;
    }

    function setShouldPass(bool v) external {
        _shouldPass = v;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata
    ) external view returns (bool) {
        return _shouldPass;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// @dev Returns a 256-byte zeroed proof (valid ABI encoding for abi.decode).
function dummyProof() pure returns (bytes memory) {
    return new bytes(256);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

contract ShieldedPoolTest is Test {
    MockToken token;
    MockPoseidon poseidon;
    MockVerifier transferVerifier;
    MockVerifier withdrawVerifier;
    ShieldedPool pool;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant AMOUNT = 1000 ether;
    uint256 constant COMMITMENT_1 = 111;
    uint256 constant COMMITMENT_2 = 222;
    uint256 constant COMMITMENT_3 = 333;
    uint256 constant NULLIFIER = 999;

    function setUp() public {
        token = new MockToken();
        poseidon = new MockPoseidon();
        transferVerifier = new MockVerifier(true); // valid proofs by default
        withdrawVerifier = new MockVerifier(true);

        pool = new ShieldedPool(
            address(token),
            address(transferVerifier),
            address(withdrawVerifier),
            address(poseidon)
        );

        // Fund alice
        token.mint(alice, AMOUNT * 10);
        vm.prank(alice);
        token.approve(address(pool), type(uint256).max);
    }

    // ─── Constructor / immutables ─────────────────────────────────────────────

    function test_constructor_setsImmutables() public view {
        assertEq(address(pool.token()), address(token));
        assertEq(address(pool.transferVerifier()), address(transferVerifier));
        assertEq(address(pool.withdrawVerifier()), address(withdrawVerifier));
    }

    function test_constructor_initialRootIsNonZero() public view {
        assertTrue(pool.getRoot() != 0, "Initial root must be non-zero");
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert("ShieldedPool: zero token");
        new ShieldedPool(
            address(0),
            address(transferVerifier),
            address(withdrawVerifier),
            address(poseidon)
        );
    }

    function test_constructor_revertsOnZeroVerifier() public {
        vm.expectRevert("ShieldedPool: zero transfer verifier");
        new ShieldedPool(
            address(token),
            address(0),
            address(withdrawVerifier),
            address(poseidon)
        );
    }

    // ─── Deposit ─────────────────────────────────────────────────────────────

    function test_deposit_transfersTokens() public {
        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        assertEq(token.balanceOf(alice), balBefore - AMOUNT);
        assertEq(token.balanceOf(address(pool)), AMOUNT);
    }

    function test_deposit_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ShieldedPool.Deposit(COMMITMENT_1, 0, block.timestamp);
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
    }

    function test_deposit_incrementsLeafIndex() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        assertEq(pool.getNextLeafIndex(), 1);
    }

    function test_deposit_changesRoot() public {
        uint256 rootBefore = pool.getRoot();
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        assertTrue(
            pool.getRoot() != rootBefore,
            "Root should change after deposit"
        );
    }

    function test_deposit_revertsOnZeroAmount() public {
        vm.expectRevert("ShieldedPool: zero amount");
        vm.prank(alice);
        pool.deposit(0, COMMITMENT_1);
    }

    function test_deposit_revertsOnZeroCommitment() public {
        vm.expectRevert("ShieldedPool: zero commitment");
        vm.prank(alice);
        pool.deposit(AMOUNT, 0);
    }

    // ─── Transfer ─────────────────────────────────────────────────────────────

    function _depositAndGetRoot() internal returns (uint256 root) {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        root = pool.getRoot();
    }

    function test_transfer_succeeds() public {
        uint256 root = _depositAndGetRoot();
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "memo1",
            "memo2"
        );
        assertTrue(pool.isSpent(NULLIFIER), "Nullifier should be marked spent");
    }

    function test_transfer_insertsNewLeaves() public {
        uint256 root = _depositAndGetRoot();
        uint32 idxBefore = pool.getNextLeafIndex(); // 1 after deposit
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "memo1",
            "memo2"
        );
        assertEq(
            pool.getNextLeafIndex(),
            idxBefore + 2,
            "Two new leaves inserted"
        );
    }

    function test_transfer_emitsEvent() public {
        uint256 root = _depositAndGetRoot();
        vm.expectEmit(false, false, false, true);
        emit ShieldedPool.PrivateTransfer(
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "memo1",
            "memo2"
        );
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "memo1",
            "memo2"
        );
    }

    function test_transfer_revertsOnUnknownRoot() public {
        vm.expectRevert("ShieldedPool: unknown root");
        pool.transfer(
            dummyProof(),
            type(uint256).max,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "",
            ""
        );
    }

    function test_transfer_revertsOnSpentNullifier() public {
        uint256 root = _depositAndGetRoot();
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "",
            ""
        );
        // Second call with same nullifier should revert
        root = pool.getRoot();
        vm.expectRevert("ShieldedPool: note already spent");
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2 + 1,
            COMMITMENT_3 + 1,
            "",
            ""
        );
    }

    function test_transfer_revertsOnInvalidProof() public {
        transferVerifier.setShouldPass(false);
        uint256 root = _depositAndGetRoot();
        vm.expectRevert("ShieldedPool: invalid transfer proof");
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "",
            ""
        );
    }

    function test_transfer_revertsOnZeroCommitment1() public {
        uint256 root = _depositAndGetRoot();
        vm.expectRevert("ShieldedPool: zero commitment1");
        pool.transfer(dummyProof(), root, NULLIFIER, 0, COMMITMENT_3, "", "");
    }

    function test_transfer_revertsOnZeroCommitment2() public {
        uint256 root = _depositAndGetRoot();
        vm.expectRevert("ShieldedPool: zero commitment2");
        pool.transfer(dummyProof(), root, NULLIFIER, COMMITMENT_2, 0, "", "");
    }

    // ─── Withdraw ─────────────────────────────────────────────────────────────

    function test_withdraw_transfersTokensToRecipient() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        uint256 bobBalBefore = token.balanceOf(bob);
        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, bob, "");
        assertEq(token.balanceOf(bob), bobBalBefore + AMOUNT);
    }

    function test_withdraw_marksNullifierSpent() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, bob, "");
        assertTrue(pool.isSpent(NULLIFIER));
    }

    function test_withdraw_withChangeCommitment_insertsLeaf() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();
        uint32 idxBefore = pool.getNextLeafIndex();

        pool.withdraw(
            dummyProof(),
            root,
            NULLIFIER,
            AMOUNT / 2,
            COMMITMENT_2,
            bob,
            "memo"
        );
        assertEq(
            pool.getNextLeafIndex(),
            idxBefore + 1,
            "Change commitment inserted"
        );
    }

    function test_withdraw_withoutChange_doesNotInsertLeaf() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();
        uint32 idxBefore = pool.getNextLeafIndex();

        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, bob, "");
        assertEq(
            pool.getNextLeafIndex(),
            idxBefore,
            "No leaf inserted for full withdrawal"
        );
    }

    function test_withdraw_emitsEvent() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        vm.expectEmit(false, true, false, true);
        emit ShieldedPool.Withdrawal(NULLIFIER, bob, AMOUNT, 0, "");
        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, bob, "");
    }

    function test_withdraw_revertsOnUnknownRoot() public {
        vm.expectRevert("ShieldedPool: unknown root");
        pool.withdraw(
            dummyProof(),
            type(uint256).max,
            NULLIFIER,
            AMOUNT,
            0,
            bob,
            ""
        );
    }

    function test_withdraw_revertsOnSpentNullifier() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        pool.withdraw(
            dummyProof(),
            root,
            NULLIFIER,
            AMOUNT / 2,
            COMMITMENT_2,
            bob,
            ""
        );
        root = pool.getRoot();
        vm.expectRevert("ShieldedPool: note already spent");
        pool.withdraw(
            dummyProof(),
            root,
            NULLIFIER,
            AMOUNT / 2,
            COMMITMENT_3,
            bob,
            ""
        );
    }

    function test_withdraw_revertsOnInvalidProof() public {
        withdrawVerifier.setShouldPass(false);
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        vm.expectRevert("ShieldedPool: invalid withdraw proof");
        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, bob, "");
    }

    function test_withdraw_revertsOnZeroAmount() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        vm.expectRevert("ShieldedPool: zero amount");
        pool.withdraw(dummyProof(), root, NULLIFIER, 0, 0, bob, "");
    }

    function test_withdraw_revertsOnZeroRecipient() public {
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        vm.expectRevert("ShieldedPool: zero recipient");
        pool.withdraw(dummyProof(), root, NULLIFIER, AMOUNT, 0, address(0), "");
    }

    // ─── View functions ───────────────────────────────────────────────────────

    function test_isKnownRoot_returnsTrue() public view {
        uint256 root = pool.getRoot();
        assertTrue(pool.isKnownRoot(root));
    }

    function test_isKnownRoot_returnsFalse_forArbitraryRoot() public view {
        assertFalse(pool.isKnownRoot(type(uint256).max));
    }

    function test_isSpent_returnsFalse_initially() public view {
        assertFalse(pool.isSpent(NULLIFIER));
    }

    // ─── Double-spend prevention (end-to-end) ────────────────────────────────

    function test_doubleSpend_prevention() public {
        // Alice deposits
        vm.prank(alice);
        pool.deposit(AMOUNT, COMMITMENT_1);
        uint256 root = pool.getRoot();

        // First spend: valid transfer
        pool.transfer(
            dummyProof(),
            root,
            NULLIFIER,
            COMMITMENT_2,
            COMMITMENT_3,
            "",
            ""
        );
        root = pool.getRoot();

        // Second spend: same nullifier — MUST revert
        vm.expectRevert("ShieldedPool: note already spent");
        pool.transfer(dummyProof(), root, NULLIFIER, 444, 555, "", "");
    }
}
