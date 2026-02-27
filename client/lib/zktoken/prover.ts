/**
 * prover.ts — ProofGenerator
 *
 * Generates Groth16 ZK proofs for private transfer and withdrawal operations
 * using snarkjs.groth16.fullProve().
 *
 * Key invariants enforced:
 *   Transfer:
 *     transferAmount + changeAmount == inputNote.amount          (amount conservation)
 *     recipientBlinding + changeBlinding == inputNote.blinding   (Pedersen conservation)
 *     changeBlinding = inputNote.blinding - recipientBlinding    (computed here)
 *
 *   Withdraw:
 *     withdrawAmount + changeAmount == inputNote.amount
 *     withdrawBlinding + changeBlinding == inputNote.blinding    (for circuit)
 *     Full withdrawal: changeAmount = 0, changeCommitment = 0
 *
 * Witness layout mirrors the 10 constraint groups in the PrivateTransfer and
 * PrivateWithdraw Circom circuits (see CLAUDE.md).
 *
 * The proof is ABI-encoded as:
 *   abi.encode(uint256[2] pA, uint256[2][2] pB, uint256[2] pC) = 256 bytes
 * matching ShieldedPool._decodeProof().
 */

import { AbiCoder } from "ethers";
import {
  computePedersenCommitment,
  computeNoteCommitment,
  computeNullifier,
} from "./note";
import type {
  Note,
  BabyJubPoint,
  MerklePath,
  TransferProofResult,
  WithdrawProofResult,
  Groth16Proof,
} from "./types";
import { bytesToHex } from "./utils";
import { hexToBytes } from "./utils";

// ─── snarkjs import ───────────────────────────────────────────────────────────

// snarkjs uses a non-standard export style; import dynamically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSnarkjs(): Promise<any> {
  const snarkjs = await import("snarkjs");
  return snarkjs;
}

// ─── Randomness ───────────────────────────────────────────────────────────────

function randomBytes31(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return BigInt("0x" + bytesToHex(bytes));
}

// ─── Baby Jubjub subgroup order ───────────────────────────────────────────────

const L =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

/** Modular reduction within the Baby Jubjub subgroup order. */
function mod(a: bigint): bigint {
  return ((a % L) + L) % L;
}

// ─── Proof encoding ───────────────────────────────────────────────────────────

/**
 * ABI-encode a Groth16 proof as 256 bytes.
 *   abi.encode(uint256[2] pA, uint256[2][2] pB, uint256[2] pC)
 *
 * This matches ShieldedPool._decodeProof() which expects exactly 256 bytes.
 */
export function encodeProofForContract(proof: Groth16Proof): Uint8Array {
  const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]!), BigInt(proof.pi_a[1]!)];

  // snarkjs returns pB in Fq2 as [[x1, x2], [y1, y2]]
  // Solidity expects [2][2] in the same order
  const pB: [[bigint, bigint], [bigint, bigint]] = [
    [BigInt(proof.pi_b[0]![0]!), BigInt(proof.pi_b[0]![1]!)],
    [BigInt(proof.pi_b[1]![0]!), BigInt(proof.pi_b[1]![1]!)],
  ];

  const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]!), BigInt(proof.pi_c[1]!)];

  const coder = new AbiCoder();
  const encoded = coder.encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]"],
    [pA, pB, pC]
  );

  return hexToBytes(encoded.slice(2)); // strip 0x
}

// ─── Transfer proof ───────────────────────────────────────────────────────────

/**
 * Parameters for generating a transfer proof.
 */
export interface TransferProofParams {
  /** Note to consume. Must have a valid leafIndex and nullifier. */
  inputNote: Note;
  /** Amount to send to recipient (must be < inputNote.amount for change). */
  transferAmount: bigint;
  /** Recipient's Baby Jubjub public key. */
  recipientPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub public key (for the change note). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key (needed to prove ownership in circuit). */
  senderPrivateKey: bigint;
  /** Merkle inclusion proof for inputNote.leafIndex. */
  merklePath: MerklePath;
  /** Path to transfer circuit WASM file (URL in browser, filesystem path in Node). */
  wasmPath: string;
  /** Path to transfer_final.zkey. */
  zkeyPath: string;
}

/**
 * Generate a Groth16 proof for a private transfer.
 *
 * Returns proof bytes + public signals + the two output notes
 * (recipient note and sender change note).
 */
export async function generateTransferProof(
  params: TransferProofParams
): Promise<TransferProofResult> {
  const {
    inputNote,
    transferAmount,
    recipientPublicKey,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  } = params;

  // ── Validate amounts ────────────────────────────────────────────────────────
  if (transferAmount <= 0n) {
    throw new Error("generateTransferProof: transferAmount must be > 0");
  }
  if (transferAmount > inputNote.amount) {
    throw new Error(
      `generateTransferProof: transferAmount ${transferAmount} > inputNote.amount ${inputNote.amount}`
    );
  }

  const changeAmount = inputNote.amount - transferAmount;

  // ── Generate output note secrets ────────────────────────────────────────────
  const recipientBlinding = randomBytes31();
  const changeBlinding = mod(inputNote.blinding - recipientBlinding); // conservation: sum = inputNote.blinding

  const secretOut1 = randomBytes31();
  const secretOut2 = randomBytes31();
  const nullifierPreimageOut1 = randomBytes31();
  const nullifierPreimageOut2 = randomBytes31();

  // ── Compute output Pedersen commitments ─────────────────────────────────────
  const recipientPedersen = await computePedersenCommitment(transferAmount, recipientBlinding);
  const changePedersen = await computePedersenCommitment(changeAmount, changeBlinding);

  // ── Compute output note commitments ─────────────────────────────────────────
  const recipientCommitment = await computeNoteCommitment(
    recipientPedersen,
    secretOut1,
    nullifierPreimageOut1,
    recipientPublicKey[0]
  );
  const changeCommitment = await computeNoteCommitment(
    changePedersen,
    secretOut2,
    nullifierPreimageOut2,
    senderPublicKey[0]
  );

  // ── Build circuit witness ────────────────────────────────────────────────────
  const witness = {
    // Public inputs
    merkle_root: inputNote.leafIndex >= 0 ? merklePath.root.toString() : "0",
    nullifier_hash: inputNote.nullifier.toString(),
    new_commitment_1: recipientCommitment.toString(),
    new_commitment_2: changeCommitment.toString(),

    // Private inputs — input note
    amount_in: inputNote.amount.toString(),
    blinding_in: inputNote.blinding.toString(),
    secret: inputNote.secret.toString(),
    nullifier_preimage: inputNote.nullifierPreimage.toString(),
    owner_private_key: senderPrivateKey.toString(),
    leaf_index: inputNote.leafIndex.toString(),

    // Merkle path
    merkle_path: merklePath.pathElements.map((e) => e.toString()),
    path_indices: merklePath.pathIndices.map((i) => i.toString()),

    // Output notes
    amount_out_1: transferAmount.toString(),
    amount_out_2: changeAmount.toString(),
    blinding_out_1: recipientBlinding.toString(),
    blinding_out_2: changeBlinding.toString(),
    secret_out_1: secretOut1.toString(),
    secret_out_2: secretOut2.toString(),
    nullifier_preimage_out_1: nullifierPreimageOut1.toString(),
    nullifier_preimage_out_2: nullifierPreimageOut2.toString(),
    owner_pk_out_1: [recipientPublicKey[0].toString(), recipientPublicKey[1].toString()],
    owner_pk_out_2: [senderPublicKey[0].toString(), senderPublicKey[1].toString()],
  };

  // ── Generate proof ──────────────────────────────────────────────────────────
  const snarkjs = await getSnarkjs();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath
  );

  const publicSignalsBigint = (publicSignals as string[]).map((s) => BigInt(s)) as [bigint, bigint, bigint, bigint];

  // ── Build output Note objects ────────────────────────────────────────────────
  const recipientNote: Note = {
    amount: transferAmount,
    blinding: recipientBlinding,
    secret: secretOut1,
    nullifierPreimage: nullifierPreimageOut1,
    ownerPublicKey: recipientPublicKey,
    pedersenCommitment: recipientPedersen,
    noteCommitment: recipientCommitment,
    nullifier: 0n, // unknown until leafIndex assigned from event
    leafIndex: -1,
    spent: false,
    tokenAddress: inputNote.tokenAddress,
    createdAtBlock: 0,
  };

  const changeNote: Note = {
    amount: changeAmount,
    blinding: changeBlinding,
    secret: secretOut2,
    nullifierPreimage: nullifierPreimageOut2,
    ownerPublicKey: senderPublicKey,
    pedersenCommitment: changePedersen,
    noteCommitment: changeCommitment,
    nullifier: 0n,
    leafIndex: -1,
    spent: false,
    tokenAddress: inputNote.tokenAddress,
    createdAtBlock: 0,
  };

  return {
    proofBytes: encodeProofForContract(proof as Groth16Proof),
    publicSignals: publicSignalsBigint,
    recipientNote,
    changeNote,
    rawProof: proof as Groth16Proof,
  };
}

// ─── Withdraw proof ───────────────────────────────────────────────────────────

/**
 * Parameters for generating a withdrawal proof.
 */
export interface WithdrawProofParams {
  /** Note to consume. */
  inputNote: Note;
  /** Amount to withdraw (ERC20 tokens to release). */
  withdrawAmount: bigint;
  /** EVM address to receive the withdrawn tokens. */
  recipient: string;
  /** Sender's Baby Jubjub public key (for change note, if any). */
  senderPublicKey: BabyJubPoint;
  /** Sender's Baby Jubjub private key. */
  senderPrivateKey: bigint;
  /** Merkle inclusion proof. */
  merklePath: MerklePath;
  /** Path to withdraw circuit WASM file. */
  wasmPath: string;
  /** Path to withdraw_final.zkey. */
  zkeyPath: string;
}

/**
 * Generate a Groth16 proof for a withdrawal.
 *
 * For a full withdrawal (withdrawAmount == inputNote.amount), changeCommitment
 * is 0 and changeNote is undefined.  For partial withdrawal, a change note is
 * created for the remainder.
 */
export async function generateWithdrawProof(
  params: WithdrawProofParams
): Promise<WithdrawProofResult> {
  const {
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  } = params;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (withdrawAmount <= 0n) {
    throw new Error("generateWithdrawProof: withdrawAmount must be > 0");
  }
  if (withdrawAmount > inputNote.amount) {
    throw new Error(
      `generateWithdrawProof: withdrawAmount ${withdrawAmount} > inputNote.amount ${inputNote.amount}`
    );
  }

  const isFullWithdraw = withdrawAmount === inputNote.amount;
  const changeAmount = inputNote.amount - withdrawAmount;

  // ── Generate change note (if partial) ─────────────────────────────────────
  let changeBlinding = 0n;
  let withdrawBlinding = 0n;
  let secretOut = 0n;
  let nullifierPreimageOut = 0n;
  let changePedersen: BabyJubPoint = [0n, 0n];
  let changeCommitmentValue = 0n;
  let changeNote: Note | undefined;

  if (!isFullWithdraw) {
    withdrawBlinding = randomBytes31();
    changeBlinding = mod(inputNote.blinding - withdrawBlinding);
    secretOut = randomBytes31();
    nullifierPreimageOut = randomBytes31();

    changePedersen = await computePedersenCommitment(changeAmount, changeBlinding);
    changeCommitmentValue = await computeNoteCommitment(
      changePedersen,
      secretOut,
      nullifierPreimageOut,
      senderPublicKey[0]
    );

    changeNote = {
      amount: changeAmount,
      blinding: changeBlinding,
      secret: secretOut,
      nullifierPreimage: nullifierPreimageOut,
      ownerPublicKey: senderPublicKey,
      pedersenCommitment: changePedersen,
      noteCommitment: changeCommitmentValue,
      nullifier: 0n,
      leafIndex: -1,
      spent: false,
      tokenAddress: inputNote.tokenAddress,
      createdAtBlock: 0,
    };
  } else {
    // Full withdrawal: blinding splits as inputNote.blinding + 0
    withdrawBlinding = inputNote.blinding;
    changeBlinding = 0n;
  }

  // ── Build witness ───────────────────────────────────────────────────────────
  const witness = {
    // Public inputs
    merkle_root: merklePath.root.toString(),
    nullifier_hash: inputNote.nullifier.toString(),
    amount: withdrawAmount.toString(),
    change_commitment: changeCommitmentValue.toString(),

    // Private inputs
    amount_in: inputNote.amount.toString(),
    blinding_in: inputNote.blinding.toString(),
    secret: inputNote.secret.toString(),
    nullifier_preimage: inputNote.nullifierPreimage.toString(),
    owner_private_key: senderPrivateKey.toString(),
    leaf_index: inputNote.leafIndex.toString(),

    // Merkle path
    merkle_path: merklePath.pathElements.map((e) => e.toString()),
    path_indices: merklePath.pathIndices.map((i) => i.toString()),

    // Withdrawal specific
    withdraw_amount: withdrawAmount.toString(),
    withdraw_blinding: withdrawBlinding.toString(),
    change_amount: changeAmount.toString(),
    change_blinding: changeBlinding.toString(),
    secret_out: secretOut.toString(),
    nullifier_preimage_out: nullifierPreimageOut.toString(),
    owner_pk_out: [senderPublicKey[0].toString(), senderPublicKey[1].toString()],
    recipient: BigInt(recipient).toString(), // recipient as uint160 field element
  };

  // ── Generate proof ──────────────────────────────────────────────────────────
  const snarkjs = await getSnarkjs();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath
  );

  const publicSignalsBigint = (publicSignals as string[]).map((s) => BigInt(s)) as [bigint, bigint, bigint, bigint];

  return {
    proofBytes: encodeProofForContract(proof as Groth16Proof),
    publicSignals: publicSignalsBigint,
    changeNote,
    rawProof: proof as Groth16Proof,
  };
}
