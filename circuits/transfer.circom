pragma circom 2.2.2;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/babyjub.circom";
include "lib/merkle_tree.circom";
include "lib/pedersen.circom";
include "lib/nullifier.circom";
include "lib/range_proof.circom";

//
// PrivateTransfer
//
// Proves a valid private token transfer:
//   - sender owns a note committed in the Merkle tree
//   - the consumed note's Pedersen commitment is correctly formed
//   - the nullifier is correctly derived (prevents double-spend)
//   - two output notes are correctly committed
//   - amount is conserved: amount_in == amount_out_1 + amount_out_2
//   - blinding is conserved: blinding_in == blinding_out_1 + blinding_out_2
//     (so the on-chain Pedersen point check C_in == C_out1 + C_out2 holds)
//   - output amounts are in 64-bit range
//
// Pedersen homomorphic check (C_in == C_out1 + C_out2) is done ON-CHAIN
// via the ecAdd precompile — NOT in this circuit — saving ~2000+ constraints.
//
// Estimated total constraints: ~12,000-15,000
//
template PrivateTransfer(depth) {

    // -----------------------------------------------------------------------
    // Public inputs (visible on-chain)
    // -----------------------------------------------------------------------
    signal input merkle_root;           // Merkle tree root used in proof
    signal input nullifier_hash;        // nullifier of the consumed note
    signal input new_commitment_1;      // output note commitment for recipient
    signal input new_commitment_2;      // output note commitment for change
    signal input input_pedersen_x;      // x-coord of input Pedersen commitment
    signal input input_pedersen_y;      // y-coord of input Pedersen commitment
    signal input output_pedersen_1_x;   // x-coord of output 1 Pedersen commitment
    signal input output_pedersen_1_y;   // y-coord of output 1 Pedersen commitment
    signal input output_pedersen_2_x;   // x-coord of output 2 Pedersen commitment
    signal input output_pedersen_2_y;   // y-coord of output 2 Pedersen commitment

    // -----------------------------------------------------------------------
    // Private inputs — input note
    // -----------------------------------------------------------------------
    signal input amount_in;             // uint64 token amount being spent
    signal input blinding_in;           // Pedersen blinding factor
    signal input secret;                // 31-byte secret known only to owner
    signal input nullifier_preimage;    // 31-byte value used to derive nullifier
    signal input owner_private_key;     // sender's Baby Jubjub private key
    signal input leaf_index;            // position of note in Merkle tree
    signal input merkle_path[depth];    // sibling hashes along the Merkle path
    signal input path_indices[depth];   // 0=left, 1=right at each level

    // -----------------------------------------------------------------------
    // Private inputs — output notes
    // -----------------------------------------------------------------------
    signal input amount_out_1;              // recipient's amount (uint64)
    signal input amount_out_2;              // change amount (uint64)
    signal input blinding_out_1;            // recipient blinding factor
    signal input blinding_out_2;            // change blinding factor
    signal input secret_out_1;              // recipient note secret
    signal input secret_out_2;              // change note secret
    signal input nullifier_preimage_out_1;  // recipient nullifier preimage
    signal input nullifier_preimage_out_2;  // change nullifier preimage
    signal input owner_pk_out_1_x;          // recipient's Baby Jubjub pk.x
    signal input owner_pk_out_1_y;          // recipient's Baby Jubjub pk.y (unused in commitment hash but kept for note validity)
    signal input owner_pk_out_2_x;          // sender's Baby Jubjub pk.x (for change note)
    signal input owner_pk_out_2_y;          // sender's Baby Jubjub pk.y

    // -----------------------------------------------------------------------
    // 1. Ownership: derive owner public key from private key via Baby Jubjub
    //    Verifies sender actually owns the input note
    // -----------------------------------------------------------------------
    component ownerPk = BabyPbk();
    ownerPk.in <== owner_private_key;
    // ownerPk.Ax, ownerPk.Ay = derived public key

    // -----------------------------------------------------------------------
    // 2. Input Pedersen commitment correctness
    //    Proves: input_pedersen = amount_in * G + blinding_in * H
    //    ~1,100-1,400 constraints
    // -----------------------------------------------------------------------
    component pedersenIn = PedersenCommitment();
    pedersenIn.value        <== amount_in;
    pedersenIn.blinding     <== blinding_in;
    pedersenIn.commitment_x <== input_pedersen_x;
    pedersenIn.commitment_y <== input_pedersen_y;

    // -----------------------------------------------------------------------
    // 3. Note commitment reconstruction + Merkle inclusion proof
    //    note_commitment = Poseidon(ped.x, ped.y, secret, nullifier_preimage, owner_pk.x)
    //    ~250 constraints (Poseidon) + ~5,000 constraints (20 Poseidon hashes in tree)
    // -----------------------------------------------------------------------
    component noteHasher = Poseidon(5);
    noteHasher.inputs[0] <== input_pedersen_x;
    noteHasher.inputs[1] <== input_pedersen_y;
    noteHasher.inputs[2] <== secret;
    noteHasher.inputs[3] <== nullifier_preimage;
    noteHasher.inputs[4] <== ownerPk.Ax;

    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf <== noteHasher.out;
    for (var i = 0; i < depth; i++) {
        merkleProof.path_elements[i] <== merkle_path[i];
        merkleProof.path_indices[i]  <== path_indices[i];
    }
    merkleProof.root === merkle_root;

    // -----------------------------------------------------------------------
    // 4. Nullifier derivation
    //    nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
    //    leaf_index is included so same secret+preimage cannot produce the
    //    same nullifier across two different deposits. ~250 constraints.
    // -----------------------------------------------------------------------
    component nullifierComp = NullifierDeriver();
    nullifierComp.nullifier_preimage <== nullifier_preimage;
    nullifierComp.secret             <== secret;
    nullifierComp.leaf_index         <== leaf_index;
    nullifierComp.nullifier === nullifier_hash;

    // -----------------------------------------------------------------------
    // 5. Amount conservation: amount_in == amount_out_1 + amount_out_2
    //    ~1 constraint
    // -----------------------------------------------------------------------
    amount_in === amount_out_1 + amount_out_2;

    // -----------------------------------------------------------------------
    // 6. Blinding conservation: blinding_in == blinding_out_1 + blinding_out_2
    //    Ensures the on-chain Pedersen point check holds:
    //    C_in = amount_in*G + blinding_in*H
    //         = (amount_out_1 + amount_out_2)*G + (blinding_out_1 + blinding_out_2)*H
    //         = C_out_1 + C_out_2  (by additive homomorphism)
    //    ~1 constraint
    // -----------------------------------------------------------------------
    blinding_in === blinding_out_1 + blinding_out_2;

    // -----------------------------------------------------------------------
    // 7. Range proofs: both output amounts must fit in 64 bits
    //    Prevents negative-amount wrap-around attack. ~128 constraints each.
    // -----------------------------------------------------------------------
    component range1 = RangeProof(64);
    range1.value <== amount_out_1;

    component range2 = RangeProof(64);
    range2.value <== amount_out_2;

    // -----------------------------------------------------------------------
    // 8. Output Pedersen commitments correctness
    //    ~1,100-1,400 constraints each (two scalar muls)
    // -----------------------------------------------------------------------
    component pedersenOut1 = PedersenCommitment();
    pedersenOut1.value        <== amount_out_1;
    pedersenOut1.blinding     <== blinding_out_1;
    pedersenOut1.commitment_x <== output_pedersen_1_x;
    pedersenOut1.commitment_y <== output_pedersen_1_y;

    component pedersenOut2 = PedersenCommitment();
    pedersenOut2.value        <== amount_out_2;
    pedersenOut2.blinding     <== blinding_out_2;
    pedersenOut2.commitment_x <== output_pedersen_2_x;
    pedersenOut2.commitment_y <== output_pedersen_2_y;

    // -----------------------------------------------------------------------
    // 9. Output note commitments correctness
    //    new_commitment_i = Poseidon(ped_i.x, ped_i.y, secret_i, nullifier_preimage_i, owner_pk_i.x)
    //    ~250 constraints each
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
