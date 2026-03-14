---
sidebar_position: 3
title: Cryptography
---

# Cryptography

Shroud Network uses three core cryptographic primitives working together.

## Pedersen Commitments (Baby Jubjub)

A Pedersen commitment hides a value while preserving algebraic structure:

```
C = amount * G + blinding * H
```

- **G** — Baby Jubjub generator point (fixed, well-known)
- **H** — independently generated via `HashToCurve("zktoken_pedersen_h")` (nobody knows `log_G(H)`)
- **amount** — the secret value being committed
- **blinding** — random scalar for hiding

### Why Pedersen?

**Additive homomorphism**: `C1 + C2 = (v1+v2)*G + (r1+r2)*H`

This allows the circuit to verify that input amounts equal output amounts by checking that the input Pedersen point equals the EC point sum of output Pedersen points — without revealing any amounts.

### Why Baby Jubjub?

Baby Jubjub is a twisted Edwards curve whose base field is the BN254 scalar field. This means all curve operations are native arithmetic inside BN254 ZK circuits — ~500-700 constraints per scalar multiplication instead of ~5,000.

```
Curve: a*x² + y² = 1 + d*x²*y²
a = 168700, d = 168696
Base field: BN254 scalar field (p ≈ 2^254)
```

:::warning
Baby Jubjub points are NOT BN254 G1 points. The EVM `ecAdd`/`ecMul` precompiles operate on BN254 G1 and cannot be used for Baby Jubjub arithmetic.
:::

## Poseidon Hashing

Poseidon is a ZK-friendly hash function optimized for arithmetic circuits:

- **Merkle tree** nodes: `Poseidon(left, right)` (t=3, 2 inputs)
- **Nullifier**: `Poseidon(nullifier_preimage, secret, leaf_index)` (t=4, 3 inputs)
- **Note commitment**: `Poseidon(C.x, C.y, secret, nullifier_preimage, owner_pk.x)` (t=6, 5 inputs)

Parameters: S-box x^5, 8 full rounds, 57 partial rounds (t=3), BN254 scalar field.

:::danger
On-chain Poseidon MUST use identical parameters to the Circom circuits. Any mismatch means all proofs will fail.
:::

## Groth16 ZK Proofs (BN254)

Groth16 is the proving system:

- **Proof size**: 3 group elements (~128 bytes)
- **Verification**: ~200K gas using BN254 precompiles (ecAdd, ecMul, ecPairing)
- **Proving time**: under 1 second on modern hardware (WASM in browser)
- **Trusted setup**: Required per circuit (powers of tau ceremony + circuit-specific phase 2)

## Note structure

Each private token holding is a "note":

```
Note {
  amount           — token amount (uint64, max ~18.4 × 10^18)
  blinding         — random blinding factor for Pedersen commitment
  secret           — random value known only to owner
  nullifier_preimage — random value for nullifier derivation (never on-chain)
  owner_public_key — Baby Jubjub public key of the note owner
}
```

### Two-layer commitment

**Layer 1 — Pedersen commitment** (EC point, provides homomorphism):
```
pedersen_commitment = amount * G + blinding * H
```

**Layer 2 — Note commitment** (Poseidon hash, goes into Merkle tree):
```
note_commitment = Poseidon(C.x, C.y, secret, nullifier_preimage, owner_pk.x)
```

The Merkle tree needs single field elements as leaves (hence the Poseidon wrap), but we also need Pedersen's algebraic structure for in-circuit balance verification.

## Nullifier derivation

When a note is spent, a nullifier is revealed on-chain:

```
nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
```

- `nullifier_preimage` — random, never appears on-chain
- `secret` — included so guessing nullifier_preimage alone isn't enough
- `leaf_index` — prevents nullifier collision when parameters are reused across deposits

The contract checks: if this nullifier was seen before, reject (double-spend). Otherwise, record it and proceed.
