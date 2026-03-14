---
sidebar_position: 2
title: MetaTxRelayer
---

# MetaTxRelayer Contract

Enables gasless deposits and withdrawals via EIP-712 signed meta-transactions. Users pay fees in ERC20 tokens instead of AVAX.

## Overview

The MetaTxRelayer eliminates the need for users to hold AVAX. A relay wallet submits transactions on behalf of users, and fees are paid in the deposited/withdrawn token.

```
User (no AVAX)                    Relay Wallet (has AVAX)
──────────────                    ──────────────────────
Sign EIP-712 message  ──────────→  Submit tx to MetaTxRelayer
                                   Pay gas in AVAX
Token fee deducted    ◄──────────  Receive token fee as compensation
```

## Functions

### relayDeposit

```solidity
struct DepositRequest {
    address depositor;
    address pool;
    uint256 amount;
    uint256 commitment;
    uint256 fee;
    uint256 deadline;
    uint256 nonce;
    bytes signature;
}

function relayDeposit(DepositRequest calldata req) external
```

The contract:
1. Verifies the EIP-712 signature matches the depositor
2. Checks nonce and deadline
3. Pulls `(amount + fee) * amountScale` tokens from the depositor
4. Deposits `amount` into the ShieldedPool
5. Sends `fee` to the relay wallet (`msg.sender`)
6. Increments the depositor's nonce

### relayWithdraw

```solidity
struct WithdrawRequest {
    address withdrawer;
    address pool;
    bytes proof;
    uint256 merkleRoot;
    uint256 nullifierHash;
    uint256 amount;
    uint256 changeCommitment;
    address recipient;
    bytes encryptedMemo;
    uint256 fee;
    uint256 deadline;
    uint256 nonce;
    bytes signature;
}

function relayWithdraw(WithdrawRequest calldata req) external
```

The contract:
1. Verifies the EIP-712 signature
2. Calls `pool.withdraw(proof, ..., recipient=address(this))` — receives tokens itself
3. Sends `(amount - fee)` to the actual recipient
4. Sends `fee` to the relay wallet

:::info
The withdraw circuit's public inputs are `[merkleRoot, nullifierHash, amount, changeCommitment]` — recipient is NOT a public signal, so the proof doesn't bind to a specific recipient. This allows the relayer contract to receive tokens and redistribute them.
:::

## EIP-712 Domain

```
name: "ShroudMetaTxRelayer"
version: "1"
chainId: <network chain ID>
verifyingContract: <MetaTxRelayer address>
```

## Fee structure

- Default relay fee: **0.1% of amount** (minimum 1 token unit)
- Fee is deducted from the user's token balance (deposits) or withdrawal amount (withdrawals)
- Relay wallet receives the fee as compensation for gas

## Nonce management

Each user has a sequential nonce tracked on-chain:

```solidity
mapping(address => uint256) public nonces;
```

The nonce prevents replay attacks. After each successful relay operation, the nonce increments.

## Token approval

For gasless deposits, users must first approve the MetaTxRelayer to spend their tokens. This is a one-time operation that requires a small amount of AVAX for gas. After approval (set to `MaxUint256`), all subsequent deposits are truly gasless.
