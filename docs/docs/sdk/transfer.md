---
sidebar_position: 3
title: Transfer
---

# Private Transfer

Transferring tokens inside the shielded pool is completely private — amounts, senders, and receivers are hidden.

## How it works

```typescript
import { transfer, waitForTransfer } from '@shroud/sdk';

const { tx, recipientNote, changeNote } = await transfer({
  signer,
  provider,
  poolAddress: "0x91c912eac...",
  inputNote: myNote,           // note to spend
  transferAmount: 50n,         // amount to send
  recipientPublicKey: bobPk,   // Bob's Baby Jubjub public key
  senderPublicKey: myPk,
  senderPrivateKey: myPrivKey,
  wasmPath: "/transfer.wasm",
  zkeyPath: "/transfer_final.zkey",
});

const { recipient, change } = await waitForTransfer(tx, recipientNote, changeNote, provider, poolAddress);
```

## Transfer flow

1. **Select input note** — choose an unspent note with sufficient balance
2. **Compute outputs:**
   - Recipient note: `amount = transferAmount`
   - Change note: `amount = inputNote.amount - transferAmount`
   - Blinding conservation: `changeBlinding = inputNote.blinding - recipientBlinding`
3. **Generate random values** for both output notes (secrets, nullifier preimages)
4. **Compute commitments** — Pedersen + Poseidon for both outputs
5. **Sync Merkle tree** — fetch events and reconstruct tree locally
6. **Generate Groth16 proof** — snarkjs in browser (~1 second)
7. **Encrypt memos** — ECDH + AES-256-GCM for each recipient
8. **Submit transaction** — proof, nullifier, 2 new commitments, 2 encrypted memos

## What the contract sees

Only 4 public signals from the proof:

| Signal | Contains |
|---|---|
| `merkle_root` | Which tree state the proof is against |
| `nullifier_hash` | Prevents double-spend (unlinkable to note without secret) |
| `new_commitment_1` | Opaque hash — hides amount, recipient, everything |
| `new_commitment_2` | Opaque hash — hides amount, recipient, everything |

The contract verifies the Groth16 proof, marks the nullifier as spent, and inserts both new commitments. It learns nothing about amounts, senders, or receivers.

## Relayed transfer

Transfers can also be submitted via the relay API to avoid linking your EVM address to the transaction:

```typescript
import { relayTransfer } from '@shroud/sdk';

const result = await relayTransfer({
  provider,
  poolAddress: "0x91c912eac...",
  inputNote: myNote,
  transferAmount: 50n,
  recipientPublicKey: bobPk,
  senderPublicKey: myPk,
  senderPrivateKey: myPrivKey,
  wasmPath: "/transfer.wasm",
  zkeyPath: "/transfer_final.zkey",
  relayUrl: "/api/relay",
  paymasterAddress: "0x102C04f39...",
});
```

The relay wallet submits the transaction — your EVM address never appears on-chain.
