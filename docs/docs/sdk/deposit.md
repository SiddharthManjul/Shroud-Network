---
sidebar_position: 2
title: Deposit
---

# Deposit

Depositing tokens moves them from the public EVM world into the shielded pool.

## Direct deposit

The standard deposit requires the user to have AVAX for gas.

```typescript
import { deposit, waitForDeposit } from '@shroud/sdk';

const { tx, pendingNote } = await deposit({
  signer,
  provider,
  poolAddress: "0x91c912eac...",
  tokenAddress: "0xE4e328Fc6...",
  amount: 100n,  // 100 tokens (whole units)
  ownerPublicKey: keypair.publicKey,
});

const note = await waitForDeposit(tx, pendingNote, provider, poolAddress);
```

### Flow

1. SDK generates random: `secret`, `nullifier_preimage`, `blinding`
2. Computes Pedersen commitment: `C = amount * G + blinding * H`
3. Computes note commitment: `Poseidon(C.x, C.y, secret, nullifier_preimage, pk.x)`
4. Approves ERC20 transfer to the pool contract
5. Calls `pool.deposit(amount, noteCommitment)`
6. Contract transfers tokens via `transferFrom`
7. Contract inserts commitment into Merkle tree
8. SDK stores full note data locally

## Gasless deposit (relay)

No AVAX required (after one-time token approval).

```typescript
import { relayDeposit, waitForRelayDeposit } from '@shroud/sdk';

const fee = amount / 1000n; // 0.1% fee

const { relay, pendingNote } = await relayDeposit({
  signer,
  provider,
  poolAddress: "0x91c912eac...",
  tokenAddress: "0xE4e328Fc6...",
  amount: 100n,
  ownerPublicKey: keypair.publicKey,
  fee,
  metaTxRelayerAddress: "0xF994781eC...",
});

const note = await waitForRelayDeposit(relay, pendingNote, provider, poolAddress);
```

### Gasless flow

1. SDK checks token allowance for MetaTxRelayer, approves if needed (one-time gas cost)
2. SDK reads nonce from MetaTxRelayer contract
3. User signs EIP-712 typed data (wallet popup — no gas)
4. SDK POSTs signature + data to relay API
5. Relay wallet submits transaction and pays gas
6. Fee deducted from user's token balance

:::warning
Deposit amounts are visible on-chain because the ERC20 `transferFrom` is a public transaction. Privacy begins after the deposit is complete.
:::
