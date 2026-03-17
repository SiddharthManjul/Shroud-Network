---
sidebar_position: 1
title: Terminology
---

# Terminology

Key terms used throughout Shroud Network, ordered so each concept builds on the ones before it.

---

## Shielded Pool

A smart contract that holds ERC20 tokens and maintains a private ledger of ownership. Tokens enter via deposit, move around privately via zero-knowledge proofs, and exit via withdrawal. Unlike a mixer, the pool is persistent — tokens can circulate indefinitely inside it.

## Note

A private record of token ownership inside the shielded pool. When you deposit 100 USDC, you receive a **note** worth 100 USDC. Notes are the fundamental unit of value in the pool — think of them as private IOUs that only you can redeem.

Each note contains:

| Field | Purpose |
|---|---|
| **amount** | How many tokens the note is worth |
| **blinding** | Random value that hides the amount cryptographically |
| **secret** | Random value known only to the owner |
| **nullifier preimage** | Random value used to derive the nullifier (never revealed directly) |
| **owner public key** | Baby Jubjub public key of the note owner |

Notes are stored locally in your browser. They can always be recovered by scanning the chain and decrypting encrypted memos.

## Commitment

A cryptographic fingerprint of a note. Commitments are what actually get stored on-chain in the Merkle tree — they reveal nothing about the note's contents (amount, owner, etc.) but uniquely identify it.

Shroud uses a **two-layer commitment scheme**:

1. **Pedersen commitment** — an elliptic curve point: `amount * G + blinding * H`. This hides the amount while allowing mathematical balance verification.
2. **Note commitment** — a Poseidon hash of the Pedersen point plus the note's secret data. This is the single value stored as a Merkle tree leaf.

An observer sees a commitment on-chain but cannot determine the amount, owner, or any other detail.

## Nullifier

A unique tag revealed when a note is spent. The shielded pool contract maintains a set of all seen nullifiers. If a nullifier has already been recorded, the transaction is rejected — this prevents **double-spending**.

```
nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
```

The nullifier is derived from secret values inside the note, so only the note owner can produce it. Crucially, a nullifier cannot be linked back to the commitment it came from — observers see that *some* note was spent but not *which* one.

## Merkle Tree

An append-only data structure that stores all note commitments. Shroud uses a Poseidon-based Merkle tree with depth 20, supporting over 1 million commitments.

When proving ownership of a note, the ZK circuit verifies that the note's commitment exists somewhere in the tree by checking a **Merkle inclusion proof** (also called a Merkle path) — a chain of sibling hashes from the leaf to the root.

The contract stores historical roots (last 100) so that proofs generated against a recent tree state remain valid even if new deposits happen in the meantime.

## Pedersen Commitment

An elliptic curve commitment to a secret value:

```
C = amount * G + blinding * H
```

Where `G` and `H` are independent generator points on the Baby Jubjub curve, and `blinding` is a random factor.

**Key property — additive homomorphism:** given two Pedersen commitments `C1` and `C2`, their sum `C1 + C2` commits to the sum of amounts. This lets the ZK circuit verify that input amounts equal output amounts without revealing any actual values.

## Baby Jubjub

An elliptic curve (twisted Edwards form) whose base field is the BN254 scalar field. This means all Baby Jubjub operations are native arithmetic inside BN254 ZK circuits, making them extremely efficient (~500-700 constraints per scalar multiplication instead of ~5,000).

Shroud uses Baby Jubjub for:
- Pedersen commitments (amount hiding)
- Key pairs (note ownership)
- ECDH key exchange (encrypted memos)

## Poseidon Hash

A hash function designed specifically for ZK circuits. It operates natively over the BN254 scalar field, making it ~100x cheaper in constraints than traditional hashes like SHA-256.

Shroud uses Poseidon for:
- **Merkle tree** nodes (hashing pairs of children)
- **Note commitments** (hashing Pedersen point + secret data)
- **Nullifier derivation** (hashing nullifier preimage + secret + leaf index)

Identical Poseidon parameters must be used on-chain and in circuits — any mismatch means all proofs fail.

## Groth16

A zero-knowledge proof system that produces constant-size proofs (~128 bytes) verifiable in constant time on-chain. Shroud uses Groth16 over the BN254 curve, which maps to Ethereum's precompiled contracts for efficient on-chain verification (~450K gas).

Groth16 requires a **trusted setup** ceremony that generates proving and verification keys. The setup is circuit-specific — separate setups for the transfer and withdraw circuits.

## Zero-Knowledge Proof (ZKP)

A proof that a statement is true without revealing why it's true. In Shroud, ZK proofs demonstrate that:

- The prover owns a valid note in the Merkle tree
- The input and output amounts balance correctly
- The nullifier is correctly derived
- Output amounts are non-negative (range proof)

All of this is proven without revealing amounts, owners, or which note is being spent.

## Encrypted Memo

A ciphertext attached to each transfer, containing the recipient's new note data (amount, blinding, secret, nullifier preimage). Encrypted using ECDH on Baby Jubjub + AES-256-GCM.

The recipient discovers incoming notes by scanning transfer events and attempting to decrypt each memo with their private key. If decryption succeeds (GCM authentication passes), the note is for them.

## Shroud Key (Baby Jubjub Keypair)

Your identity inside the shielded pool. A Baby Jubjub private/public key pair derived deterministically from your email login (via Privy embedded wallet signature).

- **Private key** — used to decrypt memos, sign proofs, derive nullifiers
- **Public key** — used as the "shielded address" that others send to

The same email always produces the same Shroud key.

## Anonymity Set

The set of users whose notes are indistinguishable from yours. If 1,000 users have deposited into the USDC pool, any transfer could be from any of them — the anonymity set is 1,000.

Larger pools = stronger privacy. This is why Shroud uses a single shared pool per token rather than per-user accounts.

## Relay / Paymaster

A service that submits transactions on behalf of users so they don't need to hold AVAX for gas. The relay pays gas and deducts a small fee from the transaction amount inside the ZK circuit.

Using a relay also improves privacy — your IP address and wallet address aren't linked to pool transactions.

## Range Proof

A proof that a value falls within a valid range (0 to 2^64). Without range proofs, an attacker could create a commitment to a negative amount (exploiting field arithmetic wrap-around) and inflate the token supply. Shroud uses 64-bit range proofs via `Num2Bits` decomposition in the circuit.
