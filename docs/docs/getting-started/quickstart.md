---
sidebar_position: 1
title: Quickstart
---

# Quickstart

Get up and running with Shroud Network in under 5 minutes.

## Prerequisites

- An email address (for sign-in)
- A browser wallet like MetaMask (only for deposits)
- Test AVAX for gas (or use gasless mode for deposits)

## Step 1: Sign in with email

Visit [shroudnetwork.xyz](https://shroudnetwork.xyz) and click **Sign In**. Enter your email and complete the OTP verification. Your Shroud keypair will be generated automatically.

## Step 2: Get test tokens

Navigate to the **Faucet** tab. You can mint test tokens (SRD) for free — add it to your wallet & click the faucet button to receive tokens to your wallet.

## Step 3: Deposit into the shielded pool

1. Go to the **Deposit** tab
2. Click **Connect Wallet** to connect your MetaMask (needed for ERC20 transfers)
3. Enter the amount you want to shield
3. Choose your gas payment method:
   - **Pay Gas (AVAX)** — standard transaction, you pay gas in AVAX
   - **Gasless (Token Fee)** — relay-based, a small fee is deducted from your deposit in tokens
4. Click **Deposit** and approve the transaction in your wallet
5. Your shielded note will appear in the **Notes** tab

:::info
Your first gasless deposit requires a one-time token approval (costs a tiny amount of AVAX). After that, all gasless deposits are truly free of AVAX.
:::

## Step 4: Transfer privately

1. Go to the **Transfer** tab
2. Select the note you want to spend
3. Enter the recipient's shielded address and the transfer amount
4. A ZK proof is generated locally in your browser
5. Submit — the transfer is completely private

## Step 5: Withdraw to any address

1. Go to the **Withdraw** tab
2. Select the note to withdraw from
3. Enter the recipient EVM address and amount
4. Choose gas payment method (direct or gasless)
5. Tokens are released to the recipient address

:::tip
The link between your original deposit address and withdrawal address is broken by the privacy of intermediate transfers. For maximum privacy, transfer at least once before withdrawing.
:::

## Understanding your notes

Each deposit or incoming transfer creates a **note** — a private record of your shielded balance. Notes are stored locally in your browser. You can view all your notes in the **Notes** tab.

- **Unspent notes** can be used for transfers or withdrawals
- **Spent notes** have been consumed and cannot be reused
- Notes are encrypted — only you can decrypt and spend them
