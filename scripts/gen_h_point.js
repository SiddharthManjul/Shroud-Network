#!/usr/bin/env node
/**
 * gen_h_point.js
 *
 * Derives the Baby Jubjub generator H = HashToCurve("zktoken_pedersen_h")
 * for use as the second independent base point in Pedersen commitments:
 *   C = v*G + r*H
 *
 * Security requirement: nobody must know log_G(H).
 * This is guaranteed by deriving H from a hash of a public nothing-up-my-sleeve
 * seed string, so no discrete-log relationship to G is known.
 *
 * Algorithm:
 *   1. SHA-256(seed || counter) → 32 bytes → field element y (mod p)
 *   2. Solve x^2 = (1 - y^2) / (a - d*y^2) in GF(p) via Tonelli-Shanks
 *   3. Cofactor-clear: H = 8 * (x, y) to land in the prime-order subgroup
 *   4. Verify H is not the identity and H*ORDER == identity
 *   5. Patch the Hx/Hy values directly into circuits/lib/pedersen.circom
 *
 * Usage:
 *   node scripts/gen_h_point.js
 *
 * No external dependencies — pure Node.js built-ins only.
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// Baby Jubjub curve parameters (twisted Edwards: a*x^2 + y^2 = 1 + d*x^2*y^2)
// Base field: BN254 scalar field
// ---------------------------------------------------------------------------
const p      = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const a      = 168700n;
const d      = 168696n;
const ORDER  = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const COFACTOR = 8n;
const IDENTITY = [0n, 1n]; // neutral element of twisted Edwards group

// ---------------------------------------------------------------------------
// Field arithmetic (all operations mod p)
// ---------------------------------------------------------------------------

const mod = (x) => ((x % p) + p) % p;

function modpow(base, exp) {
    let result = 1n;
    base = mod(base);
    while (exp > 0n) {
        if (exp & 1n) result = mod(result * base);
        exp >>= 1n;
        base = mod(base * base);
    }
    return result;
}

const modInv = (x) => modpow(x, p - 2n); // Fermat's little theorem

/**
 * Tonelli-Shanks modular square root.
 * Returns null if x is not a quadratic residue mod p.
 */
function modSqrt(x) {
    x = mod(x);
    if (x === 0n) return 0n;
    if (modpow(x, (p - 1n) / 2n) !== 1n) return null; // Euler criterion

    // Factor p-1 = Q * 2^S, Q odd
    let Q = p - 1n;
    let S = 0;
    while (Q % 2n === 0n) { Q >>= 1n; S++; }

    if (S === 1) return modpow(x, (p + 1n) / 4n); // p ≡ 3 (mod 4)

    // Find a quadratic non-residue z
    let z = 2n;
    while (modpow(z, (p - 1n) / 2n) !== p - 1n) z++;

    let M = S;
    let c = modpow(z, Q);
    let t = modpow(x, Q);
    let R = modpow(x, (Q + 1n) / 2n);

    for (;;) {
        if (t === 1n) return R;

        // Find smallest i > 0 such that t^(2^i) == 1
        let i = 1;
        let tmp = mod(t * t);
        while (tmp !== 1n) { tmp = mod(tmp * tmp); i++; }

        const b = modpow(c, 1n << BigInt(M - i - 1));
        M = i;
        c = mod(b * b);
        t = mod(t * c);
        R = mod(R * b);
    }
}

// ---------------------------------------------------------------------------
// Baby Jubjub point arithmetic (twisted Edwards unified addition law)
// ---------------------------------------------------------------------------

function pointAdd([x1, y1], [x2, y2]) {
    const x1x2     = mod(x1 * x2);
    const y1y2     = mod(y1 * y2);
    const x1y2     = mod(x1 * y2);
    const y1x2     = mod(y1 * x2);
    const dx1x2y1y2 = mod(d * mod(x1x2 * y1y2));

    const x3 = mod(mod(x1y2 + y1x2) * modInv(mod(1n + dx1x2y1y2)));
    const y3 = mod(mod(y1y2 - mod(a * x1x2)) * modInv(mod(1n - dx1x2y1y2)));
    return [x3, y3];
}

function pointMul(P, k) {
    let R = [...IDENTITY];
    let Q = [...P];
    while (k > 0n) {
        if (k & 1n) R = pointAdd(R, Q);
        Q = pointAdd(Q, Q);
        k >>= 1n;
    }
    return R;
}

const isIdentity  = ([x, y]) => x === IDENTITY[0] && y === IDENTITY[1];
const isOnCurve   = ([x, y]) => {
    const x2 = mod(x * x), y2 = mod(y * y);
    return mod(mod(a * x2) + y2) === mod(1n + mod(d * mod(x2 * y2)));
};

// ---------------------------------------------------------------------------
// HashToCurve — try-and-increment over SHA-256 with a public seed
// ---------------------------------------------------------------------------

function hashToCurve(seed) {
    const seedBuf = Buffer.from(seed, 'utf8');

    for (let counter = 0; counter < 256; counter++) {
        // Hash: SHA-256(seed || counter)
        const hash = crypto.createHash('sha256')
            .update(seedBuf)
            .update(Buffer.from([counter]))
            .digest();

        // Decode 32 bytes as little-endian BigInt, reduce mod p → y candidate
        let y = 0n;
        for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(hash[i]);
        y = mod(y);

        // Solve for x: x^2 = (1 - y^2) / (a - d*y^2)
        const y2  = mod(y * y);
        const num = mod(1n - y2);
        const den = mod(a - mod(d * y2));
        if (den === 0n) continue;

        const x2 = mod(num * modInv(den));
        const x  = modSqrt(x2);
        if (x === null) continue;

        // Cofactor clearing: multiply by 8 to land in the prime-order subgroup
        const H = pointMul([x, y], COFACTOR);
        if (isIdentity(H)) continue;

        // Subgroup check: H * ORDER must equal identity
        if (!isIdentity(pointMul(H, ORDER))) continue;

        return { H, counter };
    }

    throw new Error('HashToCurve failed after 256 attempts — unexpected');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SEED = 'zktoken_pedersen_h';

console.log(`Deriving H = HashToCurve("${SEED}") on Baby Jubjub...\n`);
const { H: [Hx, Hy], counter } = hashToCurve(SEED);

console.log(`Found at counter    = ${counter}`);
console.log(`Hx                  = ${Hx}`);
console.log(`Hy                  = ${Hy}`);
console.log(`On-curve check      : ${isOnCurve([Hx, Hy]) ? 'PASS' : 'FAIL'}`);
console.log(`Subgroup check      : ${isIdentity(pointMul([Hx, Hy], ORDER)) ? 'PASS' : 'FAIL'}`);

// Verify H ≠ G (basic sanity — H must be independent from G)
const Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134n;
const Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905n;
if (Hx === Gx && Hy === Gy) {
    throw new Error('FATAL: H == G — aborting. Adjust seed or counter logic.');
}
console.log(`H ≠ G check         : PASS`);

// Patch circuits/lib/pedersen.circom
const CIRCOM_PATH = path.resolve(__dirname, '../circuits/lib/pedersen.circom');
let src = fs.readFileSync(CIRCOM_PATH, 'utf8');
src = src.replace(/var Hx = \d+;/, `var Hx = ${Hx};`);
src = src.replace(/var Hy = \d+;/, `var Hy = ${Hy};`);
fs.writeFileSync(CIRCOM_PATH, src, 'utf8');

console.log(`\nPatched: circuits/lib/pedersen.circom`);
console.log('Done. Commit pedersen.circom — Hx and Hy are now part of the circuit.');
