---
sidebar_position: 1
title: SDK Overview
---

# Client SDK

The Shroud Network client SDK is a TypeScript library that handles all client-side operations: key management, note handling, proof generation, and transaction construction.

## Modules

| Module | Purpose |
|---|---|
| **KeyManager** | Baby Jubjub keypair generation, derivation from wallet signature |
| **NoteManager** | Create, store, encrypt, and track notes locally |
| **MerkleTreeSync** | Reconstruct full Merkle tree from on-chain events |
| **ProofGenerator** | Compute witness + Groth16 proof via snarkjs WASM |
| **TransactionBuilder** | Orchestrate full flows: select note → proof → submit |
| **MemoEncryptor** | ECDH on Baby Jubjub + AES-256-GCM for encrypted memos |

## Note structure

```typescript
interface Note {
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
  ownerPublicKey: [bigint, bigint];
  leafIndex: number;
  noteCommitment: bigint;
  pedersenCommitment: [bigint, bigint];
  nullifier: bigint;
  spent: boolean;
  tokenAddress: string;
  createdAtBlock: number;
}
```

## Proof generation

All ZK proofs are generated locally in the browser using snarkjs:

```typescript
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  witness,
  "transfer.wasm",     // WASM witness generator
  "transfer_final.zkey" // proving key
);
```

Proof generation takes under 1 second on modern hardware.

## Encrypted memos

When you transfer tokens, the recipient needs to know their note details. This is communicated via encrypted memos in the transaction calldata:

1. Sender generates an ephemeral Baby Jubjub keypair
2. ECDH shared secret with recipient's public key
3. AES-256-GCM encryption of note data
4. Recipient scans events and trial-decrypts with their private key

If decryption succeeds (GCM auth passes), the note is for them. If it fails, it's for someone else.
