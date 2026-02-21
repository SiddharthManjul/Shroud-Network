pragma circom 2.2.2;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "lib/merkle_tree.circom";
include "lib/pedersen.circom";
include "lib/nullifier.circom";
include "lib/range_proof.circom";

// PrivateTransfer circuit
// Estimated constraints: ~12,000–15,000
//
// Proves:
//   1. Sender owns a note in the Merkle tree (ownership + inclusion proof)
//   2. Input Pedersen commitment is correctly formed
//   3. Nullifier is correctly derived
//   4. Output Pedersen commitments are correctly formed
//   5. Output note commitments are correctly formed
//   6. Amount is conserved: amount_in == amount_out_1 + amount_out_2
//   7. Blinding is conserved: blinding_in == blinding_out_1 + blinding_out_2
//   8. Output amounts fit in 64 bits (range proofs)
template PrivateTransfer(depth) {
    // -----------------------------------------------------------------------
    // Public inputs
    // -----------------------------------------------------------------------
    signal input merkle_root;
    signal input nullifier_hash;
    signal input new_commitment_1;
    signal input new_commitment_2;
    signal input input_pedersen_x;
    signal input input_pedersen_y;
    signal input output_pedersen_1_x;
    signal input output_pedersen_1_y;
    signal input output_pedersen_2_x;
    signal input output_pedersen_2_y;

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
    // Private inputs — output notes
    // -----------------------------------------------------------------------
    signal input amount_out_1;
    signal input amount_out_2;
    signal input blinding_out_1;
    signal input blinding_out_2;
    signal input secret_out_1;
    signal input secret_out_2;
    signal input nullifier_preimage_out_1;
    signal input nullifier_preimage_out_2;
    signal input owner_pk_out_1_x;
    signal input owner_pk_out_1_y;
    signal input owner_pk_out_2_x;
    signal input owner_pk_out_2_y;

    // -----------------------------------------------------------------------
    // 1. Ownership: derive owner public key from private key
    // -----------------------------------------------------------------------
    component ownerPk = BabyPbk();
    ownerPk.in <== owner_private_key;
    // owner_pk = (ownerPk.Ax, ownerPk.Ay)

    // -----------------------------------------------------------------------
    // 2. Input Pedersen commitment correctness: C_in = amount_in*G + blinding_in*H
    // -----------------------------------------------------------------------
    component pedersenIn = PedersenCommitment();
    pedersenIn.value    <== amount_in;
    pedersenIn.blinding <== blinding_in;
    pedersenIn.commitment_x <== input_pedersen_x;
    pedersenIn.commitment_y <== input_pedersen_y;

    // -----------------------------------------------------------------------
    // 3. Note commitment reconstruction & Merkle inclusion proof
    //    note_commitment = Poseidon(pedersen_x, pedersen_y, secret, nullifier_preimage, owner_pk.x)
    // -----------------------------------------------------------------------
    component noteHasher = Poseidon(5);
    noteHasher.inputs[0] <== input_pedersen_x;
    noteHasher.inputs[1] <== input_pedersen_y;
    noteHasher.inputs[2] <== secret;
    noteHasher.inputs[3] <== nullifier_preimage;
    noteHasher.inputs[4] <== ownerPk.Ax;

    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf          <== noteHasher.out;
    merkleProof.leaf_index    <== leaf_index;
    for (var i = 0; i < depth; i++) {
        merkleProof.path_elements[i] <== merkle_path[i];
        merkleProof.path_indices[i]  <== path_indices[i];
    }
    merkleProof.root === merkle_root;

    // -----------------------------------------------------------------------
    // 4. Nullifier derivation: nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
    // -----------------------------------------------------------------------
    component nullifierComp = NullifierDeriver();
    nullifierComp.nullifier_preimage <== nullifier_preimage;
    nullifierComp.secret             <== secret;
    nullifierComp.leaf_index         <== leaf_index;
    nullifierComp.nullifier === nullifier_hash;

    // -----------------------------------------------------------------------
    // 5. Amount conservation
    // -----------------------------------------------------------------------
    amount_in === amount_out_1 + amount_out_2;

    // -----------------------------------------------------------------------
    // 6. Blinding conservation (ensures on-chain Pedersen homomorphic check works)
    // -----------------------------------------------------------------------
    blinding_in === blinding_out_1 + blinding_out_2;

    // -----------------------------------------------------------------------
    // 7. Range proofs: output amounts must fit in 64 bits
    // -----------------------------------------------------------------------
    component range1 = RangeProof(64);
    range1.value <== amount_out_1;

    component range2 = RangeProof(64);
    range2.value <== amount_out_2;

    // -----------------------------------------------------------------------
    // 8. Output Pedersen commitment correctness
    // -----------------------------------------------------------------------
    component pedersenOut1 = PedersenCommitment();
    pedersenOut1.value       <== amount_out_1;
    pedersenOut1.blinding    <== blinding_out_1;
    pedersenOut1.commitment_x <== output_pedersen_1_x;
    pedersenOut1.commitment_y <== output_pedersen_1_y;

    component pedersenOut2 = PedersenCommitment();
    pedersenOut2.value       <== amount_out_2;
    pedersenOut2.blinding    <== blinding_out_2;
    pedersenOut2.commitment_x <== output_pedersen_2_x;
    pedersenOut2.commitment_y <== output_pedersen_2_y;

    // -----------------------------------------------------------------------
    // 9. Output note commitment correctness
    //    new_commitment_i = Poseidon(ped_i.x, ped_i.y, secret_i, nullifier_preimage_i, owner_pk_i.x)
    // -----------------------------------------------------------------------
    component noteOut1 = Poseidon(5);
    noteOut1.inputs[0] <== output_pedersen_1_x;
    noteOut1.inputs[1] <== output_pedersen_1_y;
    noteOut1.inputs[2] <== secret_out_1;
    noteOut1.inputs[3] <== nullifier_preimage_out_1;
    noteOut1.inputs[4] <== owner_pk_out_1_x;
    noteOut1.out === new_commitment_1;

    component noteOut2 = Poseidon(5);
    noteOut2.inputs[0] <== output_pedersen_2_x;
    noteOut2.inputs[1] <== output_pedersen_2_y;
    noteOut2.inputs[2] <== secret_out_2;
    noteOut2.inputs[3] <== nullifier_preimage_out_2;
    noteOut2.inputs[4] <== owner_pk_out_2_x;
    noteOut2.out === new_commitment_2;
}

component main {public [
    merkle_root,
    nullifier_hash,
    new_commitment_1,
    new_commitment_2,
    input_pedersen_x,
    input_pedersen_y,
    output_pedersen_1_x,
    output_pedersen_1_y,
    output_pedersen_2_x,
    output_pedersen_2_y
]} = PrivateTransfer(20);
