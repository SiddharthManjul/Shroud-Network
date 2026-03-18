// ─── Public-facing developer types ───────────────────────────────────────────

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export interface ShroudConfig {
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
export interface ShroudWallet {
  /** Hex string of the Baby Jubjub public key x-coordinate — unique wallet identifier */
  address: string;
  /** Full Baby Jubjub public key as [x, y] field elements */
  publicKey: [bigint, bigint];
}

export interface DepositOptions {
  /** ERC20 token symbol (e.g. "USDC") or contract address */
  token: string;
  /** Amount in token base units (e.g. 1_000_000n for 1 USDC with 6 decimals) */
  amount: number | bigint;
  wallet: ShroudWallet;
  /** ethers.js v6 Signer that holds the ERC20 tokens */
  signer: EthersSigner;
}

export interface TransferOptions {
  /** Recipient's public key — hex x-coordinate string, or JSON "{x, y}" */
  to: string;
  /** Amount in token base units */
  amount: number | bigint;
  wallet: ShroudWallet;
  /** Token symbol or address; defaults to first token with sufficient balance */
  token?: string;
}

export interface WithdrawOptions {
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

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
  status: 'success' | 'failed';
  type: 'deposit' | 'transfer' | 'withdraw';
}

export interface ShieldedBalance {
  /** Token symbol */
  token: string;
  tokenAddress: string;
  shieldedAmount: bigint;
  noteCount: number;
}

export interface TokenInfo {
  symbol: string;
  address: string;
  poolAddress: string;
  decimals: number;
}

export interface PoolInfo {
  token: TokenInfo;
  totalDeposited: bigint;
  activeCommitments: number;
  merkleRoot: string;
}

export interface NoteEvent {
  token: string;
  amount: bigint;
  leafIndex: number;
  blockNumber: number;
  type: 'received' | 'change';
}

// ─── Minimal ethers.js interfaces (avoid hard dep on ethers types) ────────────

export interface EthersSigner {
  getAddress(): Promise<string>;
  sendTransaction(tx: EthersTransactionRequest): Promise<EthersTransactionResponse>;
  provider?: EthersProvider | null;
}

export interface EthersProvider {
  getBlockNumber(): Promise<number>;
  call(tx: EthersTransactionRequest): Promise<string>;
  estimateGas(tx: EthersTransactionRequest): Promise<bigint>;
  getTransactionReceipt(hash: string): Promise<EthersTransactionReceipt | null>;
}

export interface EthersTransactionRequest {
  to?: string;
  from?: string;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
}

export interface EthersTransactionResponse {
  hash: string;
  wait(): Promise<EthersTransactionReceipt>;
}

export interface EthersTransactionReceipt {
  hash: string;
  blockNumber: number;
  status: number | null;
  logs: EthersLog[];
}

export interface EthersLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
}
