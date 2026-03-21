# @shroudnetwork/sdk

Privacy-first shielded pool SDK for Avalanche C-Chain. Deposit ERC20 tokens into a ZK-powered shielded pool, transfer them privately with zero-knowledge proofs, and withdraw to any address -- breaking all on-chain links between sender and receiver.

<!-- badges -->
<!-- [![npm](https://img.shields.io/npm/v/@shroudnetwork/sdk)](https://www.npmjs.com/package/@shroudnetwork/sdk) -->
<!-- [![license](https://img.shields.io/npm/l/@shroudnetwork/sdk)](./LICENSE) -->

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Wallet Management](#wallet-management)
- [Core Operations](#core-operations)
- [Balance & Syncing](#balance--syncing)
- [Pool Discovery](#pool-discovery)
- [Real-Time Events](#real-time-events)
- [Storage Adapters](#storage-adapters)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Network Configuration](#network-configuration)
- [Types Reference](#types-reference)
- [Security Considerations](#security-considerations)
- [How It Works](#how-it-works)
- [License](#license)

---

## Quick Start

```ts
import { ShroudClient } from '@shroudnetwork/sdk';

const client = new ShroudClient({ network: 'fuji' });

// Create a shielded wallet (Baby Jubjub keypair)
const wallet = await client.createWallet();

// Deposit 100 USDC into the shielded pool
await client.deposit({
  token: 'USDC',
  amount: 100_000_000n, // 100 USDC (6 decimals)
  wallet,
  signer, // ethers.js v6 Signer
});

// Private transfer to another shielded wallet
await client.transfer({
  to: JSON.stringify({
    x: recipientWallet.publicKey[0].toString(),
    y: recipientWallet.publicKey[1].toString(),
  }),
  amount: 50_000_000n,
  wallet,
  token: 'USDC',
});

// Withdraw back to any EVM address
await client.withdraw({
  amount: 25_000_000n,
  recipient: '0xRecipientEVMAddress',
  wallet,
  token: 'USDC',
});
```

---

## Installation

```bash
# npm
npm install @shroudnetwork/sdk

# yarn
yarn add @shroudnetwork/sdk

# pnpm
pnpm add @shroudnetwork/sdk
```

### Peer Dependencies

The SDK requires ethers.js v6 as a peer dependency:

```bash
npm install ethers@^6.0.0
```

---

## Configuration

Create a client by passing a `ShroudConfig` object:

```ts
import { ShroudClient, MemoryStorage } from '@shroudnetwork/sdk';

const client = new ShroudClient({
  network: 'fuji',              // 'avalanche' | 'fuji' | 'custom'
  apiKey: 'sk_live_...',        // optional: API key for relay and proof services
  rpcUrl: 'https://...',        // optional: override RPC endpoint (required for 'custom')
  apiUrl: 'https://...',        // optional: override Shroud API base URL
  proofMode: 'client',          // 'client' (default) | 'server'
  circuitBaseUrl: 'https://...', // optional: URL for circuit WASM + zkey files
  storage: new MemoryStorage(), // optional: custom StorageAdapter instance
});
```

### ShroudConfig Options

| Option | Type | Default | Description |
|---|---|---|---|
| `network` | `'avalanche' \| 'fuji' \| 'custom'` | **required** | Target network. Use `'custom'` with `rpcUrl` for local or private chains. |
| `apiKey` | `string` | `undefined` | API key for Shroud hosted services (relay, server-side proofs). Required for gasless transfers. |
| `rpcUrl` | `string` | Network default | Override the JSON-RPC endpoint. Required when `network` is `'custom'`. |
| `apiUrl` | `string` | Network default | Override the Shroud indexer/API base URL. |
| `proofMode` | `'client' \| 'server'` | `'client'` | `'client'` generates Groth16 proofs locally via snarkjs. `'server'` delegates proof generation to the Shroud API (requires `apiKey`). |
| `circuitBaseUrl` | `string` | Network default | Base URL to fetch circuit WASM and zkey files for client-side proof generation. |
| `storage` | `StorageAdapter` | `MemoryStorage` | Persistence backend for notes and sync state. See [Storage Adapters](#storage-adapters). |

---

## Wallet Management

Wallets are Baby Jubjub keypairs used for shielded pool operations. They are separate from your EVM wallet (which is only needed for deposits and direct withdrawals).

### Create a New Wallet

```ts
// Random wallet (CSPRNG)
const wallet = await client.createWallet();
```

### Create from Seed (Deterministic)

The same seed always produces the same keypair. Uses HKDF-SHA-256 internally.

```ts
// From a string
const wallet = await client.createWallet('my secret seed phrase');

// From raw bytes
const wallet = await client.createWallet(new Uint8Array([...]));
```

### Restore from Private Key

```ts
const wallet = await client.restoreWallet('0x1a2b3c...');
```

### Export Private Key

```ts
const privateKeyHex: string = client.exportWallet(wallet);
// Returns a 0x-prefixed, 64-character hex string
```

### ShroudWallet Interface

```ts
interface ShroudWallet {
  /** Hex string of Baby Jubjub public key x-coordinate -- unique wallet identifier */
  address: string;
  /** Full Baby Jubjub public key as [x, y] field elements */
  publicKey: [bigint, bigint];
}
```

---

## Core Operations

### Deposit

Lock ERC20 tokens into the shielded pool. The deposit amount is visible on-chain (the ERC20 transfer is public), but once inside the pool, all subsequent activity is private.

```ts
const result = await client.deposit({
  token: 'USDC',              // token symbol or contract address
  amount: 1_000_000n,         // amount in base units (1 USDC = 1_000_000)
  wallet,                     // ShroudWallet
  signer,                     // ethers.js v6 Signer holding the ERC20 tokens
});

console.log(result.txHash);   // '0x...'
console.log(result.status);   // 'success' | 'failed'
```

The SDK handles ERC20 `approve` and pool `deposit` calls automatically.

#### DepositOptions

| Field | Type | Description |
|---|---|---|
| `token` | `string` | ERC20 token symbol (e.g., `"USDC"`) or contract address. |
| `amount` | `number \| bigint` | Amount in token base units. |
| `wallet` | `ShroudWallet` | The shielded wallet to deposit into. |
| `signer` | `EthersSigner` | An ethers.js v6 Signer that holds the ERC20 tokens. |

### Transfer

Move value privately inside the shielded pool. Amounts, sender, and recipient are hidden behind a Groth16 zero-knowledge proof. Transfers are relayed (gasless) by default when an `apiKey` is configured.

```ts
const result = await client.transfer({
  to: JSON.stringify({
    x: recipientWallet.publicKey[0].toString(),
    y: recipientWallet.publicKey[1].toString(),
  }),
  amount: 500_000n,
  wallet,
  token: 'USDC',
});
```

The recipient public key **must** be provided in JSON `{x, y}` format (both coordinates are required for ECDH encryption of the note memo).

#### TransferOptions

| Field | Type | Description |
|---|---|---|
| `to` | `string` | Recipient's Baby Jubjub public key. Must be JSON `{"x": "...", "y": "..."}` format with both coordinates. |
| `amount` | `number \| bigint` | Amount in token base units. |
| `wallet` | `ShroudWallet` | Sender's shielded wallet. |
| `token` | `string` (optional) | Token symbol or address. Defaults to first token with sufficient balance. |

### Withdraw

Exit the shielded pool back to a standard EVM address. The withdrawal amount is revealed (necessary to release ERC20 tokens), but the link to the original depositor is broken by the privacy of intermediate transfers.

```ts
// Gasless withdrawal via relay (requires apiKey)
const result = await client.withdraw({
  amount: 250_000n,
  recipient: '0xYourEVMAddress',
  wallet,
  token: 'USDC',
});

// Direct on-chain withdrawal (requires a signer)
const result = await client.withdraw({
  amount: 250_000n,
  recipient: '0xYourEVMAddress',
  wallet,
  token: 'USDC',
  signer, // ethers.js v6 Signer
});
```

#### WithdrawOptions

| Field | Type | Description |
|---|---|---|
| `amount` | `number \| bigint` | Amount in token base units. |
| `recipient` | `string` | EVM address to receive the ERC20 tokens. |
| `wallet` | `ShroudWallet` | The shielded wallet to withdraw from. |
| `token` | `string` (optional) | Token symbol or address. |
| `signer` | `EthersSigner` (optional) | Provide for direct on-chain withdrawal. Omit to use the relay (requires `apiKey`). |

### TransactionResult

All three operations return a `TransactionResult`:

```ts
interface TransactionResult {
  txHash: string;
  blockNumber: number;
  status: 'success' | 'failed';
  type: 'deposit' | 'transfer' | 'withdraw';
}
```

---

## Balance & Syncing

### Get Balance for a Single Token

```ts
const balance = await client.getBalance(wallet, 'USDC');

console.log(balance.token);          // 'USDC'
console.log(balance.tokenAddress);   // '0x...'
console.log(balance.shieldedAmount); // 750_000n
console.log(balance.noteCount);      // 3
```

### Get All Balances

```ts
const balances = await client.getBalances(wallet);

for (const b of balances) {
  console.log(`${b.token}: ${b.shieldedAmount} (${b.noteCount} notes)`);
}
```

### ShieldedBalance

```ts
interface ShieldedBalance {
  token: string;        // token symbol
  tokenAddress: string; // ERC20 contract address
  shieldedAmount: bigint;
  noteCount: number;    // number of unspent notes
}
```

### Sync (Scan for Incoming Notes)

Scan on-chain memo events and trial-decrypt them with the wallet's private key to discover incoming transfers:

```ts
await client.sync(wallet);
```

The sync function tracks the last scanned block and only processes new events on subsequent calls. Newly discovered notes are automatically saved to storage.

---

## Pool Discovery

### List Supported Tokens

```ts
const tokens: TokenInfo[] = await client.getSupportedTokens();

for (const t of tokens) {
  console.log(`${t.symbol} (${t.decimals} decimals) @ ${t.address}`);
  console.log(`  Pool: ${t.poolAddress}`);
}
```

### Get Pool Info

```ts
const pool: PoolInfo = await client.getPoolInfo('USDC');

console.log(pool.totalDeposited);    // bigint
console.log(pool.activeCommitments); // number
console.log(pool.merkleRoot);        // hex string
```

### Types

```ts
interface TokenInfo {
  symbol: string;
  address: string;
  poolAddress: string;
  decimals: number;
}

interface PoolInfo {
  token: TokenInfo;
  totalDeposited: bigint;
  activeCommitments: number;
  merkleRoot: string;
}
```

---

## Real-Time Events

Subscribe to live note-received events via WebSocket:

```ts
const unsubscribe = client.onNoteReceived(wallet, (event) => {
  console.log(`Received ${event.amount} at leaf ${event.leafIndex}`);
  console.log(`Type: ${event.type}`); // 'received' | 'change'
  console.log(`Block: ${event.blockNumber}`);
});

// Later: stop listening
unsubscribe();

// Clean up all WebSocket connections when done
client.destroy();
```

### NoteEvent

```ts
interface NoteEvent {
  token: string;
  amount: bigint;
  leafIndex: number;
  blockNumber: number;
  type: 'received' | 'change';
}
```

The WebSocket client handles automatic reconnection with exponential backoff (500ms initial, 30s max).

---

## Storage Adapters

The SDK uses a `StorageAdapter` interface to persist notes, sync state, and Merkle tree data. Two built-in adapters are provided.

### StorageAdapter Interface

```ts
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}
```

### MemoryStorage (Default)

In-memory `Map`-based storage. Data is lost when the process exits. Suitable for testing and short-lived sessions.

```ts
import { MemoryStorage } from '@shroudnetwork/sdk';

const storage = new MemoryStorage();

const client = new ShroudClient({ network: 'fuji', storage });

// Utility methods
storage.clear(); // wipe all data
storage.size;    // number of stored entries
```

### IndexedDBStorage (Browser)

Persistent browser storage backed by IndexedDB. The database is opened lazily on the first operation.

```ts
import { IndexedDBStorage } from '@shroudnetwork/sdk';

const storage = new IndexedDBStorage();       // default db name: 'shroud-sdk'
const storage = new IndexedDBStorage('mydb'); // custom db name

const client = new ShroudClient({ network: 'fuji', storage });

// Close the underlying IDBDatabase connection (re-opens automatically on next operation)
storage.close();
```

### Custom Storage Adapter

Implement the `StorageAdapter` interface for any backend -- localStorage, SQLite, Redis, etc.:

```ts
import type { StorageAdapter } from '@shroudnetwork/sdk';

class RedisStorage implements StorageAdapter {
  async get(key: string): Promise<string | null> { /* ... */ }
  async set(key: string, value: string): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async keys(prefix: string): Promise<string[]> { /* ... */ }
}

const client = new ShroudClient({
  network: 'avalanche',
  storage: new RedisStorage(),
});
```

---

## Error Handling

All SDK errors extend `ShroudError`, which carries a machine-readable `code` string alongside the human-readable `message`.

```ts
import {
  ShroudError,
  InsufficientBalanceError,
  InvalidKeyError,
  NetworkError,
  ProofGenerationError,
  RelayError,
  ApiKeyError,
  UnsupportedTokenError,
} from '@shroudnetwork/sdk';

try {
  await client.transfer({ to, amount: 999_999_999n, wallet, token: 'USDC' });
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.log(`Need ${err.required}, have ${err.available}`);
  } else if (err instanceof ProofGenerationError) {
    console.log(`Proof failed: ${err.message}`, err.cause);
  } else if (err instanceof ShroudError) {
    console.log(`[${err.code}] ${err.message}`);
  }
}
```

### Error Classes

| Class | Code | When | Extra Properties |
|---|---|---|---|
| `ShroudError` | *(varies)* | Base class for all SDK errors. | `code: string` |
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | No single unspent note is large enough for the requested amount. | `required: bigint`, `available: bigint` |
| `InvalidKeyError` | `INVALID_KEY` | Private key hex is malformed or outside the Baby Jubjub subgroup range. | -- |
| `NetworkError` | `NETWORK_ERROR` | RPC or HTTP request failed, or transaction reverted. | `statusCode?: number` |
| `ProofGenerationError` | `PROOF_GENERATION_ERROR` | Groth16 witness computation or proof generation failed (e.g., circuit WASM fetch error). | `cause?: unknown` |
| `RelayError` | `RELAY_ERROR` | The relay server rejected the submitted transaction. | `relayCode?: string` |
| `ApiKeyError` | `API_KEY_REQUIRED` | Operation (relay, server-side proof) requires an API key that was not provided in `ShroudConfig`. | -- |
| `UnsupportedTokenError` | `UNSUPPORTED_TOKEN` | The token symbol or address is not recognized by the Shroud deployment. | `token: string` |

---

## Advanced Usage

### MerkleTree

Client-side incremental Poseidon Merkle tree (depth 20, matching the on-chain contract). Use this to reconstruct tree state from events or build inclusion proofs manually.

```ts
import { MerkleTree } from '@shroudnetwork/sdk';
import type { MerkleProof } from '@shroudnetwork/sdk';

const tree = new MerkleTree();    // depth 20 by default
await tree.init();                // required before any operation

// Insert commitments
const leafIndex: number = await tree.insert(commitmentBigInt);
await tree.insertMany([c1, c2, c3]);

// Query state
tree.root;                        // current Merkle root (bigint)
tree.size;                        // number of inserted leaves
tree.getLeaf(0);                  // bigint | undefined

// Generate an inclusion proof for the ZK circuit
const proof: MerkleProof = await tree.getProof(leafIndex);
// proof.leaf, proof.leafIndex, proof.path, proof.indices, proof.root

// Verify a proof against the current root
const valid: boolean = await tree.verify(proof);
```

#### MerkleProof

```ts
interface MerkleProof {
  leaf: bigint;         // the leaf value being proven
  leafIndex: number;    // 0-based index
  path: bigint[];       // sibling hashes from leaf level up to root
  indices: number[];    // 0 = left child, 1 = right child, at each level
  root: bigint;         // computed Merkle root
}
```

### ProofGenerator

Generate Groth16 proofs directly, bypassing the `ShroudClient` orchestration:

```ts
import { ProofGenerator } from '@shroudnetwork/sdk';
import type {
  TransferProofInputs,
  WithdrawProofInputs,
  ProofResult,
} from '@shroudnetwork/sdk';

const prover = new ProofGenerator('https://circuits.shroud.dev');

// Transfer proof
const result: ProofResult = await prover.generateTransferProof({
  note,              // InternalNote (the input note being consumed)
  merklePath,        // MerkleProof from MerkleTree.getProof()
  ownerPrivateKey,   // bigint -- Baby Jubjub private key
  recipientNote,     // output note for recipient
  changeNote,        // output note for change
  merkleRoot,        // bigint
});

// Withdraw proof
const result: ProofResult = await prover.generateWithdrawProof({
  note,
  merklePath,
  ownerPrivateKey,
  withdrawalAmount,   // bigint (public input)
  recipientAddress,   // EVM address string (public input)
  changeNote,
  merkleRoot,
});

// result.proof       -> Groth16Proof { pi_a, pi_b, pi_c }
// result.publicSignals -> string[]
```

#### Groth16Proof

```ts
interface Groth16Proof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
}

interface ProofResult {
  proof: Groth16Proof;
  /** Public signals in circuit order: [merkle_root, nullifier_hash, ...] */
  publicSignals: string[];
}
```

### Encrypted Memos

Encrypt and decrypt note data for on-chain memo blobs. Uses ECDH on Baby Jubjub + AES-256-GCM.

```ts
import { encryptMemo, tryDecryptMemo, scanMemos, MEMO_BYTES } from '@shroudnetwork/sdk';

// Encrypt (sender side)
const memoHex: string = await encryptMemo(
  amount,               // bigint
  blinding,             // bigint
  secret,               // bigint
  nullifierPreimage,    // bigint
  recipientPublicKey,   // [bigint, bigint]
);

// Decrypt (recipient side) -- returns null if not addressed to this key
const decoded = await tryDecryptMemo(memoHex, myPrivateKey);
if (decoded) {
  console.log(decoded.amount);
  console.log(decoded.blinding);
  console.log(decoded.secret);
  console.log(decoded.nullifierPreimage);
}

// Batch scan -- try decrypting many memos at once
const found = await scanMemos(
  [
    { hex: memo1Hex, meta: { txHash: '0x...', blockNumber: 123 } },
    { hex: memo2Hex, meta: { txHash: '0x...', blockNumber: 124 } },
  ],
  myPrivateKey,
);
// found: Array<{ amount, blinding, secret, nullifierPreimage, meta }>

// Memo size constant
console.log(MEMO_BYTES); // 188 bytes
```

### Direct Wallet Functions

Low-level wallet and note functions are exported for advanced use cases:

```ts
import {
  createRandomWallet,
  createWalletFromSeed,
  restoreWallet,
  exportWallet,
  ecdh,
  createNote,
  computeNullifier,
  parseRecipientPublicKey,
  serialiseNote,
  deserialiseNote,
  FIELD_PRIME,
  SUBGROUP_ORDER,
} from '@shroudnetwork/sdk';

// Create wallets directly (without ShroudClient)
const wallet = await createRandomWallet();
const wallet = await createWalletFromSeed('my seed');
const wallet = await restoreWallet('0xprivateKeyHex');
const hex: string = exportWallet(wallet);

// ECDH shared secret on Baby Jubjub
const sharedPoint: [bigint, bigint] = await ecdh(myPrivateKey, theirPublicKey);

// Create a note manually
const note = await createNote(
  1_000_000n,                 // amount
  [pubKeyX, pubKeyY],         // owner public key
  '0xTokenAddress',           // ERC20 address
  12345,                      // block number
);
// Returns: { amount, blinding, secret, nullifierPreimage, ownerPublicKey,
//            noteCommitment, pedersenCommitment, spent, tokenAddress, createdAtBlock }

// Compute nullifier for a note
const nullifier: bigint = await computeNullifier(
  note.nullifierPreimage,
  note.secret,
  leafIndex,
);

// Parse recipient key from JSON or hex
const pubKey: [bigint, bigint] = parseRecipientPublicKey('{"x": "123", "y": "456"}');
// x-only format returns y=0n (cannot be used for ECDH/encryption)
const pubKeyPartial = parseRecipientPublicKey('0x' + '0a'.repeat(32));

// Serialise/deserialise notes for storage
const json: string = serialiseNote(internalNote);
const restored: InternalNote = deserialiseNote(json);

// Cryptographic constants
console.log(FIELD_PRIME);      // 21888242871839275222246405745257275088548364400416034343698204186575808495617n
console.log(SUBGROUP_ORDER);   // 2736030358979909402780800718157159386076813972158567259200215660948447373041n
```

### WalletState and InternalNote Types

```ts
interface WalletState {
  keypair: { privateKey: bigint; publicKey: [bigint, bigint] };
  notesByToken: Map<string, InternalNote[]>;
}

interface InternalNote {
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
  ownerPublicKey: [bigint, bigint];
  leafIndex: number;
  noteCommitment: bigint;
  pedersenCommitment: [bigint, bigint];
  nullifier: bigint;
  spent: boolean;
  tokenAddress: string;
  createdAtBlock: number;
}
```

---

## Network Configuration

Built-in network presets are available via the `NETWORKS` export:

```ts
import { NETWORKS } from '@shroudnetwork/sdk';
import type { NetworkConfig } from '@shroudnetwork/sdk';

console.log(NETWORKS.avalanche);
// {
//   chainId: 43114,
//   rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
//   poolRegistryAddress: '',
//   relayerUrl: 'https://relay.shroud.dev',
//   indexerUrl: 'https://indexer.shroud.dev',
//   circuitBaseUrl: 'https://circuits.shroud.dev',
// }

console.log(NETWORKS.fuji);
// {
//   chainId: 43113,
//   rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
//   poolRegistryAddress: '',
//   relayerUrl: 'https://relay-testnet.shroud.dev',
//   indexerUrl: 'https://indexer-testnet.shroud.dev',
//   circuitBaseUrl: 'https://circuits-testnet.shroud.dev',
// }
```

### NetworkConfig

```ts
interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  poolRegistryAddress: string;
  relayerUrl: string;
  indexerUrl: string;
  circuitBaseUrl: string;
}
```

### ResolvedConfig

The fully resolved configuration after merging user overrides with network defaults:

```ts
interface ResolvedConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  apiUrl: string;
  poolRegistryAddress: string;
  relayerUrl: string;
  indexerUrl: string;
  circuitBaseUrl: string;
  proofMode: 'client' | 'server';
  apiKey: string | undefined;
}
```

---

## Types Reference

All public types are re-exported from the package entry point:

```ts
import type {
  // Config
  ShroudConfig,
  NetworkConfig,
  ResolvedConfig,

  // Wallet
  ShroudWallet,
  WalletState,
  InternalNote,

  // Operations
  DepositOptions,
  TransferOptions,
  WithdrawOptions,
  TransactionResult,

  // Queries
  ShieldedBalance,
  TokenInfo,
  PoolInfo,
  NoteEvent,

  // Storage
  StorageAdapter,

  // Cryptography
  MerkleProof,
  Groth16Proof,
  TransferProofInputs,
  WithdrawProofInputs,
  ProofResult,

  // Ethers interfaces (use to avoid importing ethers directly)
  EthersSigner,
  EthersProvider,
  EthersTransactionRequest,
  EthersTransactionResponse,
  EthersTransactionReceipt,
  EthersLog,
} from '@shroudnetwork/sdk';
```

---

## Security Considerations

- **Private keys never leave the client.** The `ShroudWallet.address` is a public identifier (Baby Jubjub x-coordinate). Private keys are held in an in-memory registry and never serialized unless you explicitly call `exportWallet()`.

- **All randomness uses CSPRNG.** Secrets, blinding factors, nullifier preimages, and ephemeral ECDH keys are generated with `crypto.getRandomValues()` and `crypto.subtle`. Never supply predictable values.

- **Proof mode matters.** With `proofMode: 'client'` (default), witnesses and proofs are generated entirely in the browser or Node.js process -- no private data leaves the device. With `proofMode: 'server'`, witness data is sent to the Shroud API; use only if you trust the API operator.

- **Memo encryption is authenticated.** AES-256-GCM provides both confidentiality and integrity. A tampered memo will fail GCM authentication rather than produce a corrupted note.

- **Deposit amounts are public.** The ERC20 `transferFrom` call is a standard on-chain transaction. Privacy begins after deposit. Avoid depositing unique amounts that could be correlated with later withdrawals.

- **Recipient public keys must include both coordinates.** The JSON `{"x": "...", "y": "..."}` format is required for private transfers because ECDH needs the full Baby Jubjub curve point to encrypt the note memo.

- **Baby Jubjub is not BN254 G1.** These are different curves. Baby Jubjub is embedded inside BN254's scalar field. The SDK uses circomlibjs for all Baby Jubjub operations; EVM `ecAdd`/`ecMul` precompiles cannot be used for Baby Jubjub arithmetic.

- **Nullifiers include the leaf index.** The nullifier formula `Poseidon(nullifier_preimage, secret, leaf_index)` ensures unique nullifiers even if key material is accidentally reused across deposits.

---

## How It Works

The SDK implements a shielded pool privacy system with three cryptographic layers:

**1. Pedersen Commitments** on the Baby Jubjub curve hide token amounts using additive homomorphism:

```
C = amount * G + blinding * H
```

When transferring, the circuit verifies `C_input == C_output1 + C_output2` using in-circuit BabyAdd -- proving amounts balance without revealing them. Generators G and H are independently generated (H via `HashToCurve("zktoken_pedersen_h")`) so nobody knows the discrete log relationship between them.

**2. Poseidon Hashing** creates compact note commitments stored in an on-chain Merkle tree (depth 20, supporting up to 1,048,576 commitments):

```
note_commitment = Poseidon(pedersen.x, pedersen.y, secret, nullifier_preimage, owner_pk.x)
```

**3. Groth16 ZK Proofs** over BN254 prove transaction validity without revealing private data. The on-chain verifier contract only sees 4 public signals: the Merkle root, a nullifier hash, and output note commitments.

**Double-spend prevention** uses nullifiers: `Poseidon(nullifier_preimage, secret, leaf_index)`. Spending a note reveals its unique nullifier, which the contract records in a spent-set. Attempting to spend the same note again produces the same nullifier and is rejected.

**Note discovery** works through encrypted memos. The sender generates an ephemeral Baby Jubjub keypair, performs ECDH with the recipient's public key to derive a shared AES-256-GCM key, and encrypts the note details (amount, blinding, secret, nullifier_preimage). The 188-byte encrypted memo is posted as calldata. Recipients scan events by trial-decrypting each memo -- if GCM authentication succeeds, the note belongs to them.

---

## License

[MIT](./LICENSE)
