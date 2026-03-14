---
sidebar_position: 2
title: Privacy Guarantees
---

# Privacy Guarantees

A detailed breakdown of what is private and what is public at each stage.

## Deposit (entering the pool)

| Data | Visibility |
|---|---|
| Depositor address | Public (sends ERC20 `approve` + `deposit` tx) |
| Deposit amount | Public (ERC20 `transferFrom` amount is visible) |
| Note commitment | Public (stored in Merkle tree) |
| Note secret | Private (only depositor knows) |
| Nullifier preimage | Private (only depositor knows) |
| Blinding factor | Private (only depositor knows) |
| Pedersen commitment | Private (computed client-side, never sent on-chain) |

## Private transfer (inside the pool)

| Data | Visibility |
|---|---|
| Transfer amount | Private (hidden by Pedersen commitment) |
| Sender identity | Private (hidden in anonymity set) |
| Receiver identity | Private (only receiver can decrypt memo) |
| Input nullifier | Public (but unlinkable to note without secret) |
| Output commitments | Public (opaque hashes) |
| Encrypted memos | Public (ciphertext only, AES-256-GCM encrypted) |
| ZK proof | Public (but reveals nothing about private inputs) |
| Merkle root | Public (which tree state the proof is against) |

## Withdrawal (exiting the pool)

| Data | Visibility |
|---|---|
| Withdrawal amount | Public (needed to release ERC20 tokens) |
| Recipient address | Public (receives the ERC20 tokens) |
| Input nullifier | Public (but unlinkable to note) |
| Change commitment | Public (if partial withdrawal) |
| Withdrawer identity | Private (if using relay) or Public (if direct tx) |

## What links can be established?

### Without additional information
An observer can see:
- Someone deposited X tokens at time T1
- A nullifier was spent at time T2
- Two new commitments were created at time T2
- Someone withdrew Y tokens to address Z at time T3

They **cannot** establish:
- Which deposit corresponds to which nullifier
- Which commitment was spent in which transfer
- Who the sender or receiver of a private transfer is
- Individual balances within the pool

### With timing/amount analysis
If the pool has very few users, an observer might correlate:
- Deposits and withdrawals of the same unusual amount
- Transactions that happen in quick succession
- Patterns of activity from a single IP (if not using VPN/Tor)

## Maximizing privacy

1. **Use round deposit amounts** — 100, 500, 1000 instead of 847.32
2. **Transfer before withdrawing** — break the deposit→withdraw link
3. **Withdraw to a fresh address** — don't reuse your deposit address
4. **Use the relay** — your EVM address never appears on-chain
5. **Wait between operations** — avoid timing correlation
6. **Encourage pool usage** — larger anonymity set = stronger privacy
