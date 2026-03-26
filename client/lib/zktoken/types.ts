/**
 * types.ts — Shared type definitions for the ZkToken Client SDK.
 *
 * The note model mirrors the on-chain Poseidon Merkle tree and the ZK circuit
 * signal layout. All bigint values are field elements in the BN254 scalar field
 * unless otherwise noted.
 */

// ─── Curve / cryptographic primitives ────────────────────────────────────────

/** A point on the Baby Jubjub curve (twisted Edwards form). */
export type BabyJubPoint = [bigint, bigint];

/** A Baby Jubjub keypair. The private key is a scalar < subgroup order. */
export interface BabyJubKeyPair {
  /** Private key: random scalar < L (Baby Jubjub subgroup order) */
  privateKey: bigint;
  /** Public key: privateKey * Base8 */
  publicKey: BabyJubPoint;
}

// ─── Note ────────────────────────────────────────────────────────────────────

/**
 * A private token holding inside the shielded pool.
 *
 * Two derived on-chain values:
 *   pedersenCommitment = amount * G + blinding * H   (Baby Jubjub EC point)
 *   noteCommitment     = Poseidon(ped.x, ped.y, secret, nullifierPreimage, ownerPk.x)
 *
 * The nullifier is derived when the note is spent:
 *   nullifier = Poseidon(nullifierPreimage, secret, leafIndex)
 */
export interface Note {
  /** Token amount (uint64 range: 0 to 2^64 - 1). */
  amount: bigint;
  /** Random blinding factor for Pedersen commitment. */
  blinding: bigint;
  /** Random 31-byte secret known only to the note owner. */
  secret: bigint;
  /** Random 31-byte value, separate from secret, never appears on-chain. */
  nullifierPreimage: bigint;
  /** Baby Jubjub public key of the note owner (x, y). */
  ownerPublicKey: BabyJubPoint;

  // ── Derived fields (computed at creation) ──────────────────────────────────
  /** Pedersen commitment point: amount * G + blinding * H. */
  pedersenCommitment: BabyJubPoint;
  /** Note commitment (Merkle leaf): Poseidon(ped.x, ped.y, secret, nullifierPreimage, ownerPk.x). */
  noteCommitment: bigint;
  /** Nullifier: Poseidon(nullifierPreimage, secret, leafIndex). Set after leafIndex is known. */
  nullifier: bigint;

  // ── On-chain reference ─────────────────────────────────────────────────────
  /** Leaf index in the on-chain Merkle tree. */
  leafIndex: number;
  /** Whether this note has been spent (nullifier revealed). */
  spent: boolean;
  /** ERC20 token contract address this note represents. */
  tokenAddress: string;
  /** Block number when this note was created (for re-sync optimisation). */
  createdAtBlock: number;
  /** Asset ID for unified pool notes: Poseidon(tokenAddress). Absent for V1 notes. */
  assetId?: bigint;
}

/** Plaintext note data encoded in the encrypted memo (128 bytes on-chain). */
export interface NoteMemoData {
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
}

// ─── Merkle ───────────────────────────────────────────────────────────────────

/** Merkle inclusion proof for a single leaf. */
export interface MerklePath {
  /** Root the proof is relative to. */
  root: bigint;
  /** Sibling hashes from leaf to root (length = tree depth). */
  pathElements: bigint[];
  /** Path direction bits: 0 = current node is left child, 1 = right child (length = tree depth). */
  pathIndices: number[];
  /** Leaf index in the tree. */
  leafIndex: number;
}

// ─── Proofs ───────────────────────────────────────────────────────────────────

/** Raw Groth16 proof components as returned by snarkjs. */
export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

/** Result of a transfer proof generation. */
export interface TransferProofResult {
  /** ABI-encoded proof bytes (256 bytes) for ShieldedPool.transfer(). */
  proofBytes: Uint8Array;
  /** Public signals: [merkleRoot, nullifierHash, newCommitment1, newCommitment2]. */
  publicSignals: [bigint, bigint, bigint, bigint];
  /** Recipient output note (to share with recipient via encrypted memo). */
  recipientNote: Note;
  /** Change note returned to sender. */
  changeNote: Note;
  /** Raw proof for debugging / alternative encoding. */
  rawProof: Groth16Proof;
}

/** Result of a withdraw proof generation. */
export interface WithdrawProofResult {
  /** ABI-encoded proof bytes (256 bytes) for ShieldedPool.withdraw(). */
  proofBytes: Uint8Array;
  /** Public signals: 4 for V1, 5 for unified (adds assetId). */
  publicSignals: bigint[];
  /** Change note (undefined for full withdrawals). */
  changeNote?: Note;
  /** Raw proof for debugging / alternative encoding. */
  rawProof: Groth16Proof;
}

// ─── Transaction parameters ───────────────────────────────────────────────────

export interface DepositParams {
  /** EthersJS signer for sending the transaction. */
  signer: EthersSigner;
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** ERC20 token address. */
  tokenAddress: string;
  /** Amount to deposit (in token base units). */
  amount: bigint;
  /** Owner's Baby Jubjub public key for the new note. */
  ownerPublicKey: BabyJubPoint;
}

export interface TransferParams {
  /** EthersJS signer. */
  signer: EthersSigner;
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** EthersJS provider for event querying. */
  provider: EthersProvider;
  /** Note to spend. */
  inputNote: Note;
  /** Amount to send to recipient. */
  transferAmount: bigint;
  /** Recipient's Baby Jubjub public key. */
  recipientPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub public key (for change note). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key (needed to prove ownership in circuit). */
  senderPrivateKey: bigint;
  /** Path to transfer.wasm (URL in browser, filesystem path in Node). */
  wasmPath: string;
  /** Path to transfer_final.zkey. */
  zkeyPath: string;
}

export interface WithdrawParams {
  /** EthersJS signer. */
  signer: EthersSigner;
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** EthersJS provider for event querying. */
  provider: EthersProvider;
  /** Note to spend. */
  inputNote: Note;
  /** Amount to withdraw (0 < withdrawAmount <= inputNote.amount). */
  withdrawAmount: bigint;
  /** EVM recipient address for the released tokens. */
  recipient: string;
  /** Sender's public key (for change note if partial withdrawal). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key (needed to prove ownership in circuit). */
  senderPrivateKey: bigint;
  /** Path to withdraw.wasm. */
  wasmPath: string;
  /** Path to withdraw_final.zkey. */
  zkeyPath: string;
}

// ─── Minimal ethers type aliases (avoids importing ethers at top-level) ───────

/** Minimal interface for an ethers v6 Signer. */
export interface EthersSigner {
  getAddress(): Promise<string>;
  sendTransaction(tx: EthersTransactionRequest): Promise<EthersTransactionResponse>;
  provider: EthersProvider | null;
}

/** Minimal interface for an ethers v6 Provider. */
export interface EthersProvider {
  getLogs(filter: EthersLogFilter): Promise<EthersLog[]>;
  getBlockNumber(): Promise<number>;
  getNetwork(): Promise<{ chainId: bigint }>;
  getCode(address: string, blockTag?: number | string): Promise<string>;
}

export interface EthersTransactionRequest {
  to?: string;
  data?: string;
  value?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
}

export interface EthersTransactionResponse {
  hash: string;
  wait(): Promise<EthersTransactionReceipt>;
}

export interface EthersTransactionReceipt {
  blockNumber: number;
  status: number | null;
}

export interface EthersLogFilter {
  address?: string;
  topics?: (string | null | string[])[];
  fromBlock?: number | string;
  toBlock?: number | string;
}

export interface EthersLog {
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
}

// ─── Relay (Paymaster) types ─────────────────────────────────────────────────

/** Parameters for a relayed private transfer (no signer needed). */
export interface RelayTransferParams {
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** EthersJS provider for Merkle tree sync (read-only). */
  provider: EthersProvider;
  /** Note to spend. */
  inputNote: Note;
  /** Amount to send to recipient. */
  transferAmount: bigint;
  /** Recipient's Baby Jubjub public key. */
  recipientPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub public key (for change note). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key (needed to prove ownership in circuit). */
  senderPrivateKey: bigint;
  /** Path to transfer.wasm (URL in browser, filesystem path in Node). */
  wasmPath: string;
  /** Path to transfer_final.zkey. */
  zkeyPath: string;
  /** Relay API URL (defaults to "/api/relay"). */
  relayUrl?: string;
  /** Paymaster address (sent to relay so it knows which paymaster to use). */
  paymasterAddress?: string;
}

/** Parameters for a relayed withdrawal (no signer needed). */
export interface RelayWithdrawParams {
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** EthersJS provider for Merkle tree sync (read-only). */
  provider: EthersProvider;
  /** Note to spend. */
  inputNote: Note;
  /** Amount to withdraw. */
  withdrawAmount: bigint;
  /** EVM recipient address for the released tokens. */
  recipient: string;
  /** Sender's public key (for change note if partial withdrawal). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key. */
  senderPrivateKey: bigint;
  /** Path to withdraw.wasm. */
  wasmPath: string;
  /** Path to withdraw_final.zkey. */
  zkeyPath: string;
  /** Relay API URL (defaults to "/api/relay"). */
  relayUrl?: string;
  /** Paymaster address (sent to relay so it knows which paymaster to use). */
  paymasterAddress?: string;
}

/** Parameters for a relayed deposit via MetaTxRelayer (gasless, EIP-712 signed). */
export interface RelayDepositParams {
  /** EthersJS signer for EIP-712 signing. */
  signer: EthersSigner;
  /** EthersJS provider for reading nonce + chain data. */
  provider: EthersProvider;
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** ERC20 token address. */
  tokenAddress: string;
  /** Amount to deposit in whole token units. */
  amount: bigint;
  /** Owner's Baby Jubjub public key for the new note. */
  ownerPublicKey: BabyJubPoint;
  /** Relay fee in whole token units (deducted from user's balance). */
  fee: bigint;
  /** MetaTxRelayer contract address. */
  metaTxRelayerAddress: string;
  /** Relay API URL (defaults to "/api/relay"). */
  relayUrl?: string;
}

/** Parameters for a relayed withdrawal via MetaTxRelayer (fee in ERC20, no AVAX needed). */
export interface RelayMetaWithdrawParams {
  /** EthersJS signer for EIP-712 signing. */
  signer: EthersSigner;
  /** EthersJS provider for Merkle tree sync + chain data. */
  provider: EthersProvider;
  /** ShieldedPool contract address. */
  poolAddress: string;
  /** Note to spend. */
  inputNote: Note;
  /** Amount to withdraw. */
  withdrawAmount: bigint;
  /** EVM recipient address for the released tokens. */
  recipient: string;
  /** Sender's Baby Jubjub public key (for change note). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key. */
  senderPrivateKey: bigint;
  /** Path to withdraw.wasm. */
  wasmPath: string;
  /** Path to withdraw_final.zkey. */
  zkeyPath: string;
  /** Relay fee in whole token units (deducted from withdrawal). */
  fee: bigint;
  /** MetaTxRelayer contract address. */
  metaTxRelayerAddress: string;
  /** Relay API URL (defaults to "/api/relay"). */
  relayUrl?: string;
}

/** Response from the relay API. */
export interface RelayResponse {
  /** Transaction hash of the relayed transaction. */
  txHash: string;
  /** Block number the transaction was included in. */
  blockNumber: number;
  /** Transaction status (1 = success). */
  status: number;
}

// ─── Pool type / config ──────────────────────────────────────────────────────

/** Discriminator for V1 (single-token) vs unified (multi-asset) pools. */
export type PoolType = "v1" | "unified";

/** Circuit file paths for proof generation. */
export interface CircuitPaths {
  transferWasm: string;
  transferZkey: string;
  withdrawWasm: string;
  withdrawZkey: string;
}

/** V1 pool configuration (one pool per ERC20, depth 20). */
export interface V1PoolConfig {
  poolType: "v1";
  treeDepth: 20;
  circuitPaths: CircuitPaths;
}

/** Unified pool configuration (multi-asset, depth 24). */
export interface UnifiedPoolConfig {
  poolType: "unified";
  treeDepth: 24;
  assetId: bigint;
  tokenAddress: string;
  circuitPaths: CircuitPaths;
}

/** Discriminated union for pool configuration. */
export type PoolConfig = V1PoolConfig | UnifiedPoolConfig;

// ─── Unified pool relay params ───────────────────────────────────────────────

/** Parameters for a relayed unified transfer. */
export interface RelayUnifiedTransferParams {
  poolAddress: string;
  provider: EthersProvider;
  inputNote: Note;
  transferAmount: bigint;
  recipientPublicKey: BabyJubPoint;
  senderPublicKey: BabyJubPoint;
  senderPrivateKey: bigint;
  wasmPath: string;
  zkeyPath: string;
  assetId: bigint;
  relayUrl?: string;
}

/** Parameters for a relayed unified withdrawal. */
export interface RelayUnifiedWithdrawParams {
  poolAddress: string;
  provider: EthersProvider;
  inputNote: Note;
  withdrawAmount: bigint;
  recipient: string;
  senderPublicKey: BabyJubPoint;
  senderPrivateKey: bigint;
  wasmPath: string;
  zkeyPath: string;
  assetId: bigint;
  tokenAddress: string;
  relayUrl?: string;
}

// ─── ABIs ────────────────────────────────────────────────────────────────────
// Full JSON ABIs live in ./abi/. Re-exported here for backwards compatibility.

export { SHIELDED_POOL_ABI } from "./abi/shielded-pool";
export { TEST_TOKEN_ABI } from "./abi/test-token";
export { TRANSFER_VERIFIER_ABI } from "./abi/transfer-verifier";
export { WITHDRAW_VERIFIER_ABI } from "./abi/withdraw-verifier";
export { PAYMASTER_ABI } from "./abi/paymaster";
