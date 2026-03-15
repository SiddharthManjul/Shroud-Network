---
sidebar_position: 2
title: Migration Guide
---

# Migration Guide

Shroud Network has upgraded from wallet-based authentication to **email-based authentication** powered by Privy. This guide explains what changed, why, and how to migrate your existing shielded notes.

## What changed

| Before | After |
|---|---|
| Sign in by connecting MetaMask/Core wallet | Sign in with your email address (OTP) |
| Shroud keypair derived from wallet signature | Shroud keypair derived from Privy embedded wallet |
| Wallet required for all operations | Wallet only needed for deposits and pool creation |
| Transfers and withdrawals required wallet connection | Transfers and withdrawals work with email login only |

## Why email-based authentication

- **Lower barrier to entry** — no browser extension or mobile wallet app required
- **Gasless by default** — transfers and withdrawals use the relay, so email-only users never need AVAX
- **Same security model** — your Shroud keypair is still derived from a cryptographic wallet signature, but the wallet is now managed by Privy's embedded wallet infrastructure
- **External wallet when needed** — deposits still require MetaMask (or similar) because they involve ERC20 token transfers from your public balance

## Do I need to migrate?

**Yes**, if you have existing shielded notes from before the email update. Your old notes were created under a Shroud keypair derived from your MetaMask wallet. Your new email-based Shroud keypair is different, so the old notes aren't visible to it.

**No**, if you're a new user signing in with email for the first time.

## How migration works

Migration uses a **private transfer** from your old wallet-derived key to your new email-derived key. This is a standard shielded transfer — the same zero-knowledge proof protects your privacy. No funds leave the pool, and no amounts are revealed on-chain.

```
Old Shroud Key (wallet-derived)     New Shroud Key (email-derived)
────────────────────────────────    ────────────────────────────────
Note: 1000 USDC (unspent)    ──── private transfer ────→  Note: 1000 USDC (unspent)
Note becomes "spent"                                       New note, same amount
```

## Step-by-step migration

### Step 1: Sign in with email

Visit [shroudnetwork.xyz](https://shroudnetwork.xyz) and sign in with your email address. Complete the OTP verification. Your new Shroud keypair will be derived automatically.

### Step 2: Go to the Migrate page

Navigate to the **Migrate** tab in the navigation bar. This page is specifically designed for moving notes from your old wallet key to your new email key.

### Step 3: Connect your old wallet

Click **Connect Wallet** on the Migrate page. Connect the same MetaMask (or other) wallet you used before the email update. This is needed to derive your old Shroud keypair.

:::warning
Make sure you connect the **same wallet address** that you used previously. Your old Shroud keypair is deterministically derived from that specific wallet's signature.
:::

### Step 4: Scan for old notes

Click **Scan** to search for your existing shielded notes. The scanner will:

1. Derive your old Shroud keypair from your connected wallet
2. Sync the on-chain Merkle tree
3. Try to decrypt all encrypted memos using your old key
4. Display any notes it finds

### Step 5: Migrate each note

For each note found:

1. Click on the note to open the migration modal
2. The modal shows the note amount and your new email-derived Shroud key (pre-filled)
3. Click **Migrate** to execute the private transfer
4. A ZK proof is generated locally and submitted via the relay (gasless)
5. The old note is marked as spent, and a new note appears under your email key

### Step 6: Verify in Notes tab

After migrating, go to the **Notes** tab. Your migrated notes should appear as unspent notes under your email-derived key. They are ready to use for transfers and withdrawals.

## After migration

Once all notes are migrated:

- **Transfers and withdrawals** work with just your email login — no wallet needed
- **Deposits** still require connecting an external wallet (MetaMask) on the Deposit page, since ERC20 tokens must be transferred from your public wallet
- **Pool creation** also requires an external wallet for the on-chain transaction
- Your old wallet-derived notes are now spent and cannot be reused

## FAQ

### What if the scan doesn't find my notes?

Your notes may have been stored locally and lost if you cleared browser data. The scan reconstructs notes by decrypting on-chain memos, so it should find any note that was created through a standard deposit or transfer. If the scan still finds nothing, your notes may have already been spent or withdrawn.

### Is migration gasless?

Yes. Migration uses the relay for the private transfer, so you don't need AVAX. The relay fee (0.1% of the note amount) applies.

### Can I still use my wallet to interact with the pool?

The deposit and pool creation pages have their own **Connect Wallet** buttons. You connect your external wallet specifically for those operations. It is not needed for transfers, withdrawals, or viewing your notes.

### What happens to my old Shroud key?

Nothing — it still exists mathematically. But since all your notes under that key are now spent (migrated), there's nothing left to do with it. Your new email-derived key is your active identity going forward.

### Can I migrate notes from multiple wallets?

Yes. On the Migrate page, you can connect different wallets one at a time, scan for notes under each, and migrate them all to your single email-derived key.
