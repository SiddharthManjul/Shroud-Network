// ─── @shroud/sdk public API ───────────────────────────────────────────────────

// Primary client
export { ShroudClient } from './client';

// Public types
export type {
  ShroudConfig,
  ShroudWallet,
  DepositOptions,
  TransferOptions,
  WithdrawOptions,
  TransactionResult,
  ShieldedBalance,
  TokenInfo,
  PoolInfo,
  NoteEvent,
  StorageAdapter,
  // Ethers interfaces (for TypeScript consumers without ethers installed)
  EthersSigner,
  EthersProvider,
  EthersTransactionRequest,
  EthersTransactionResponse,
  EthersTransactionReceipt,
  EthersLog,
} from './types';

// Errors
export {
  ShroudError,
  InsufficientBalanceError,
  InvalidKeyError,
  NetworkError,
  ProofGenerationError,
  RelayError,
  ApiKeyError,
  UnsupportedTokenError,
} from './errors';

// Storage adapters
export { MemoryStorage } from './storage/memory';
export { IndexedDBStorage } from './storage/indexeddb';

// Advanced / escape hatches
export { MerkleTree } from './merkle';
export type { MerkleProof } from './merkle';
export { ProofGenerator } from './prover';
export type { Groth16Proof, TransferProofInputs, WithdrawProofInputs, ProofResult } from './prover';
export { encryptMemo, tryDecryptMemo, scanMemos, MEMO_BYTES } from './encryption';
export {
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
} from './wallet';
export type { WalletState, InternalNote } from './wallet';

// Network config
export { NETWORKS } from './config';
export type { NetworkConfig, ResolvedConfig } from './config';
