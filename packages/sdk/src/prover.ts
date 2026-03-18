/**
 * Client-side Groth16 proof generation using snarkjs.
 *
 * Fetches WASM and zkey files from a configurable CDN base URL.
 * Supports both transfer and withdraw circuits.
 */

import { ProofGenerationError } from './errors';
import type { InternalNote } from './wallet';
import type { MerkleProof } from './merkle';

// ─── Proof types ──────────────────────────────────────────────────────────────

export interface Groth16Proof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
}

export interface TransferProofInputs {
  // Input note
  note: InternalNote;
  // Merkle inclusion proof for the input note
  merklePath: MerkleProof;
  // Owner private key (scalar)
  ownerPrivateKey: bigint;
  // Output note 1 (recipient)
  recipientNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
  // Output note 2 (change)
  changeNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
  // Current Merkle root
  merkleRoot: bigint;
}

export interface WithdrawProofInputs {
  // Input note
  note: InternalNote;
  // Merkle inclusion proof
  merklePath: MerkleProof;
  // Owner private key
  ownerPrivateKey: bigint;
  // Withdrawal amount (public)
  withdrawalAmount: bigint;
  // Recipient EVM address (public — hashed to field element)
  recipientAddress: string;
  // Change note (may have zero amount for full withdrawal)
  changeNote: Pick<InternalNote, 'amount' | 'blinding' | 'secret' | 'nullifierPreimage' | 'ownerPublicKey' | 'pedersenCommitment' | 'noteCommitment'>;
  // Current Merkle root
  merkleRoot: bigint;
}

export interface ProofResult {
  proof: Groth16Proof;
  /** Public signals in order: [merkle_root, nullifier_hash, ...] */
  publicSignals: string[];
}

// ─── Circuit asset cache ──────────────────────────────────────────────────────

const circuitCache = new Map<string, ArrayBuffer>();

async function fetchCircuitAsset(url: string): Promise<ArrayBuffer> {
  const cached = circuitCache.get(url);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ProofGenerationError(
      `Failed to fetch circuit asset from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  if (!response.ok) {
    throw new ProofGenerationError(
      `HTTP ${response.status} fetching circuit asset: ${url}`,
    );
  }

  const buffer = await response.arrayBuffer();
  circuitCache.set(url, buffer);
  return buffer;
}

// ─── snarkjs lazy loader ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SnarkJs = any;
let _snarkjs: SnarkJs | null = null;

async function getSnarkJs(): Promise<SnarkJs> {
  if (_snarkjs) return _snarkjs;
  _snarkjs = await import('snarkjs');
  return _snarkjs;
}

// ─── Helper: field element serialisation ─────────────────────────────────────

function fieldStr(v: bigint): string {
  return v.toString();
}

function addressToField(addr: string): bigint {
  // Keccak256(address) mod FIELD_PRIME to get a field element
  // For now use simple bigint conversion of the address bytes
  const clean = addr.toLowerCase().replace('0x', '').padStart(40, '0');
  return BigInt('0x' + clean) % 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
}

// ─── Witness builders ─────────────────────────────────────────────────────────

function buildTransferWitness(inputs: TransferProofInputs): Record<string, string | string[]> {
  const { note, merklePath, ownerPrivateKey, recipientNote, changeNote, merkleRoot } = inputs;

  return {
    // Public inputs
    merkle_root: fieldStr(merkleRoot),
    nullifier_hash: fieldStr(note.nullifier),
    new_commitment_1: fieldStr(recipientNote.noteCommitment),
    new_commitment_2: fieldStr(changeNote.noteCommitment),

    // Private: input note
    amount_in: fieldStr(note.amount),
    blinding_in: fieldStr(note.blinding),
    secret: fieldStr(note.secret),
    nullifier_preimage: fieldStr(note.nullifierPreimage),

    // Private: ownership
    owner_private_key: fieldStr(ownerPrivateKey),
    leaf_index: fieldStr(BigInt(note.leafIndex)),

    // Private: Merkle proof
    merkle_path: merklePath.path.map(fieldStr),
    path_indices: merklePath.indices.map(String),

    // Private: output notes
    amount_out_1: fieldStr(recipientNote.amount),
    amount_out_2: fieldStr(changeNote.amount),
    blinding_out_1: fieldStr(recipientNote.blinding),
    blinding_out_2: fieldStr(changeNote.blinding),
    secret_out_1: fieldStr(recipientNote.secret),
    secret_out_2: fieldStr(changeNote.secret),
    nullifier_preimage_out_1: fieldStr(recipientNote.nullifierPreimage),
    nullifier_preimage_out_2: fieldStr(changeNote.nullifierPreimage),
    owner_pk_out_1_x: fieldStr(recipientNote.ownerPublicKey[0]),
    owner_pk_out_1_y: fieldStr(recipientNote.ownerPublicKey[1]),
    owner_pk_out_2_x: fieldStr(changeNote.ownerPublicKey[0]),
    owner_pk_out_2_y: fieldStr(changeNote.ownerPublicKey[1]),
  };
}

function buildWithdrawWitness(inputs: WithdrawProofInputs): Record<string, string | string[]> {
  const { note, merklePath, ownerPrivateKey, withdrawalAmount, recipientAddress, changeNote, merkleRoot } = inputs;

  return {
    // Public inputs
    merkle_root: fieldStr(merkleRoot),
    nullifier_hash: fieldStr(note.nullifier),
    amount: fieldStr(withdrawalAmount),
    change_commitment: fieldStr(changeNote.noteCommitment),

    // Private: input note
    amount_in: fieldStr(note.amount),
    blinding_in: fieldStr(note.blinding),
    secret: fieldStr(note.secret),
    nullifier_preimage: fieldStr(note.nullifierPreimage),

    // Private: ownership
    owner_private_key: fieldStr(ownerPrivateKey),
    leaf_index: fieldStr(BigInt(note.leafIndex)),

    // Private: Merkle proof
    merkle_path: merklePath.path.map(fieldStr),
    path_indices: merklePath.indices.map(String),

    // Private: change note
    amount_change: fieldStr(changeNote.amount),
    blinding_change: fieldStr(changeNote.blinding),
    secret_change: fieldStr(changeNote.secret),
    nullifier_preimage_change: fieldStr(changeNote.nullifierPreimage),
    owner_pk_change_x: fieldStr(changeNote.ownerPublicKey[0]),
    owner_pk_change_y: fieldStr(changeNote.ownerPublicKey[1]),

    // Recipient (public — hashed into field)
    recipient_hash: fieldStr(addressToField(recipientAddress)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class ProofGenerator {
  constructor(private readonly circuitBaseUrl: string) {}

  async generateTransferProof(inputs: TransferProofInputs): Promise<ProofResult> {
    return this.generateProof('transfer', buildTransferWitness(inputs));
  }

  async generateWithdrawProof(inputs: WithdrawProofInputs): Promise<ProofResult> {
    return this.generateProof('withdraw', buildWithdrawWitness(inputs));
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async generateProof(
    circuitName: 'transfer' | 'withdraw',
    witness: Record<string, string | string[]>,
  ): Promise<ProofResult> {
    const base = this.circuitBaseUrl.replace(/\/$/, '');
    const wasmUrl = `${base}/${circuitName}/${circuitName}_js/${circuitName}.wasm`;
    const zkeyUrl = `${base}/${circuitName}/${circuitName}_final.zkey`;

    // Fetch circuit assets in parallel
    const [wasmBuffer, zkeyBuffer] = await Promise.all([
      fetchCircuitAsset(wasmUrl),
      fetchCircuitAsset(zkeyUrl),
    ]);

    const snarkjs = await getSnarkJs();

    let result: { proof: unknown; publicSignals: string[] };
    try {
      result = await snarkjs.groth16.fullProve(
        witness,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer),
      );
    } catch (err) {
      throw new ProofGenerationError(
        `Groth16 fullProve failed for ${circuitName}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawProof = result.proof as any;

    const proof: Groth16Proof = {
      pi_a: [String(rawProof.pi_a[0]), String(rawProof.pi_a[1])],
      pi_b: [
        [String(rawProof.pi_b[0][0]), String(rawProof.pi_b[0][1])],
        [String(rawProof.pi_b[1][0]), String(rawProof.pi_b[1][1])],
      ],
      pi_c: [String(rawProof.pi_c[0]), String(rawProof.pi_c[1])],
    };

    return { proof, publicSignals: result.publicSignals };
  }
}

/** Clear the in-memory circuit asset cache (useful in tests) */
export function clearCircuitCache(): void {
  circuitCache.clear();
}
