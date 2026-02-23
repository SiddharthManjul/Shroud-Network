pragma circom 2.2.2;

include "circomlib/circuits/poseidon.circom";

// Derives nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
// Including leaf_index prevents reuse of the same secret+preimage across deposits
template NullifierDeriver() {
    signal input nullifier_preimage;
    signal input secret;
    signal input leaf_index;

    signal output nullifier;

    component hasher = Poseidon(3);
    hasher.inputs[0] <== nullifier_preimage;
    hasher.inputs[1] <== secret;
    hasher.inputs[2] <== leaf_index;

    nullifier <== hasher.out;
}
