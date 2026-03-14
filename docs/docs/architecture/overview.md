---
sidebar_position: 1
title: Overview
---

# Architecture Overview

Shroud Network consists of three layers that work together to provide privacy.

## System layers

```
┌──────────────────────────────────────────────────────────┐
│  Client SDK (TypeScript)                                 │
│  Note management, proof generation, encrypted memos      │
├──────────────────────────────────────────────────────────┤
│  ZK Circuits (Circom 2.x)                                │
│  Transfer circuit, withdraw circuit, Groth16 proofs      │
├──────────────────────────────────────────────────────────┤
│  Smart Contracts (Solidity/EVM)                          │
│  ShieldedPool, Merkle tree, nullifier registry, verifier │
└──────────────────────────────────────────────────────────┘
                        │
                  Avalanche C-Chain
```

### 1. Smart Contracts

On-chain logic that manages the shielded pool:
- **ShieldedPool** — deposits, transfers, withdrawals, commitment Merkle tree, nullifier registry
- **Groth16Verifier** — verifies ZK proofs on-chain using BN254 precompiles
- **MetaTxRelayer** — gasless deposits and withdrawals via EIP-712 signed meta-transactions
- **Poseidon** — on-chain hash function matching circuit parameters

### 2. ZK Circuits

Circom 2.x circuits define what the prover demonstrates:
- **PrivateTransfer** — proves a valid transfer without revealing amounts or parties (~25K constraints)
- **PrivateWithdraw** — proves a valid withdrawal without linking to the depositor (~21K constraints)

### 3. Client SDK

TypeScript library that runs in the browser:
- Baby Jubjub keypair management
- Note creation, encryption, and local storage
- Merkle tree synchronization from on-chain events
- Groth16 proof generation via snarkjs (WASM)
- Transaction construction and relay integration

## Data flow

### Deposit
```
User → approve ERC20 → deposit(amount, commitment) → Merkle tree updated
```

### Private transfer
```
User → generate proof locally → submit(proof, nullifier, 2 new commitments) → verify on-chain
```

### Withdrawal
```
User → generate proof locally → submit(proof, nullifier, amount, recipient) → ERC20 released
```

## Privacy model

| What's private | What's public |
|---|---|
| Transfer amounts | Deposit amounts (ERC20 transfer is visible) |
| Sender identity | Withdrawal amounts (ERC20 release is visible) |
| Receiver identity | Total pool balance |
| Account balances | Number of commitments in the tree |
| Transfer graph | Nullifiers (but unlinkable to notes without the secret) |
