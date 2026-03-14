---
sidebar_position: 4
title: ZK Circuits
---

# ZK Circuits

Shroud Network uses two Circom 2.x circuits compiled to Groth16 proofs.

## Transfer Circuit — PrivateTransfer

The transfer circuit proves that a user owns a note, that the note exists in the Merkle tree, and that the output notes have the same total value — all without revealing any private data.

### Public inputs (4 signals, visible on-chain)

| Signal | Description |
|---|---|
| `merkle_root` | Merkle tree root being proven against |
| `nullifier_hash` | Nullifier of consumed input note |
| `new_commitment_1` | Output note commitment for recipient |
| `new_commitment_2` | Output note commitment for change |

### Private inputs (prover only)

- Input note: `amount_in`, `blinding_in`, `secret`, `nullifier_preimage`, `owner_private_key`, `leaf_index`
- Merkle path: `merkle_path[20]`, `path_indices[20]`
- Output note 1: `amount_out_1`, `blinding_out_1`, `secret_out_1`, `nullifier_preimage_out_1`, `owner_pk_out_1`
- Output note 2: `amount_out_2`, `blinding_out_2`, `secret_out_2`, `nullifier_preimage_out_2`, `owner_pk_out_2`

### Constraint groups

| Group | Constraints | What it verifies |
|---|---|---|
| Ownership | ~700 | Derive public key from private key (EscalarMulFix) |
| Input Pedersen | ~1,000-1,400 | `C_in = amount * G + blinding * H` |
| Note commitment | ~250 | `commitment = Poseidon(C.x, C.y, secret, nullifier_preimage, pk.x)` |
| Merkle proof | ~5,000 | 20-level Poseidon hash path from leaf to root |
| Nullifier | ~250 | `nullifier = Poseidon(nullifier_preimage, secret, leaf_index)` |
| Amount conservation | 1 | `amount_in === amount_out_1 + amount_out_2` |
| Blinding conservation | 1 | `blinding_in === blinding_out_1 + blinding_out_2` |
| Range proofs | ~384 | Both outputs fit in 64 bits (Num2Bits) |
| Output Pedersen | ~1,000-1,400 | Both output Pedersen commitments are correct |
| Output commitments | ~500 | Both output note commitments are correct |

**Total: ~25,133 non-linear constraints.** Proof generation takes under 1 second.

### Balance check (in-circuit)

The Pedersen balance check (`C_in == C_out_1 + C_out_2`) is verified inside the circuit using BabyAdd — a Baby Jubjub point addition at ~6 constraints. Pedersen coordinates never appear as public inputs or on-chain calldata.

## Withdraw Circuit — PrivateWithdraw

Similar structure but with key differences:

### Public inputs (4 signals)

| Signal | Description |
|---|---|
| `merkle_root` | Merkle tree root |
| `nullifier_hash` | Nullifier of consumed note |
| `amount` | Withdrawal amount (public — needed to release ERC20) |
| `change_commitment` | Change note commitment (0 if full withdrawal) |

**Total: ~20,858 non-linear constraints.**

## Compilation

```bash
# Compile circuits
circom circuits/transfer.circom --r1cs --wasm --sym \
  --output circuits/build/transfer -l circuits/node_modules

circom circuits/withdraw.circom --r1cs --wasm --sym \
  --output circuits/build/withdraw -l circuits/node_modules
```
