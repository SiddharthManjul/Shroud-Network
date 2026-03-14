---
sidebar_position: 1
title: Threat Model
---

# Threat Model

Understanding what Shroud Network protects against and its limitations.

## What Shroud protects

### Transaction privacy
- **Amount hiding** — transfer amounts are hidden inside the pool via Pedersen commitments
- **Sender anonymity** — the sender of a private transfer is hidden in the anonymity set
- **Receiver anonymity** — the receiver is hidden; only they can decrypt the memo
- **Balance privacy** — individual balances within the pool are completely hidden

### Double-spend prevention
- Nullifier registry ensures each note can only be spent once
- Nullifiers are derived from secret values — knowing a nullifier doesn't reveal the note

### Supply integrity
- 64-bit range proofs prevent negative amount attacks (field wrapping)
- Pedersen homomorphism ensures amount conservation is verified in-circuit
- Pool solvency is publicly verifiable: `contract.balanceOf() == sum(deposits) - sum(withdrawals)`

## Known limitations

### Deposit/withdrawal visibility
Deposit and withdrawal amounts are visible on-chain (ERC20 transfers are public). Only transfers inside the pool are fully private.

### Deposit fingerprinting
If Alice deposits 7,342.51 USDC and someone withdraws exactly 7,342.51 USDC, they're likely the same person.

**Mitigations:**
- Use round numbers (100, 1000, 10000)
- Transfer inside the pool before withdrawing
- Partial withdrawals to different amounts

### Anonymity set size
Privacy is proportional to pool usage. A pool with 2 users provides much less privacy than a pool with 10,000 users.

### Timing analysis
If Alice deposits and Bob withdraws 5 minutes later, and the pool has few users, timing correlation is possible.

### Front-running
Proof transactions in a public mempool can be front-run. Mitigations:
- MetaTxRelayer binds proof to specific relay wallet
- Future: Avalanche private mempool

### Local storage
Notes are stored in the browser's local storage. Clearing browser data without backup means notes must be rescanned from chain events.

## Cryptographic assumptions

| Assumption | Implication if broken |
|---|---|
| BN254 discrete log is hard | Groth16 proofs can be forged |
| Baby Jubjub discrete log is hard | Pedersen commitments can be opened |
| Poseidon is collision-resistant | Merkle tree integrity breaks |
| Groth16 trusted setup is honest | Fake proofs can be generated |
| H = HashToCurve is independent of G | Pedersen binding property breaks |

## Operational security

- **Private key safety** — Baby Jubjub private key is derived from wallet signature. Wallet compromise = note compromise.
- **RNG quality** — All random values (secrets, blindings, nullifier preimages) use CSPRNG. Weak RNG = catastrophic privacy failure.
- **Relay trust** — The relay wallet submits transactions but cannot steal funds or break privacy. It can only censor (refuse to relay).
