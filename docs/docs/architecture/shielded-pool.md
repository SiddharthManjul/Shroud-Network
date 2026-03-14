---
sidebar_position: 2
title: Shielded Pool
---

# Shielded Pool

The shielded pool is the core privacy primitive — a persistent encrypted balance system where tokens enter, move around privately, and only become visible again when someone exits.

## Shielded pool vs mixer

| | Mixer (Tornado Cash) | Shielded Pool (Shroud) |
|---|---|---|
| **Denomination** | Fixed (0.1, 1, 10, 100 ETH) | Any amount |
| **Pattern** | Deposit → wait → withdraw | Deposit → transfer (N times) → withdraw |
| **Internal transfers** | Not possible | Unlimited private transfers |
| **Privacy source** | Breaking deposit↔withdrawal link | Persistent private balances |
| **Anonymity set** | Users who deposited same denomination | All users of that token |

## How it works

1. **Deposit** — User locks ERC20 tokens and receives a commitment in the Merkle tree
2. **Transfer** — User consumes their note (nullifier) and creates two new notes (recipient + change), verified by ZK proof
3. **Withdraw** — User consumes their note and receives ERC20 tokens at any address

The pool contract holds the ERC20 tokens and maintains:
- A **Merkle tree** of note commitments (append-only, depth 20)
- A **nullifier set** for double-spend prevention
- A **root history** buffer (last 100 roots) for proof freshness tolerance

## Note lifecycle

```
              ┌─────────┐
              │ Deposit  │
              └────┬─────┘
                   │
              ┌────▼─────┐
              │  Note #1  │ (unspent)
              └────┬─────┘
                   │ transfer
              ┌────▼─────┐
         ┌────│  Note #1  │ (spent — nullifier revealed)
         │    └──────────┘
         │
    ┌────▼─────┐    ┌──────────┐
    │  Note #2  │    │  Note #3  │
    │(recipient)│    │ (change)  │
    └────┬─────┘    └────┬─────┘
         │               │
         │          (can transfer again, or withdraw)
    ┌────▼─────┐
    │ Withdraw  │
    └──────────┘
```

## Anonymity set

Privacy is proportional to pool usage. Every user of a given token shares the same anonymity set. If 1,000 users deposited USDC, any transfer could be from any of them.

:::info
For maximum privacy, use round deposit amounts and transfer at least once before withdrawing to a new address.
:::
