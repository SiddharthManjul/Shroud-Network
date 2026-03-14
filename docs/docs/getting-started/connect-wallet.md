---
sidebar_position: 2
title: Connect Wallet
---

# Connect Wallet

Shroud Network uses standard EVM wallets to interact with the Avalanche C-Chain.

## Supported wallets

Any EVM-compatible wallet that supports WalletConnect or injected providers:

- **MetaMask** (recommended)
- **Core Wallet** (Avalanche native)
- **Rabby**
- **WalletConnect** compatible wallets

## Network configuration

Shroud Network currently runs on **Avalanche Fuji Testnet**:

| Parameter | Value |
|---|---|
| Network Name | Avalanche Fuji C-Chain |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain ID | `43113` |
| Currency Symbol | AVAX |
| Explorer | `https://testnet.snowtrace.io` |

The app will automatically prompt you to add/switch to Fuji testnet if needed.

## Getting test AVAX

You need a small amount of test AVAX for gas fees (unless using gasless mode). Get free test AVAX from the [Avalanche Faucet](https://faucet.avax.network/).

## Baby Jubjub keypair

When you first connect, Shroud Network generates a **Baby Jubjub keypair** for you. This is a separate cryptographic keypair used for:

- Encrypting/decrypting shielded note data
- Proving ownership of notes in ZK circuits
- ECDH shared secrets for encrypted memos

Your Baby Jubjub private key is derived deterministically from your EVM wallet signature, so it's always recoverable from the same wallet.

:::warning
Your shielded notes are stored locally in your browser. If you clear your browser data, you'll need to rescan the chain to recover your notes.
:::
