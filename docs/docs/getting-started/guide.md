---
sidebar_position: 4
title: Usage Guide
---

# Usage Guide

A step-by-step walkthrough of every feature in Shroud Network — from claiming test tokens to making fully private transfers on Avalanche.

## Terminology

- **Shielded Pool** — A smart contract that holds ERC20 tokens and tracks ownership via cryptographic commitments instead of public balances. Tokens enter the pool through deposits, move around privately, and exit through withdrawals.
- **Note** — A private token holding inside the shielded pool. Each note contains an amount, random secrets, and the owner's public key — all hidden from the blockchain. Think of it like a sealed envelope of value that only you can open.
- **Commitment** — A cryptographic fingerprint of a note that gets stored on-chain in the Merkle tree. It reveals nothing about the note's contents — not the amount, not the owner.
- **Nullifier** — A unique tag revealed when a note is spent. The contract records it to prevent double-spending. It cannot be linked back to the original commitment.
- **Shielded Key** — A Baby Jubjub keypair (X and Y coordinates) derived from your wallet signature. This is your identity inside the shielded pool — you share the public key with senders so they can create notes only you can spend.
- **ZK Proof** — A zero-knowledge proof (Groth16) that proves a transaction is valid — correct balances, valid note ownership, proper Merkle inclusion — without revealing any private data.
- **Merkle Tree** — An append-only data structure of all commitments ever created. The client rebuilds it locally to generate inclusion proofs for your notes.
- **Encrypted Memo** — An ECDH-encrypted payload attached to transfers. It contains the note details (amount, secrets) so the recipient can discover and spend the note. Only the intended recipient can decrypt it.

## How it all fits together

```
Faucet ──→ Get test tokens (ERC20)
   │
Pools ──→ Create a shielded pool for your token
   │
Deposit ──→ Lock tokens into the pool → receive a Note
   │
Notes ──→ View & manage your private notes
   │
Transfer ──→ Send privately (note → 2 new notes)
   │
Scan ──→ Discover notes sent to you
   │
Withdraw ──→ Exit tokens back to any EVM address
```

---

## 1. Faucet

**What:** The faucet mints free SRD test tokens to your wallet. These are standard ERC20 tokens on the Avalanche Fuji testnet — the same tokens you'll later deposit into the shielded pool.

**Why:** You need ERC20 tokens before you can deposit into a shielded pool. On testnet, the faucet gives you an unlimited supply so you can experiment freely without real funds.

**How:**
1. Connect your wallet (MetaMask or any EVM wallet) to Avalanche Fuji.
2. Navigate to the Faucet page.
3. Enter the amount you want (leave blank for the default 1,000).
4. Click "Claim Tokens" and confirm the transaction in your wallet.
5. Wait for the transaction to confirm — your SRD balance will update.
6. Optionally click "Add to MetaMask" to see the token balance in your wallet.

:::tip
You can claim tokens multiple times — there is no cooldown. If you switch the active token in the navbar, the faucet will mint that token instead (if it has a faucet function).
:::

---

## 2. Pool Creation

**What:** Pool creation deploys a new shielded pool contract for any ERC20 token. Each token gets its own pool with its own Merkle tree and commitment set. Once created, anyone can deposit that token.

**Why:** Shroud Network supports privacy for any ERC20 token — not just predefined ones. If a pool doesn't exist for the token you want to use, you create one. The pool is shared by all users, which grows the anonymity set.

**How:**
1. Navigate to the Pools page.
2. Either use the Quick Select button (e.g. WAVAX) or paste any ERC20 token contract address.
3. Click "Lookup" to fetch the token's name, symbol, and decimals from the chain.
4. Verify the token metadata displayed is correct.
5. Click "Create Pool" and confirm the transaction.
6. Once confirmed, the token will appear in the token selector dropdown in the navbar.

:::tip
- For native AVAX: create a WAVAX pool. The deposit form will automatically wrap your AVAX before depositing.
- Each token can only have one pool — if it already exists, you'll see a message telling you to select it from the navbar.
- The Registered Pools section at the bottom shows all pools currently available.
:::

---

## 3. Deposit

**What:** Depositing locks your ERC20 tokens into the shielded pool contract and creates a private note in your local storage. The note is a cryptographic commitment added to the on-chain Merkle tree.

**Why:** Deposits are the entry point into the privacy system. Once deposited, your tokens exist as shielded notes — all subsequent transfers are completely private. The deposit amount is visible on-chain (the ERC20 transfer is public), but privacy begins immediately after.

**How:**
1. Make sure you have the correct token selected in the navbar.
2. Navigate to the Deposit page.
3. If depositing into a WAVAX pool, choose between Native AVAX (auto-wraps) or WAVAX (ERC20).
4. Enter the amount to deposit (whole numbers, no decimals).
5. Click "Deposit" — your wallet will prompt for two approvals: one to approve the token transfer, one for the deposit transaction.
6. Wait for the transaction to confirm. Your note will be stored locally with its leaf index.

:::tip
- Your shielded key is automatically derived the first time you deposit — you'll be asked to sign a message with your wallet.
- If a deposit confirms but the note shows as "unfinalized", use the recovery button to sync the Merkle tree and match your commitment.
- Deposit amounts are public. For better privacy, use round numbers (100, 500, 1000) to blend in with other depositors.
:::

---

## 4. Notes

**What:** The Notes page is your private note inventory. It shows every note you own — both unspent (available to transfer or withdraw) and spent (already consumed). Notes are stored locally in your browser.

**Why:** Since all balances inside the shielded pool are hidden on-chain, your local note storage is the only record of what you own. The Notes page gives you visibility into your private holdings and their status.

**How:**
1. Navigate to the Notes page.
2. View your unspent notes — each shows the amount, token, and leaf index.
3. Spent notes appear in a separate section below.
4. Use "Scan" to check for notes sent to you by other users (see Scanning below).
5. Use "Clear All" to wipe your local note storage (use with caution — this is irreversible).

:::warning
Notes are stored in your browser's localStorage. Clearing browser data will delete them. Back up important note data. A note's leaf index is its position in the Merkle tree — you'll need it for proof generation, but the app handles this automatically.
:::

---

## 5. Scanning for Incoming Notes

**What:** Scanning checks on-chain transfer events and attempts to decrypt the encrypted memos attached to each one using your shielded private key. If decryption succeeds, it means someone sent you a note — and it gets added to your local inventory.

**Why:** When someone sends you a private transfer, there is no notification — the blockchain only shows encrypted data. Your client must scan events and try decrypting each memo to discover notes addressed to you. This is the only way to receive private transfers.

**How:**
1. Go to the Dashboard or Notes page and click "Scan" (or use the Scan tile in Quick Actions).
2. The app will query on-chain events and attempt decryption with your key.
3. Any discovered notes are automatically saved to your local storage.
4. You'll see "Scan complete" when finished.

:::tip
- Scan regularly if you expect incoming transfers — there is no push notification system.
- Scanning is read-only and costs no gas. It only reads events from the chain.
- The more transfer events in the pool, the longer scanning takes. This is a known UX tradeoff of private systems.
:::

---

## 6. Private Transfer

**What:** A private transfer consumes one of your notes and creates two new notes — one for the recipient (the transfer amount) and one for yourself (the change). A ZK proof verifies everything is valid without revealing any details on-chain.

**Why:** This is the core privacy feature. On-chain observers see a nullifier (proving a note was spent), two new commitments, a ZK proof, and encrypted memos — but they cannot determine the amount, sender, or recipient. Transfers can be chained indefinitely for continuous privacy.

**How:**
1. Navigate to the Transfer page.
2. Select which note to spend from the dropdown.
3. Copy the recipient's shielded public key (both X and Y coordinates) into the input fields. They can find these on their own Transfer page.
4. Enter the transfer amount (must be less than or equal to the note's value).
5. Click "Transfer" — the app will generate a ZK proof (takes a few seconds), encrypt the memo for the recipient, and submit via the relay.
6. Once confirmed, your spent note is marked as used and a change note (if any) is saved automatically.

:::tip
- Your shielded public key is displayed at the top of the Transfer page — share both X and Y with anyone who wants to send you tokens.
- Use the copy buttons next to your keys for easy sharing.
- Change is handled automatically: if you spend a 1000-token note and transfer 300, you'll get a 700-token change note back.
- The recipient must scan to discover the transfer. Tell them to hit the Scan button.
- Transfers are relayed (gasless for you) — the relay submits the transaction on your behalf.
:::

---

## 7. Withdraw

**What:** Withdrawing exits tokens from the shielded pool back to any public EVM address. It consumes a note (via nullifier + ZK proof) and releases the corresponding ERC20 tokens from the pool contract to the specified recipient.

**Why:** Withdrawals are how you move value back into the public world. The withdrawal amount is visible (the contract must release real ERC20 tokens), but the link between the original depositor and the withdrawer is broken by the privacy of intermediate transfers. You can withdraw to any address — it does not have to be the one that deposited.

**How:**
1. Navigate to the Withdraw page.
2. Select the note to spend from the dropdown.
3. Enter the public EVM address that should receive the tokens (0x...).
4. Enter the withdrawal amount (partial withdrawals create a change note for the remainder).
5. Click "Withdraw via Relay" — a ZK proof is generated and submitted through the relay.
6. Once confirmed, the ERC20 tokens arrive at the recipient address.

:::tip
- Withdraw to a fresh address for maximum privacy — withdrawing to the same address that deposited defeats the purpose.
- Partial withdrawals are supported. If your note holds 1000 tokens and you withdraw 400, you'll get a 600-token change note.
- Withdrawal amounts are public. Like deposits, use round numbers to minimize fingerprinting.
- The relay handles gas — you don't need AVAX in the withdrawing address.
:::

---

## Important Reminders

:::danger
- Your notes are stored locally in your browser. If you clear browser data, your notes are gone. There is no recovery from the server.
- Your shielded key is derived from a wallet signature — same wallet = same key. But notes themselves are not recoverable without local storage or a full chain rescan.
- Privacy is proportional to the anonymity set. The more users in the pool, the stronger the privacy for everyone.
- This is testnet software. Do not use with real funds on mainnet until the system has been fully audited.
:::
