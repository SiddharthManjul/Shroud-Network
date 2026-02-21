pragma circom 2.2.2;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "lib/merkle_tree.circom";
include "lib/pedersen.circom";
include "lib/nullifier.circom";
include "lib/range_proof.circom";

// Withdraw circuit
// Similar to PrivateTransfer but:
//   - amount is a PUBLIC input (must be revealed to release ERC20)
//   - one output note (change back to sender)
//   - no recipient output note
//
// Proves:
//   1. Sender owns a valid note in the Merkle tree
//   2. Input Pedersen commitment is correctly formed
//   3. Nullifier is correctly derived
//   4. Withdraw amount + change amount == input amount
//   5. Change Pedersen commitment is correctly formed
//   6. Change note commitment is correctly formed
//   7. Amounts fit in 64 bits
template Withdraw(depth) {
    // -----------------------------------------------------------------------
    // Public inputs
    // -----------------------------------------------------------------------
    signal input merkle_root;
    signal input nullifier_hash;
    signal input amount;                 // withdrawal amount (revealed on-chain)
    signal input input_pedersen_x;
    signal input input_pedersen_y;
    signal input change_pedersen_x;
    signal input change_pedersen_y;
    signal input change_commitment;      // change note commitment

    // -----------------------------------------------------------------------
    // Private inputs — input note
    // -----------------------------------------------------------------------
    signal input amount_in;
    signal input blinding_in;
    signal input secret;
    signal input nullifier_preimage;
    signal input owner_private_key;
    signal input leaf_index;
    signal input merkle_path[depth];
    signal input path_indices[depth];

    // -----------------------------------------------------------------------
    // Private inputs — change note
    // -----------------------------------------------------------------------
    signal input change_amount;
    signal input change_blinding;
    signal input secret_change;
    signal input nullifier_preimage_change;
    signal input owner_pk_change_x;
    signal input owner_pk_change_y;

    // -----------------------------------------------------------------------
    // 1. Ownership
    // -----------------------------------------------------------------------
    component ownerPk = BabyPbk();
    ownerPk.in <== owner_private_key;

    // -----------------------------------------------------------------------
    // 2. Input Pedersen commitment correctness
    // -----------------------------------------------------------------------
    component pedersenIn = PedersenCommitment();
    pedersenIn.value        <== amount_in;
    pedersenIn.blinding     <== blinding_in;
    pedersenIn.commitment_x <== input_pedersen_x;
    pedersenIn.commitment_y <== input_pedersen_y;

    // -----------------------------------------------------------------------
    // 3. Note commitment reconstruction & Merkle inclusion
    // -----------------------------------------------------------------------
    component noteHasher = Poseidon(5);
    noteHasher.inputs[0] <== input_pedersen_x;
    noteHasher.inputs[1] <== input_pedersen_y;
    noteHasher.inputs[2] <== secret;
    noteHasher.inputs[3] <== nullifier_preimage;
    noteHasher.inputs[4] <== ownerPk.Ax;

    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf       <== noteHasher.out;
    merkleProof.leaf_index <== leaf_index;
    for (var i = 0; i < depth; i++) {
        merkleProof.path_elements[i] <== merkle_path[i];
        merkleProof.path_indices[i]  <== path_indices[i];
    }
    merkleProof.root === merkle_root;

    // -----------------------------------------------------------------------
    // 4. Nullifier derivation
    // -----------------------------------------------------------------------
    component nullifierComp = NullifierDeriver();
    nullifierComp.nullifier_preimage <== nullifier_preimage;
    nullifierComp.secret             <== secret;
    nullifierComp.leaf_index         <== leaf_index;
    nullifierComp.nullifier === nullifier_hash;

    // -----------------------------------------------------------------------
    // 5. Amount conservation: amount_in == amount (public) + change_amount
    // -----------------------------------------------------------------------
    amount_in === amount + change_amount;

    // -----------------------------------------------------------------------
    // 6. Blinding conservation
    // -----------------------------------------------------------------------
    blinding_in === change_blinding; // withdraw takes full blinding; change gets remainder 0
    // NOTE: if change_amount == 0 this is a full withdrawal; change note is a zero-value note

    // -----------------------------------------------------------------------
    // 7. Range proofs
    // -----------------------------------------------------------------------
    component rangeWithdraw = RangeProof(64);
    rangeWithdraw.value <== amount;

    component rangeChange = RangeProof(64);
    rangeChange.value <== change_amount;

    // -----------------------------------------------------------------------
    // 8. Change Pedersen commitment correctness
    // -----------------------------------------------------------------------
    component pedersenChange = PedersenCommitment();
    pedersenChange.value        <== change_amount;
    pedersenChange.blinding     <== change_blinding;
    pedersenChange.commitment_x <== change_pedersen_x;
    pedersenChange.commitment_y <== change_pedersen_y;

    // -----------------------------------------------------------------------
    // 9. Change note commitment correctness
    // -----------------------------------------------------------------------
    component noteChange = Poseidon(5);
    noteChange.inputs[0] <== change_pedersen_x;
    noteChange.inputs[1] <== change_pedersen_y;
    noteChange.inputs[2] <== secret_change;
    noteChange.inputs[3] <== nullifier_preimage_change;
    noteChange.inputs[4] <== owner_pk_change_x;
    noteChange.out === change_commitment;
}

component main {public [
    merkle_root,
    nullifier_hash,
    amount,
    input_pedersen_x,
    input_pedersen_y,
    change_pedersen_x,
    change_pedersen_y,
    change_commitment
]} = Withdraw(20);
