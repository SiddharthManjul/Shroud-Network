/**
 * index.ts — Public SDK API
 *
 * Re-exports everything a consumer of the ZkToken SDK needs.
 */

// Crypto singletons
export { initCrypto, getBabyJub, getPoseidon } from "./crypto";

// Types
export type {
  Note,
  NoteMemoData,
  BabyJubKeyPair,
  BabyJubPoint,
  MerklePath,
  Groth16Proof,
  TransferProofResult,
  WithdrawProofResult,
  DepositParams,
  TransferParams,
  WithdrawParams,
  RelayTransferParams,
  RelayWithdrawParams,
  RelayUnifiedTransferParams,
  RelayUnifiedWithdrawParams,
  RelayResponse,
  EthersSigner,
  EthersProvider,
  EthersTransactionResponse,
  PoolType,
  PoolConfig,
  V1PoolConfig,
  UnifiedPoolConfig,
  CircuitPaths,
} from "./types";
export { SHIELDED_POOL_ABI } from "./abi/shielded-pool";
export { TEST_TOKEN_ABI } from "./abi/test-token";
export { TRANSFER_VERIFIER_ABI } from "./abi/transfer-verifier";
export { WITHDRAW_VERIFIER_ABI } from "./abi/withdraw-verifier";
export { PAYMASTER_ABI } from "./abi/paymaster";

// KeyManager
export { KeyManager, SUBGROUP_ORDER } from "./keys";

// NoteManager
export {
  createNote,
  finaliseNote,
  noteFromMemoData,
  computePedersenCommitment,
  computeNoteCommitment,
  computeNullifier,
  computeAssetId,
  encodeNote,
  decodeNote,
  NoteStore,
} from "./note";

// MerkleTreeSync
export { MerkleTreeSync, TREE_DEPTH } from "./merkle";

// MemoEncryptor
export {
  encryptMemo,
  decryptMemo,
  scanMemos,
  MEMO_BYTES,
} from "./encryption";
export type { MemoEvent } from "./encryption";

// ProofGenerator
export {
  generateTransferProof,
  generateWithdrawProof,
  encodeProofForContract,
  getProofComponents,
} from "./prover";
export type { TransferProofParams, WithdrawProofParams } from "./prover";

// Pool config
export { getPoolConfig } from "./pool-config";

// TransactionBuilder
export {
  deposit,
  waitForDeposit,
  transfer,
  withdraw,
  relayTransfer,
  relayWithdraw,
  scanChainForNotes,
  scanNotesFromRelay,
  scanNotesFromIndexer,
  // Unified pool
  depositUnified,
  waitForUnifiedDeposit,
  relayTransferUnified,
  relayWithdrawUnified,
  scanChainForNotesUnified,
} from "./transaction";

// Indexer (Envio HyperIndex GraphQL client)
export {
  fetchMerkleLeaves,
  fetchMemoEvents,
  fetchPoolState,
} from "./indexer";
export type {
  MerkleLeafData,
  IndexerMemoEvent,
  PoolStateData,
} from "./indexer";

// Notification Relay
export {
  postNotification,
  postSelfNotification,
  fetchNotifications,
  deleteNotification,
  clearNotifications,
  deriveTag,
} from "./relay-notify";
export type {
  NotificationData,
  ReceivedNotification,
} from "./relay-notify";

// Key Vault (encrypted private key storage)
export {
  isPasskeySupported,
  getVaultStatus,
  storeWithPIN,
  storeWithPasskey,
  unlock,
  getPlaintextKeyForMigration,
  deleteVault,
  validatePIN,
  changePIN,
  switchMethod,
} from "./key-vault";
export type { VaultMethod, VaultData, VaultStatus } from "./key-vault";

// Utilities
export { bytesToHex, hexToBytes } from "./utils";
