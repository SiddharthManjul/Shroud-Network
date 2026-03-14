---
slug: /
sidebar_position: 1
title: Introduction
---

# Shroud Network

**Privacy redefined with zero-knowledge proofs on Avalanche.**

Shroud Network is a shielded pool privacy layer on Avalanche C-Chain. Users mint shielded tokens (zkTokens) against any ERC20 token at a 1:1 ratio. Inside the pool, all transfers are completely private — amounts, senders, and receivers are hidden. Only cryptographic commitments, nullifiers, and ZK proofs are visible on-chain.

## What Shroud Network is NOT

Shroud is **not a mixer**. Unlike Tornado Cash which uses fixed denominations and a deposit-wait-withdraw pattern, Shroud is a **persistent shielded pool** where tokens enter, circulate privately through unlimited transfers, and exit only when the owner decides.

## How it works

```
Public World                    Shielded Pool
─────────────                   ──────────────
ERC20 balance ──── deposit ────→ Commitment (hidden balance)
                                     │
                                     ├── private transfer → New Commitment
                                     ├── private transfer → New Commitment
                                     │
ERC20 balance ◄─── withdraw ───── Commitment consumed
```

**On-chain observers can see:** a new commitment added, an old commitment nullified, a ZK proof verified.

**On-chain observers cannot see:** the amount, who sent it, who received it, or any participant's balance.

## Key properties

| Property | Description |
|---|---|
| **Privacy** | Amounts, senders, and receivers are hidden inside the pool |
| **Self-custody** | Only the note owner can spend their shielded tokens |
| **Verifiable solvency** | Pool total is always public: `sum(deposits) - sum(withdrawals) = contract balance` |
| **Gasless transactions** | Optional relay support — deposit and withdraw without holding AVAX |
| **ERC20 compatible** | Works with any ERC20 token on Avalanche C-Chain |

## Cryptographic stack

- **Pedersen commitments** on Baby Jubjub — amount hiding with homomorphic balance verification
- **Poseidon hashing** — Merkle tree, note commitments, nullifier derivation
- **Groth16 ZK proofs** over BN254 — on-chain verification in ~450K gas

## Network

Shroud Network currently operates on **Avalanche Fuji Testnet** (Chain ID 43113).

- **RPC:** `https://api.avax-test.network/ext/bc/C/rpc`
- **Explorer:** [Snowtrace Testnet](https://testnet.snowtrace.io)

---

Ready to get started? Head to the [Quickstart guide](/getting-started/quickstart).
