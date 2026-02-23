pragma circom 2.2.2;

include "circomlib/circuits/bitify.circom";

// Proves that `value` fits in `n` bits (i.e., 0 <= value < 2^n)
template RangeProof(n) {
    signal input value;

    component bits = Num2Bits(n);
    bits.in <== value;
}
