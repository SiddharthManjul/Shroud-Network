pragma circom 2.2.2;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/babyjub.circom";
include "../lib/merkle_tree.circom";
include "../lib/pedersen.circom";
include "../lib/nullifier.circom";
include "../lib/range_proof.circom";

//
// UnifiedTransfer
//
// Private transfer inside the Unified Shielded Pool (multi-token).
// Identical to PrivateTransfer except every note now carries an `asset_id`
// field that identifies the token type:
//
//   asset_id = Poseidon(token_address)
//
// The circuit enforces asset type conservation:
//   asset_id_in === asset_id_out_1 === asset_id_out_2
//
// This prevents cross-asset forgery (e.g. spending USDC and outputting WBTC).
// Asset type is a PRIVATE signal — observers cannot determine which token
// is being transferred.
//
// Note commitment (V2):
//   Poseidon(C.x, C.y, secret, nullifier_preimage, owner_pk.x, asset_id)
//   6 inputs → Poseidon t=7
//
// Public inputs (4, same count as V1):
//   [merkle_root, nullifier_hash, new_commitment_1, new_commitment_2]
//
// Constraint estimate: ~10,050 (+50 over V1)
//   Ownership (BabyPbk):             ~700
//   Input PedersenCommit:           ~1,200
//   Note commitment (Poseidon6):      ~300  (+50 vs Poseidon5)
//   Merkle proof (24 × Poseidon2):  ~6,000  (+1,000 for depth 24 vs 20)
//   Nullifier (Poseidon3):            ~250
//   Amount conservation:                ~1
//   Blinding conservation:              ~1
//   Asset type conservation:            ~2  (NEW)
//   Range proofs (2 × 64-bit):        ~256
//   Output PedersenCommit × 2:      ~2,400
//   Output note commits × 2 (P6):    ~600  (+100 vs Poseidon5)
//   Balance check (BabyAdd):            ~6
//
template UnifiedTransfer(depth) {

    // -----------------------------------------------------------------------
    // Public inputs (visible on-chain, passed to Groth16 verifier)
    // -----------------------------------------------------------------------
    signal input merkle_root;       // Merkle tree root the proof is against
    signal input nullifier_hash;    // nullifier of the consumed note
    signal input new_commitment_1;  // output note commitment for recipient
    signal input new_commitment_2;  // output note commitment for change

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
    signal input path_indices[depth];   // 0=left child, 1=right child at each level
    signal input asset_id;              // Poseidon(token_address) — token type

    // -----------------------------------------------------------------------
    // Private inputs — output notes
    // -----------------------------------------------------------------------
    signal input amount_out_1;              // recipient amount (uint64)
    signal input amount_out_2;              // change amount (uint64)
    signal input blinding_out_1;            // recipient Pedersen blinding factor
    signal input blinding_out_2;            // change Pedersen blinding factor
    signal input secret_out_1;              // recipient note secret
    signal input secret_out_2;              // change note secret
    signal input nullifier_preimage_out_1;  // recipient nullifier preimage
    signal input nullifier_preimage_out_2;  // change nullifier preimage
    signal input owner_pk_out_1_x;          // recipient Baby Jubjub pk.x
    signal input owner_pk_out_1_y;          // recipient Baby Jubjub pk.y
    signal input owner_pk_out_2_x;          // sender Baby Jubjub pk.x (change note)
    signal input owner_pk_out_2_y;          // sender Baby Jubjub pk.y
    signal input asset_id_out_1;            // output 1 token type (must match input)
    signal input asset_id_out_2;            // output 2 token type (must match input)

    // -----------------------------------------------------------------------
    // 1. Ownership: derive owner public key from private key
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
    //    Poseidon(6): ~300 constraints | Merkle proof: ~depth*250 constraints
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
    //    nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
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
    amount_in === amount_out_1 + amount_out_2;

    // -----------------------------------------------------------------------
    // 6. Blinding conservation
    //    ~1 constraint
    // -----------------------------------------------------------------------
    blinding_in === blinding_out_1 + blinding_out_2;

    // -----------------------------------------------------------------------
    // 7. Asset type conservation (NEW in unified pool)
    //    All outputs must be the same token as the input.
    //    Prevents cross-asset forgery.
    //    ~2 constraints
    // -----------------------------------------------------------------------
    asset_id === asset_id_out_1;
    asset_id === asset_id_out_2;

    // -----------------------------------------------------------------------
    // 8. Range proofs: output amounts must fit in 64 bits
    //    ~128 constraints each
    // -----------------------------------------------------------------------
    component range1 = RangeProof(64);
    range1.value <== amount_out_1;

    component range2 = RangeProof(64);
    range2.value <== amount_out_2;

    // -----------------------------------------------------------------------
    // 9. Output Pedersen commitments
    //    ~1,200 constraints each
    // -----------------------------------------------------------------------
    component pedersenOut1 = PedersenCommit();
    pedersenOut1.value   <== amount_out_1;
    pedersenOut1.blinding <== blinding_out_1;

    component pedersenOut2 = PedersenCommit();
    pedersenOut2.value   <== amount_out_2;
    pedersenOut2.blinding <== blinding_out_2;

    // -----------------------------------------------------------------------
    // 10. Output note commitment correctness (V2: Poseidon with 6 inputs)
    //     ~300 constraints each
    // -----------------------------------------------------------------------
    component noteOut1 = Poseidon(6);
    noteOut1.inputs[0] <== pedersenOut1.out_x;
    noteOut1.inputs[1] <== pedersenOut1.out_y;
    noteOut1.inputs[2] <== secret_out_1;
    noteOut1.inputs[3] <== nullifier_preimage_out_1;
    noteOut1.inputs[4] <== owner_pk_out_1_x;
    noteOut1.inputs[5] <== asset_id_out_1;
    noteOut1.out === new_commitment_1;

    component noteOut2 = Poseidon(6);
    noteOut2.inputs[0] <== pedersenOut2.out_x;
    noteOut2.inputs[1] <== pedersenOut2.out_y;
    noteOut2.inputs[2] <== secret_out_2;
    noteOut2.inputs[3] <== nullifier_preimage_out_2;
    noteOut2.inputs[4] <== owner_pk_out_2_x;
    noteOut2.inputs[5] <== asset_id_out_2;
    noteOut2.out === new_commitment_2;

    // -----------------------------------------------------------------------
    // 11. In-circuit Pedersen balance check: C_in == C_out1 + C_out2
    //     ~6 constraints
    // -----------------------------------------------------------------------
    component balanceCheck = BabyAdd();
    balanceCheck.x1 <== pedersenOut1.out_x;
    balanceCheck.y1 <== pedersenOut1.out_y;
    balanceCheck.x2 <== pedersenOut2.out_x;
    balanceCheck.y2 <== pedersenOut2.out_y;

    pedersenIn.out_x === balanceCheck.xout;
    pedersenIn.out_y === balanceCheck.yout;
}

component main {public [
    merkle_root,
    nullifier_hash,
    new_commitment_1,
    new_commitment_2
]} = UnifiedTransfer(24);
