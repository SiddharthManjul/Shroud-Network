interface StorageAdapter {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    keys(prefix: string): Promise<string[]>;
}
interface ShroudConfig {
    /** Optional API key for Shroud hosted services */
    apiKey?: string;
    /** Network to connect to */
    network: 'avalanche' | 'fuji' | 'custom';
    /** Override RPC endpoint (required for 'custom' network) */
    rpcUrl?: string;
    /** Override Shroud API base URL */
    apiUrl?: string;
    /** 'client': generate proofs locally via snarkjs (default); 'server': delegate to Shroud API */
    proofMode?: 'client' | 'server';
    /** Storage backend for notes and wallet data. Defaults to MemoryStorage. */
    storage?: StorageAdapter;
    /** Base URL for fetching circuit WASM + zkey files (for client-side proofs) */
    circuitBaseUrl?: string;
}
/**
 * A Shroud wallet identity — the developer-facing handle for a keypair.
 * The private key is never exposed here; it lives in encrypted internal state.
 */
interface ShroudWallet {
    /** Hex string of the Baby Jubjub public key x-coordinate — unique wallet identifier */
    address: string;
    /** Full Baby Jubjub public key as [x, y] field elements */
    publicKey: [bigint, bigint];
}
interface DepositOptions {
    /** ERC20 token symbol (e.g. "USDC") or contract address */
    token: string;
    /** Amount in token base units (e.g. 1_000_000n for 1 USDC with 6 decimals) */
    amount: number | bigint;
    wallet: ShroudWallet;
    /** ethers.js v6 Signer that holds the ERC20 tokens */
    signer: EthersSigner;
}
interface TransferOptions {
    /** Recipient's public key — hex x-coordinate string, or JSON "{x, y}" */
    to: string;
    /** Amount in token base units */
    amount: number | bigint;
    wallet: ShroudWallet;
    /** Token symbol or address; defaults to first token with sufficient balance */
    token?: string;
}
interface WithdrawOptions {
    /** Amount in token base units */
    amount: number | bigint;
    /** EVM address to receive the ERC20 tokens */
    recipient: string;
    wallet: ShroudWallet;
    /** Token symbol or address */
    token?: string;
    /** ethers.js v6 Signer — required for direct (non-relay) withdrawals */
    signer?: EthersSigner;
}
interface TransactionResult {
    txHash: string;
    blockNumber: number;
    status: 'success' | 'failed';
    type: 'deposit' | 'transfer' | 'withdraw';
}
interface ShieldedBalance {
    /** Token symbol */
    token: string;
    tokenAddress: string;
    shieldedAmount: bigint;
    noteCount: number;
}
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
interface NoteEvent {
    token: string;
    amount: bigint;
    leafIndex: number;
    blockNumber: number;
    type: 'received' | 'change';
}
interface EthersSigner {
    getAddress(): Promise<string>;
    sendTransaction(tx: EthersTransactionRequest): Promise<EthersTransactionResponse>;
    provider?: EthersProvider | null;
}
interface EthersProvider {
    getBlockNumber(): Promise<number>;
    call(tx: EthersTransactionRequest): Promise<string>;
    estimateGas(tx: EthersTransactionRequest): Promise<bigint>;
    getTransactionReceipt(hash: string): Promise<EthersTransactionReceipt | null>;
}
interface EthersTransactionRequest {
    to?: string;
    from?: string;
    data?: string;
    value?: bigint;
    gasLimit?: bigint;
}
interface EthersTransactionResponse {
    hash: string;
    wait(): Promise<EthersTransactionReceipt>;
}
interface EthersTransactionReceipt {
    hash: string;
    blockNumber: number;
    status: number | null;
    logs: EthersLog[];
}
interface EthersLog {
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
}

/**
 * ShroudClient — primary facade for the @shroud/sdk.
 *
 * Orchestrates: wallet management, deposits, private transfers,
 * withdrawals, balance queries, note syncing, and real-time events.
 */

declare class ShroudClient {
    private readonly config;
    private readonly api;
    private readonly storage;
    private readonly prover;
    private ws;
    /** Per-pool Merkle tree instances */
    private readonly merkleTrees;
    constructor(config: ShroudConfig);
    createWallet(seed?: string | Uint8Array): Promise<ShroudWallet>;
    restoreWallet(privateKeyHex: string): Promise<ShroudWallet>;
    exportWallet(wallet: ShroudWallet): string;
    deposit(options: DepositOptions): Promise<TransactionResult>;
    transfer(options: TransferOptions): Promise<TransactionResult>;
    withdraw(options: WithdrawOptions): Promise<TransactionResult>;
    getBalance(wallet: ShroudWallet, token?: string): Promise<ShieldedBalance>;
    getBalances(wallet: ShroudWallet): Promise<ShieldedBalance[]>;
    /**
     * Scan on-chain memo events and trial-decrypt with the wallet's private key.
     * Newly discovered notes are saved to storage.
     */
    sync(wallet: ShroudWallet): Promise<void>;
    getSupportedTokens(): Promise<TokenInfo[]>;
    getPoolInfo(token: string): Promise<PoolInfo>;
    /**
     * Subscribe to real-time note-received events for a wallet.
     * Returns an unsubscribe function.
     */
    onNoteReceived(wallet: ShroudWallet, cb: (note: NoteEvent) => void): () => void;
    destroy(): void;
    private defaultStorage;
    private resolveToken;
    private getProvider;
    private syncMerkleTree;
    private selectNote;
    private loadUnspentNotes;
    private saveNote;
    private markNoteSpent;
    private submitWithdrawDirect;
}

/**
 * Base error class for all Shroud SDK errors.
 * Always carries a machine-readable `code` alongside the human message.
 */
declare class ShroudError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * The wallet has no unspent note with a value large enough to cover
 * the requested transfer or withdrawal amount.
 */
declare class InsufficientBalanceError extends ShroudError {
    readonly required: bigint;
    readonly available: bigint;
    constructor(required: bigint, available: bigint, token?: string);
}
/**
 * The provided private key or seed is not a valid Baby Jubjub scalar.
 */
declare class InvalidKeyError extends ShroudError {
    constructor(detail?: string);
}
/**
 * An on-chain or RPC request failed.
 */
declare class NetworkError extends ShroudError {
    readonly statusCode: number | undefined;
    constructor(message: string, statusCode?: number);
}
/**
 * Groth16 witness generation or proof generation failed.
 */
declare class ProofGenerationError extends ShroudError {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
/**
 * The relay server rejected or failed to submit the transaction.
 */
declare class RelayError extends ShroudError {
    readonly relayCode: string | undefined;
    constructor(message: string, relayCode?: string);
}
/**
 * A valid API key is required for the requested operation but was not provided.
 */
declare class ApiKeyError extends ShroudError {
    constructor(operation?: string);
}
/**
 * The requested token is not supported by the Shroud deployment.
 */
declare class UnsupportedTokenError extends ShroudError {
    readonly token: string;
    constructor(token: string);
}

/**
 * In-memory storage adapter. Data is lost when the process exits.
 * Safe to use in Node.js and browser environments; ideal for testing.
 */
declare class MemoryStorage implements StorageAdapter {
    private readonly store;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    keys(prefix: string): Promise<string[]>;
    /** Wipe all stored data — useful in tests */
    clear(): void;
    get size(): number;
}

/**
 * IndexedDB-backed storage adapter for browser environments.
 * Falls back gracefully — callers should only instantiate this in environments
 * where `indexedDB` is available.
 *
 * The database is opened lazily on the first operation.
 */
declare class IndexedDBStorage implements StorageAdapter {
    private db;
    private readonly dbName;
    constructor(dbName?: string);
    private openDB;
    private transaction;
    private idbRequest;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    keys(prefix: string): Promise<string[]>;
    /**
     * Close the underlying IDBDatabase connection.
     * Subsequent operations will re-open it automatically.
     */
    close(): void;
}

/**
 * Incremental Poseidon Merkle tree — client-side implementation.
 *
 * Mirrors the on-chain IncrementalMerkleTree.sol behaviour exactly:
 * - Append-only, depth 20 (2^20 = 1,048,576 leaves)
 * - Poseidon(left, right) for internal nodes
 * - Zero values: zero[0] = 0, zero[i] = Poseidon(zero[i-1], zero[i-1])
 *
 * Used to reconstruct the tree from Deposit/Transfer events and to
 * produce Merkle inclusion proofs for the ZK circuits.
 */
interface MerkleProof {
    /** The leaf value being proven */
    leaf: bigint;
    /** Leaf index (0-based) */
    leafIndex: number;
    /** Sibling hashes, from leaf level up to root */
    path: bigint[];
    /** 0 = leaf is left child, 1 = leaf is right child, at each level */
    indices: number[];
    /** Computed root */
    root: bigint;
}
declare class MerkleTree {
    /** All inserted leaves in order */
    private readonly leaves;
    /**
     * filled_subtrees[i] = the rightmost complete subtree of depth i
     * Used for O(log n) insertion (same as on-chain contract).
     */
    private filledSubtrees;
    private currentRoot;
    private readonly depth;
    private poseidon;
    private zeros;
    private initialised;
    constructor(depth?: number);
    init(): Promise<void>;
    /** Insert a new commitment leaf. Returns the leaf index. */
    insert(commitment: bigint): Promise<number>;
    /** Bulk-insert many commitments efficiently. */
    insertMany(commitments: bigint[]): Promise<void>;
    /** Build a Merkle inclusion proof for the leaf at `leafIndex`. */
    getProof(leafIndex: number): Promise<MerkleProof>;
    get root(): bigint;
    get size(): number;
    getLeaf(index: number): bigint | undefined;
    /** Verify a Merkle proof against the current root */
    verify(proof: MerkleProof): Promise<boolean>;
    /**
     * Build all nodes at a given level.
     * level=0 → leaves, level=1 → parents of leaves, etc.
     */
    private buildLevelNodes;
    private hash2;
    private assertInitialised;
}

/**
 * Wallet module — self-contained Baby Jubjub keypair management.
 *
 * All Baby Jubjub operations use circomlibjs directly so this package
 * has no dependency on the monorepo's client/lib/zktoken/* modules.
 */

/** BN254 scalar field prime */
declare const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** Baby Jubjub subgroup order */
declare const SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
interface WalletState {
    keypair: {
        privateKey: bigint;
        publicKey: [bigint, bigint];
    };
    /** Per-token note storage: tokenAddress (lowercase) → serialised notes JSON */
    notesByToken: Map<string, InternalNote[]>;
}
/** Minimal in-process note — stored only in memory (or serialised to StorageAdapter by client.ts) */
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
/**
 * Create a new random wallet. Uses CSPRNG internally.
 */
declare function createRandomWallet(): Promise<ShroudWallet>;
/**
 * Deterministically derive a wallet from a seed phrase or byte array.
 * The same seed always produces the same keypair.
 */
declare function createWalletFromSeed(seed: string | Uint8Array): Promise<ShroudWallet>;
/**
 * Restore a wallet from a hex-encoded private key string.
 */
declare function restoreWallet(privateKeyHex: string): Promise<ShroudWallet>;
/** Export private key as a 0x-prefixed hex string */
declare function exportWallet(wallet: ShroudWallet): string;
/** Parse a recipient public key from a hex address or JSON string */
declare function parseRecipientPublicKey(input: string): [bigint, bigint];
/**
 * Baby Jubjub ECDH: shared_secret = my_priv * their_pub
 * Returns the shared EC point [x, y].
 */
declare function ecdh(myPrivateKey: bigint, theirPublicKey: [bigint, bigint]): Promise<[bigint, bigint]>;
/**
 * Create a new in-memory note for a deposit or received transfer.
 * Computes the Pedersen commitment and note commitment from scratch.
 */
declare function createNote(amount: bigint, ownerPublicKey: [bigint, bigint], tokenAddress: string, createdAtBlock: number): Promise<Omit<InternalNote, 'leafIndex' | 'nullifier'>>;
/**
 * Compute the nullifier for a note.
 * nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
 */
declare function computeNullifier(nullifierPreimage: bigint, secret: bigint, leafIndex: number): Promise<bigint>;
declare function serialiseNote(note: InternalNote): string;
declare function deserialiseNote(json: string): InternalNote;

/**
 * Client-side Groth16 proof generation using snarkjs.
 *
 * Fetches WASM and zkey files from a configurable CDN base URL.
 * Supports both transfer and withdraw circuits.
 */

interface Groth16Proof {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
}
interface TransferProofInputs {
    note: InternalNote;
    merklePath: MerkleProof;
    ownerPrivateKey: bigint;
    recipientNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
    changeNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
    merkleRoot: bigint;
}
interface WithdrawProofInputs {
    note: InternalNote;
    merklePath: MerkleProof;
    ownerPrivateKey: bigint;
    withdrawalAmount: bigint;
    recipientAddress: string;
    changeNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
    merkleRoot: bigint;
}
interface ProofResult {
    proof: Groth16Proof;
    /** Public signals in order: [merkle_root, nullifier_hash, ...] */
    publicSignals: string[];
}
declare class ProofGenerator {
    private readonly circuitBaseUrl;
    constructor(circuitBaseUrl: string);
    generateTransferProof(inputs: TransferProofInputs): Promise<ProofResult>;
    generateWithdrawProof(inputs: WithdrawProofInputs): Promise<ProofResult>;
    private generateProof;
}

/**
 * Encrypted memo protocol.
 *
 * On-chain bytes layout (per CLAUDE.md):
 *   ek_pub (32B compressed x-coord) || nonce (12B) || ciphertext (128B) || GCM tag (16B)
 *   = 188 bytes total
 *
 * Encryption:
 *   1. Sender generates ephemeral Baby Jubjub keypair (ek_priv, ek_pub)
 *   2. Shared secret = ECDH(ek_priv, recipient_pub)  → Baby Jubjub point
 *   3. AES key = SHA-256(shared_secret.x || shared_secret.y)  (32 bytes)
 *   4. Plaintext = ABI-packed (amount, blinding, secret, nullifier_preimage) = 4×32 = 128 bytes
 *   5. Encrypt with AES-256-GCM
 *
 * Decryption (scanning):
 *   1. Decode ek_pub.x from first 32 bytes
 *   2. Shared secret = ECDH(my_priv, ek_pub)
 *   3. Derive AES key, attempt GCM decrypt
 *   4. If auth tag passes → note is mine → decode plaintext
 */

declare const MEMO_BYTES: number;
/**
 * Encrypt a note's private fields into an on-chain memo blob.
 * Returns a hex string (without 0x prefix).
 */
declare function encryptMemo(amount: bigint, blinding: bigint, secret: bigint, nullifierPreimage: bigint, recipientPublicKey: [bigint, bigint]): Promise<string>;
/**
 * Attempt to decrypt a memo using the recipient's private key.
 * Returns null if the memo is not addressed to this key (GCM auth fails).
 */
declare function tryDecryptMemo(memoHex: string, myPrivateKey: bigint): Promise<{
    amount: bigint;
    blinding: bigint;
    secret: bigint;
    nullifierPreimage: bigint;
} | null>;
/**
 * Scan a batch of raw memo hex strings and return all that decrypt successfully.
 */
declare function scanMemos(memos: Array<{
    hex: string;
    meta: Record<string, unknown>;
}>, myPrivateKey: bigint): Promise<Array<{
    amount: bigint;
    blinding: bigint;
    secret: bigint;
    nullifierPreimage: bigint;
    meta: Record<string, unknown>;
}>>;

interface NetworkConfig {
    chainId: number;
    rpcUrl: string;
    /** ZkTokenFactory registry contract — set after deployment */
    poolRegistryAddress: string;
    /** Default relayer endpoint */
    relayerUrl: string;
    /** Indexer API base URL for event scanning */
    indexerUrl: string;
    /** Base URL for fetching circuit WASM + zkey files */
    circuitBaseUrl: string;
}
declare const NETWORKS: Record<string, NetworkConfig>;
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

export { ApiKeyError, FIELD_PRIME, IndexedDBStorage, InsufficientBalanceError, InvalidKeyError, MEMO_BYTES, MemoryStorage, MerkleTree, NETWORKS, NetworkError, ProofGenerationError, ProofGenerator, RelayError, SUBGROUP_ORDER, ShroudClient, ShroudError, UnsupportedTokenError, computeNullifier, createNote, createRandomWallet, createWalletFromSeed, deserialiseNote, ecdh, encryptMemo, exportWallet, parseRecipientPublicKey, restoreWallet, scanMemos, serialiseNote, tryDecryptMemo };
export type { DepositOptions, EthersLog, EthersProvider, EthersSigner, EthersTransactionReceipt, EthersTransactionRequest, EthersTransactionResponse, Groth16Proof, InternalNote, MerkleProof, NetworkConfig, NoteEvent, PoolInfo, ProofResult, ResolvedConfig, ShieldedBalance, ShroudConfig, ShroudWallet, StorageAdapter, TokenInfo, TransactionResult, TransferOptions, TransferProofInputs, WalletState, WithdrawOptions, WithdrawProofInputs };
