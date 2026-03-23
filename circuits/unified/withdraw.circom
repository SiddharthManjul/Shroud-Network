pragma circom 2.2.2;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/babyjub.circom";
include "../lib/merkle_tree.circom";
include "../lib/pedersen.circom";
include "../lib/nullifier.circom";
include "../lib/range_proof.circom";

//
// UnifiedWithdraw
//
// Exit from the Unified Shielded Pool (multi-token).
// Identical to PrivateWithdraw except:
//   1. Notes carry an `asset_id` field
//   2. `asset_id` is a PUBLIC input so the contract can verify which ERC20 to release
//   3. Merkle tree depth is 24 (16M leaves)
//
// The contract computes expected_asset_id = Poseidon(token_address) and checks
// it matches this circuit's public asset_id output. This binds the proof to a
// specific ERC20 token — the prover cannot withdraw USDC using a WBTC note.
//
// Note commitment (V2):
//   Poseidon(C.x, C.y, secret, nullifier_preimage, owner_pk.x, asset_id)
//   6 inputs → Poseidon t=7
//
// Public inputs (5 — one more than V1):
//   [merkle_root, nullifier_hash, amount, change_commitment, asset_id]
//
// Constraint estimate: ~8,100
//   Ownership (BabyPbk):             ~700
//   Input PedersenCommit:           ~1,200
//   Note commitment (Poseidon6):      ~300
//   Merkle proof (24 × Poseidon2):  ~6,000
//   Nullifier (Poseidon3):            ~250
//   Amount + blinding conservation:     ~2
//   Asset type conservation:            ~1  (NEW)
//   Range proofs (2 × 64-bit):        ~256
//   Withdraw PedersenCommit:          ~400
//   Change PedersenCommit:          ~1,200
//   Change note commit (Poseidon6):   ~300
//   Balance check (BabyAdd):            ~6
//
template UnifiedWithdraw(depth) {

    // -----------------------------------------------------------------------
    // Public inputs (visible on-chain)
    // -----------------------------------------------------------------------
    signal input merkle_root;       // Merkle tree root the proof is against
    signal input nullifier_hash;    // nullifier of the consumed note
    signal input amount;            // withdrawal amount (revealed to release ERC20)
    signal input change_commitment; // change note commitment (0 for full withdrawal)
    signal input asset_id;          // Poseidon(token_address) — PUBLIC for contract

    // -----------------------------------------------------------------------
    // Private inputs — input note
    // -----------------------------------------------------------------------
    signal input amount_in;             // uint64 total amount in the note
    signal input blinding_in;           // Pedersen blinding factor
    signal input secret;                // 31-byte secret known only to owner
    signal input nullifier_preimage;    // 31-byte value used to derive nullifier
    signal input owner_private_key;     // sender's Baby Jubjub private key
    signal input leaf_index;            // position of note in Merkle tree
    signal input merkle_path[depth];    // sibling hashes along Merkle path
    signal input path_indices[depth];   // 0=left child, 1=right child at each level

    // -----------------------------------------------------------------------
    // Private inputs — change note (remainder after withdrawal)
    // -----------------------------------------------------------------------
    signal input change_amount;              // uint64 remainder (0 for full withdrawal)
    signal input change_blinding;            // Pedersen blinding for change note
    signal input secret_change;              // change note secret
    signal input nullifier_preimage_change;  // change note nullifier preimage
    signal input owner_pk_change_x;          // sender Baby Jubjub pk.x (change owner)
    signal input asset_id_change;            // change note asset type (must match input)

    // -----------------------------------------------------------------------
    // 1. Ownership
    //    ~700 constraints
    // -----------------------------------------------------------------------
    component ownerPk = BabyPbk();
    ownerPk.in <== owner_private_key;

    // -----------------------------------------------------------------------
    // 2. Input Pedersen commitment: C_in = amount_in*G + blinding_in*H
    //    ~1,200 constraints
    // -----------------------------------------------------------------------
    component pedersenIn = PedersenCommit();
    pedersenIn.value   <== amount_in;
    pedersenIn.blinding <== blinding_in;

    // -----------------------------------------------------------------------
    // 3. Note commitment reconstruction + Merkle inclusion proof
    //    V2: Poseidon(C.x, C.y, secret, nullifier_preimage, owner_pk.x, asset_id)
    //    ~300 + ~6,000 constraints
    // -----------------------------------------------------------------------
    component noteHasher = Poseidon(6);
    noteHasher.inputs[0] <== pedersenIn.out_x;
    noteHasher.inputs[1] <== pedersenIn.out_y;
    noteHasher.inputs[2] <== secret;
    noteHasher.inputs[3] <== nullifier_preimage;
    noteHasher.inputs[4] <== ownerPk.Ax;
    noteHasher.inputs[5] <== asset_id;

    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf <== noteHasher.out;
    for (var i = 0; i < depth; i++) {
        merkleProof.path_elements[i] <== merkle_path[i];
        merkleProof.path_indices[i]  <== path_indices[i];
    }
    merkleProof.root === merkle_root;

    // -----------------------------------------------------------------------
    // 4. Nullifier derivation
    //    ~250 constraints
    // -----------------------------------------------------------------------
    component nullifierComp = NullifierDeriver();
    nullifierComp.nullifier_preimage <== nullifier_preimage;
    nullifierComp.secret             <== secret;
    nullifierComp.leaf_index         <== leaf_index;
    nullifierComp.nullifier === nullifier_hash;

    // -----------------------------------------------------------------------
    // 5. Amount conservation
    //    ~1 constraint
    // -----------------------------------------------------------------------
    amount_in === amount + change_amount;

    // -----------------------------------------------------------------------
    // 6. Blinding conservation
    //    Withdrawal portion has zero blinding (amount is public).
    //    blinding_in = 0 + change_blinding = change_blinding
    //    ~1 constraint
    // -----------------------------------------------------------------------
    blinding_in === change_blinding;

    // -----------------------------------------------------------------------
    // 7. Asset type conservation (NEW in unified pool)
    //    Change note must be the same token as the input.
    //    asset_id is already a public input — contract verifies it matches
    //    the requested ERC20 token address.
    //    ~1 constraint
    // -----------------------------------------------------------------------
    asset_id === asset_id_change;

    // -----------------------------------------------------------------------
    // 8. Range proofs: both amounts must fit in 64 bits
    //    ~128 constraints each
    // -----------------------------------------------------------------------
    component rangeWithdraw = RangeProof(64);
    rangeWithdraw.value <== amount;

    component rangeChange = RangeProof(64);
    rangeChange.value <== change_amount;

    // -----------------------------------------------------------------------
    // 9. Withdrawal Pedersen commitment: C_withdraw = amount*G + 0*H
    //    Zero blinding because the amount is already public.
    //    ~400 constraints
    // -----------------------------------------------------------------------
    component bitsW = Num2Bits(64);
    bitsW.in <== amount;

    var Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    var Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;

    component mulGW = EscalarMulFix(64, [Gx, Gy]);
    for (var i = 0; i < 64; i++) {
        mulGW.e[i] <== bitsW.out[i];
    }

    // -----------------------------------------------------------------------
    // 10. Change Pedersen commitment: C_change = change_amount*G + change_blinding*H
    //     ~1,200 constraints
    // -----------------------------------------------------------------------
    component pedersenChange = PedersenCommit();
    pedersenChange.value   <== change_amount;
    pedersenChange.blinding <== change_blinding;

    // -----------------------------------------------------------------------
    // 11. Change note commitment correctness (V2: Poseidon with 6 inputs)
    //     ~300 constraints
    // -----------------------------------------------------------------------
    component noteChange = Poseidon(6);
    noteChange.inputs[0] <== pedersenChange.out_x;
    noteChange.inputs[1] <== pedersenChange.out_y;
    noteChange.inputs[2] <== secret_change;
    noteChange.inputs[3] <== nullifier_preimage_change;
    noteChange.inputs[4] <== owner_pk_change_x;
    noteChange.inputs[5] <== asset_id_change;
    noteChange.out === change_commitment;

    // -----------------------------------------------------------------------
    // 12. In-circuit Pedersen balance check: C_in == C_withdraw + C_change
    //     ~6 constraints
    // -----------------------------------------------------------------------
    component balanceCheck = BabyAdd();
    balanceCheck.x1 <== mulGW.out[0];
    balanceCheck.y1 <== mulGW.out[1];
    balanceCheck.x2 <== pedersenChange.out_x;
    balanceCheck.y2 <== pedersenChange.out_y;

    pedersenIn.out_x === balanceCheck.xout;
    pedersenIn.out_y === balanceCheck.yout;
}

component main {public [
    merkle_root,
    nullifier_hash,
    amount,
    change_commitment,
    asset_id
]} = UnifiedWithdraw(24);
