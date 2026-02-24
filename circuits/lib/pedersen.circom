pragma circom 2.2.2;

include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/bitify.circom";

//
// PedersenCommit
//
// Computes a Pedersen commitment C = v*G + r*H on Baby Jubjub and
// OUTPUTS the resulting EC point coordinates (out_x, out_y).
//
// Callers use the outputs to:
//   - Hash into a note commitment: Poseidon(out_x, out_y, ...)
//   - Verify in-circuit balance: BabyAdd(C_out1, C_out2).out === (C_in.out_x, C_in.out_y)
//
// Baby Jubjub curve (twisted Edwards: a*x^2 + y^2 = 1 + d*x^2*y^2)
//   a = 168700, d = 168696
//   p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
//   subgroup order = 2736030358979909402780800718157159386076813972158567259200215660948447373041
//
// Generator G (from spec):
//   Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134
//   Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905
//
// Generator H = HashToCurve("zktoken_pedersen_h") — computed by scripts/gen_h_point.js
//   On-curve: PASS | In-subgroup: PASS | H ≠ G: PASS
//   Hx = 11991158623290214195992298073348058700477835202184614670606597982489144817024
//   Hy = 21045328185755068580775605509882913360526674377439752325760858626206285218496
//
// IMPORTANT: Baby Jubjub ≠ BN254 G1.
//   The EVM ecAdd precompile (0x06) is for BN254 G1 ONLY and CANNOT verify
//   Baby Jubjub point operations. All balance checks must be done in-circuit.
//
// Constraint estimate: ~1,100–1,400 total
//   EscalarMulFix(64,  G): ~400–500 constraints  (v * G, 64-bit amount)
//   EscalarMulFix(254, H): ~700–900 constraints  (r * H, 254-bit blinding)
//   BabyAdd:               ~6    constraints      (point addition)
//
template PedersenCommit() {
    // --- Inputs ---
    signal input value;    // v: token amount (uint64, fits in 64 bits)
    signal input blinding; // r: blinding factor (254-bit BN254 scalar)

    // --- Outputs ---
    signal output out_x;   // x-coordinate of C = v*G + r*H
    signal output out_y;   // y-coordinate of C = v*G + r*H

    // --- Curve constants ---
    var Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    var Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;
    var Hx = 11991158623290214195992298073348058700477835202184614670606597982489144817024;
    var Hy = 21045328185755068580775605509882913360526674377439752325760858626206285218496;

    // --- v * G : 64-bit fixed-base scalar multiplication ---
    // amount is uint64 — 64 bits is sufficient, saves constraints vs 254
    component bitsV = Num2Bits(64);
    bitsV.in <== value;

    component mulG = EscalarMulFix(64, [Gx, Gy]);
    for (var i = 0; i < 64; i++) {
        mulG.e[i] <== bitsV.out[i];
    }

    // --- r * H : 254-bit fixed-base scalar multiplication ---
    // blinding is a full BN254 scalar (up to 254 bits)
    component bitsR = Num2Bits(254);
    bitsR.in <== blinding;

    component mulH = EscalarMulFix(254, [Hx, Hy]);
    for (var i = 0; i < 254; i++) {
        mulH.e[i] <== bitsR.out[i];
    }

    // --- C = v*G + r*H : Baby Jubjub point addition ---
    component add = BabyAdd();
    add.x1 <== mulG.out[0];
    add.y1 <== mulG.out[1];
    add.x2 <== mulH.out[0];
    add.y2 <== mulH.out[1];

    // --- Output the commitment point ---
    out_x <== add.xout;
    out_y <== add.yout;
}
