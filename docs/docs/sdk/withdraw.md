---
sidebar_position: 4
title: Withdraw
---

# Withdraw

Withdrawing tokens exits the shielded pool and releases ERC20 tokens to any EVM address.

## Direct withdrawal

```typescript
import { withdraw, waitForWithdraw } from '@shroud/sdk';

const { tx, changeNote } = await withdraw({
  signer,
  provider,
  poolAddress: "0x91c912eac...",
  inputNote: myNote,
  withdrawAmount: 50n,
  recipient: "0x742d35Cc6...",  // any EVM address
  senderPublicKey: myPk,
  senderPrivateKey: myPrivKey,
  wasmPath: "/withdraw.wasm",
  zkeyPath: "/withdraw_final.zkey",
});
```

## Partial vs full withdrawal

- **Full withdrawal:** `withdrawAmount === inputNote.amount` — no change note created
- **Partial withdrawal:** `withdrawAmount < inputNote.amount` — a change note is created for the remaining balance

## Gasless withdrawal (relay)

```typescript
import { relayMetaWithdraw } from '@shroud/sdk';

const fee = withdrawAmount / 1000n; // 0.1% fee

const result = await relayMetaWithdraw({
  signer,
  provider,
  poolAddress: "0x91c912eac...",
  inputNote: myNote,
  withdrawAmount: 50n,
  recipient: "0x742d35Cc6...",
  senderPublicKey: myPk,
  senderPrivateKey: myPrivKey,
  wasmPath: "/withdraw.wasm",
  zkeyPath: "/withdraw_final.zkey",
  fee,
  metaTxRelayerAddress: "0xF994781eC...",
});
```

### Gasless withdrawal flow

1. SDK generates ZK proof locally
2. User signs EIP-712 typed data (includes proof hash)
3. SDK POSTs to relay API
4. MetaTxRelayer receives tokens (as the withdraw recipient)
5. Redistributes: `(amount - fee)` to actual recipient, `fee` to relay wallet

:::tip
The withdrawal amount is visible on-chain (needed to release ERC20 tokens). For maximum privacy, use different withdrawal amounts than your deposit amounts, and transfer at least once before withdrawing.
:::

## Privacy considerations

| Risk | Mitigation |
|---|---|
| Amount correlation | Use different amounts for deposit/withdraw |
| Timing correlation | Wait between deposit and withdrawal |
| Address linkage | Withdraw to a fresh address |
| Deposit fingerprinting | Use round numbers for deposits |
