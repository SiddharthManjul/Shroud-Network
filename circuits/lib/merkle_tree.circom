pragma circom 2.2.2;

include "circomlib/circuits/poseidon.circom";

// Selects left/right child ordering based on path_index bit.
// s=0: out[0]=current (left), out[1]=sibling (right)
// s=1: out[0]=sibling (left), out[1]=current (right)
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Verifies a Merkle inclusion proof against a known root.
// depth: tree depth (20 for 1M leaves)
// Hash function: Poseidon(t=3, 2 inputs) for internal nodes
//
// path_elements[i] — sibling hash at level i
// path_indices[i]  — 0 if current node is left child, 1 if right child
//
// NOTE: leaf_index is NOT an input here. The path_indices already encode
// the leaf position (they are the bits of leaf_index). leaf_index is only
// needed externally for nullifier derivation.
template MerkleTreeInclusionProof(depth) {
    signal input leaf;
    signal input path_elements[depth];
    signal input path_indices[depth];

    signal output root;

    component mux[depth];
    component hashers[depth];

    signal levelHash[depth + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        mux[i] = DualMux();
        mux[i].in[0] <== levelHash[i];
        mux[i].in[1] <== path_elements[i];
        mux[i].s     <== path_indices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHash[i + 1] <== hashers[i].out;
    }

    root <== levelHash[depth];
}
