---
sidebar_position: 1
title: ShieldedPool
---

# ShieldedPool Contract

The core contract managing the shielded pool for a single ERC20 token.

## Overview

Each `ShieldedPool` instance wraps one ERC20 token. It maintains:
- An incremental Merkle tree (depth 20, Poseidon hashing) of note commitments
- A nullifier registry for double-spend prevention
- Historical root storage (last 100 roots) for proof freshness tolerance

## Functions

### deposit

```solidity
function deposit(uint256 amount, uint256 commitment) external
```

Locks ERC20 tokens in the pool and inserts a note commitment into the Merkle tree.

| Parameter | Description |
|---|---|
| `amount` | Token amount in whole units (contract scales by `amountScale`) |
| `commitment` | The note commitment (Poseidon hash) |

**Events:** `Deposit(commitment, leafIndex, timestamp)`

:::info
Deposit amount is visible on-chain (the ERC20 `transferFrom` is public). Privacy begins after deposit.
:::

### transfer

```solidity
function transfer(
    bytes calldata proof,
    uint256 merkleRoot,
    uint256 nullifierHash,
    uint256 newCommitment1,
    uint256 newCommitment2,
    bytes calldata encryptedMemo1,
    bytes calldata encryptedMemo2
) external
```

Executes a private transfer inside the pool. Consumes one note (via nullifier) and creates two new notes.

The contract:
1. Checks `merkleRoot` is in the known roots set
2. Checks `nullifierHash` hasn't been spent
3. Verifies the Groth16 proof against 4 public inputs
4. Marks nullifier as spent
5. Inserts both new commitments into the Merkle tree
6. Emits `PrivateTransfer` event with encrypted memos

### withdraw

```solidity
function withdraw(
    bytes calldata proof,
    uint256 merkleRoot,
    uint256 nullifierHash,
    uint256 amount,
    uint256 changeCommitment,
    address recipient,
    bytes calldata encryptedMemo
) external
```

Exits the shielded pool. Consumes a note and releases ERC20 tokens to the recipient.

| Parameter | Description |
|---|---|
| `proof` | Groth16 proof bytes |
| `amount` | Withdrawal amount (public, needed to release ERC20) |
| `changeCommitment` | Change note commitment (0 if full withdrawal) |
| `recipient` | Address to receive the ERC20 tokens |

### View functions

```solidity
function getRoot() external view returns (uint256)
function getNextLeafIndex() external view returns (uint32)
function isSpent(uint256 nullifierHash) external view returns (bool)
function isKnownRoot(uint256 root) external view returns (bool)
function amountScale() external view returns (uint256)
function token() external view returns (address)
```

## Merkle tree

- **Type:** Incremental append-only
- **Hash:** Poseidon (t=3, 2 inputs)
- **Depth:** 20 (supports 1,048,576 commitments)
- **Zero values:** `zero[0] = 0`, `zero[i] = Poseidon(zero[i-1], zero[i-1])`
- **Root history:** Circular buffer of last 100 roots
- Leaves are never removed — a "spent" note still exists in the tree, its nullifier just prevents reuse

## Gas costs

| Operation | Estimated Gas |
|---|---|
| Deposit | ~300,000 - 400,000 |
| Transfer | ~450,000 - 550,000 |
| Withdraw | ~350,000 - 450,000 |
