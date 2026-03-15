---
sidebar_position: 2
title: Connect Wallet
---

# Authentication

Shroud Network uses **email-based authentication** powered by Privy. An external wallet (MetaMask) is only needed for deposits and pool creation.

## Sign in with email

1. Visit [shroudnetwork.xyz](https://shroudnetwork.xyz) and click **Sign In**
2. Enter your email address
3. Complete the one-time passcode (OTP) verification
4. Your Shroud keypair is derived automatically from a Privy embedded wallet

No browser extension or wallet app is required for sign-in.

## When you need an external wallet

An external wallet is required for two operations that involve on-chain ERC20 transfers:

- **Deposits** — transferring tokens from your public balance into the shielded pool
- **Pool creation** — deploying a new shielded pool for an ERC20 token

Each of these pages has its own **Connect Wallet** button. Supported wallets:

- **MetaMask** (recommended)
- **Core Wallet** (Avalanche native)
- **Rabby**
- Any injected EVM wallet

## Network configuration

Shroud Network currently runs on **Avalanche Fuji Testnet**:

| Parameter | Value |
|---|---|
| Network Name | Avalanche Fuji C-Chain |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain ID | `43113` |
| Currency Symbol | AVAX |
| Explorer | `https://testnet.snowtrace.io` |

The app will automatically prompt you to add/switch to Fuji testnet when you connect an external wallet.

## Getting test AVAX

You need a small amount of test AVAX for gas fees when making deposits (unless using gasless mode). Get free test AVAX from the [Avalanche Faucet](https://build.avax.network/console/primary-network/faucet).

## Shroud keypair

When you sign in, Shroud Network generates a **Shroud keypair** for you. This is a separate cryptographic keypair used for:

- Encrypting/decrypting shielded note data
- Proving ownership of notes in ZK circuits
- ECDH shared secrets for encrypted memos

Your Shroud private key is derived deterministically from your Privy embedded wallet signature, so it's always recoverable when you sign in with the same email.

:::info
Migrating from a wallet-based account? See the [Migration Guide](/migration) to move your existing notes to your new email-derived key.
:::

:::warning
Your shielded notes are stored locally in your browser. If you clear your browser data or use a different device, use the **Scan** button on the Notes page to recover your notes from the chain.
:::
