/**
 * pending-tx.ts — Transaction intent persistence
 *
 * Persists in-flight transfer/withdraw intents to localStorage so that
 * if the page reloads mid-transaction the app can reconcile note state
 * by checking on-chain nullifier status.
 *
 * Lifecycle:
 *   1. BEFORE relay call  → savePendingTx({ status: "submitting", ... })
 *   2. Relay returns hash → updatePendingTx(id, { status: "submitted", txHash })
 *   3. Notes reconciled   → removePendingTx(id)
 *   4. On error           → removePendingTx(id)
 *   5. On reload          → reconcilePendingTxs() checks on-chain and fixes notes
 */

import { encodeNote, decodeNote } from "./note";
import type { Note } from "./types";

const STORAGE_KEY = "zktoken_pending_txs";

export interface PendingTx {
  id: string;
  type: "transfer" | "withdraw";
  createdAt: string;
  status: "submitting" | "submitted";

  /** Nullifier of the input note being spent (hex). */
  inputNullifier: string;
  /** Encoded input note (so we can mark it spent on reconcile). */
  inputNoteEncoded: string;

  /** Encoded change note to save if tx confirmed. */
  changeNoteEncoded?: string;

  /** Relay tx hash (set after relay responds). */
  txHash?: string;

  /** Pool contract address this tx targets. */
  poolAddress: string;
}

/** Generate a short random ID. */
function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Load all pending transactions from localStorage. */
export function loadPendingTxs(): PendingTx[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingTx[];
  } catch {
    return [];
  }
}

/** Persist the pending tx list. */
function persistAll(txs: PendingTx[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

/** Save a new pending transaction. Returns its ID. */
export function savePendingTx(
  params: Omit<PendingTx, "id" | "createdAt">
): string {
  const id = randomId();
  const tx: PendingTx = {
    ...params,
    id,
    createdAt: new Date().toISOString(),
  };
  const all = loadPendingTxs();
  all.push(tx);
  persistAll(all);
  return id;
}

/** Update fields on an existing pending transaction. */
export function updatePendingTx(
  id: string,
  updates: Partial<Pick<PendingTx, "status" | "txHash" | "changeNoteEncoded">>
): void {
  const all = loadPendingTxs();
  const idx = all.findIndex((t) => t.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    persistAll(all);
  }
}

/** Remove a pending transaction (after successful reconciliation or on error). */
export function removePendingTx(id: string): void {
  const all = loadPendingTxs().filter((t) => t.id !== id);
  persistAll(all);
}

/**
 * Reconcile all pending transactions against on-chain state.
 *
 * For each pending tx:
 *   - Check if the input nullifier has been spent on-chain.
 *   - If spent: mark input note spent + save change note → remove pending tx.
 *   - If not spent AND tx is old (>5 min): assume failed → remove pending tx.
 *   - If not spent AND tx is recent: leave it (relay may still be processing).
 *
 * @param checkNullifier  Checks if a nullifier is spent on-chain.
 * @param onMarkSpent     Called when an input note should be marked spent.
 * @param onSaveNote      Called when a change note should be saved.
 * @returns Number of transactions reconciled.
 */
export async function reconcilePendingTxs(opts: {
  checkNullifier: (nullifier: bigint, poolAddress: string) => Promise<boolean>;
  onMarkSpent: (nullifier: bigint) => void;
  onSaveNote: (note: Note) => void;
}): Promise<number> {
  const all = loadPendingTxs();
  if (all.length === 0) return 0;

  const STALE_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  let reconciled = 0;

  for (const tx of all) {
    const nullifier = BigInt(tx.inputNullifier);
    let isSpent = false;

    try {
      isSpent = await opts.checkNullifier(nullifier, tx.poolAddress);
    } catch {
      // Can't check — skip this one, try next reload
      continue;
    }

    if (isSpent) {
      // Transaction confirmed on-chain — reconcile note state
      opts.onMarkSpent(nullifier);

      if (tx.changeNoteEncoded) {
        try {
          const changeNote = decodeNote(tx.changeNoteEncoded);
          if (changeNote.amount > 0n) {
            opts.onSaveNote(changeNote);
          }
        } catch {
          // Change note decode failed — user can recover via scan
        }
      }

      removePendingTx(tx.id);
      reconciled++;
    } else {
      // Not spent — check if stale
      const age = now - new Date(tx.createdAt).getTime();
      if (age > STALE_MS) {
        // Old enough that relay would have processed it by now — assume failed
        removePendingTx(tx.id);
        reconciled++;
      }
      // Otherwise leave it — relay may still be processing
    }
  }

  return reconciled;
}

/** Helper to create a pending tx record for a transfer. */
export function createTransferPendingTx(
  inputNote: Note,
  poolAddress: string
): string {
  return savePendingTx({
    type: "transfer",
    status: "submitting",
    inputNullifier: "0x" + inputNote.nullifier.toString(16),
    inputNoteEncoded: encodeNote(inputNote),
    poolAddress,
  });
}

/** Helper to create a pending tx record for a withdrawal. */
export function createWithdrawPendingTx(
  inputNote: Note,
  poolAddress: string
): string {
  return savePendingTx({
    type: "withdraw",
    status: "submitting",
    inputNullifier: "0x" + inputNote.nullifier.toString(16),
    inputNoteEncoded: encodeNote(inputNote),
    poolAddress,
  });
}
