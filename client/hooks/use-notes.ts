"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/zktoken/types";
import { NoteStore, encodeNote, decodeNote } from "@/lib/zktoken/note";
import { useShieldedKey } from "./use-shielded-key";
import { useToken } from "@/providers/token-provider";

const STORAGE_PREFIX = "zktoken_notes_";
const SCAN_BLOCK_KEY = "zktoken_last_scan_block";

/**
 * Track which keypair+token combos have already been auto-scanned this session.
 * Module-level so it persists across all useNotes() instances (multiple components)
 * but resets on page reload.
 */
const autoScannedKeys = new Set<string>();

/** Derive the localStorage key for a given shielded public key + token address. */
function storageKeyFor(pkX: bigint, tokenAddress?: string): string {
  const base = STORAGE_PREFIX + pkX.toString(16).slice(0, 16);
  if (tokenAddress) {
    return base + "_" + tokenAddress.toLowerCase().slice(0, 10);
  }
  return base;
}

/**
 * Hook that wraps NoteStore with localStorage persistence.
 *
 * Note discovery priority:
 *   1. Notification relay (instant — sender posted encrypted notification)
 *   2. Indexer trial decryption (fast — queries indexed events, not RPC)
 *   3. Chain scanning fallback (slow — only if relay + indexer both fail)
 *
 * localStorage is a cache, not the source of truth. Notes can always be
 * recovered from on-chain encrypted memos.
 */
export function useNotes() {
  const storeRef = useRef(new NoteStore());
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const { keypair } = useShieldedKey();
  const { activeToken } = useToken();
  const currentKeyRef = useRef<string | null>(null);

  const TOKEN_ADDRESS = activeToken?.token ?? "";
  const POOL_ADDRESS = activeToken?.pool ?? "";

  // Reconcile any pending (in-flight) transactions from a prior session
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (!keypair || !POOL_ADDRESS || reconciledRef.current) return;
    reconciledRef.current = true;

    (async () => {
      try {
        const { reconcilePendingTxs } = await import(
          "@/lib/zktoken/pending-tx"
        );
        const { Contract, JsonRpcProvider } = await import("ethers");
        const { SHIELDED_POOL_ABI } = await import(
          "@/lib/zktoken/abi/shielded-pool"
        );

        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

        const count = await reconcilePendingTxs({
          checkNullifier: async (nullifier, poolAddr) => {
            const pool = new Contract(poolAddr, SHIELDED_POOL_ABI, provider);
            return (await pool.isSpent(nullifier)) as boolean;
          },
          onMarkSpent: (nullifier) => {
            storeRef.current.markSpent(nullifier);
          },
          onSaveNote: (note) => {
            storeRef.current.save(note);
          },
        });

        if (count > 0) {
          console.log(`[use-notes] Reconciled ${count} pending transaction(s)`);
          const all = storeRef.current.getAll();
          const serialized = all.map((n) => encodeNote(n));
          const key = currentKeyRef.current;
          if (key) {
            localStorage.setItem(key, JSON.stringify(serialized));
          }
          setNotes([...all]);
        }
      } catch (err) {
        console.warn("[use-notes] Pending tx reconciliation failed:", err);
      }
    })();
  }, [keypair, POOL_ADDRESS]);

  // Hydrate from localStorage cache when keypair or active token changes
  useEffect(() => {
    storeRef.current.clear();

    if (!keypair) {
      setNotes([]);
      currentKeyRef.current = null;
      return;
    }

    const key = storageKeyFor(keypair.publicKey[0], TOKEN_ADDRESS);
    currentKeyRef.current = key;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        for (const json of arr) {
          storeRef.current.save(decodeNote(json));
        }
      }

      // Migrate old global key (one-time) — try legacy key without token suffix
      const legacyKey = STORAGE_PREFIX + keypair.publicKey[0].toString(16).slice(0, 16);
      if (key !== legacyKey) {
        const oldRaw = localStorage.getItem(legacyKey);
        if (oldRaw) {
          const oldArr = JSON.parse(oldRaw) as string[];
          for (const json of oldArr) {
            const note = decodeNote(json);
            if (note.ownerPublicKey[0] === keypair.publicKey[0]) {
              storeRef.current.save(note);
            }
          }
        }
      }

      // Migrate very old global key (one-time)
      const oldRaw = localStorage.getItem("zktoken_notes");
      if (oldRaw) {
        const oldArr = JSON.parse(oldRaw) as string[];
        for (const json of oldArr) {
          const note = decodeNote(json);
          if (note.ownerPublicKey[0] === keypair.publicKey[0]) {
            storeRef.current.save(note);
          }
        }
      }

      setNotes(storeRef.current.getAll());
    } catch {
      // Ignore corrupt storage
    }
  }, [keypair, TOKEN_ADDRESS]);

  // Ref to hold latest refreshNotes for the auto-scan effect
  const refreshRef = useRef<() => Promise<void>>(undefined);

  const persist = useCallback(() => {
    const all = storeRef.current.getAll();
    const serialized = all.map((n) => encodeNote(n));
    const key = currentKeyRef.current;
    if (key) {
      localStorage.setItem(key, JSON.stringify(serialized));
    }
    setNotes([...all]);
  }, []);

  const saveNote = useCallback(
    (note: Note) => {
      storeRef.current.save(note);
      persist();
    },
    [persist]
  );

  const markSpent = useCallback(
    (nullifier: bigint) => {
      storeRef.current.markSpent(nullifier);
      persist();
    },
    [persist]
  );

  const getUnspent = useCallback((tokenAddress?: string) => {
    return storeRef.current.getUnspent(tokenAddress);
  }, []);

  const clearAll = useCallback(() => {
    storeRef.current.clear();
    const key = currentKeyRef.current;
    if (key) {
      localStorage.removeItem(key);
    }
    setNotes([]);
  }, []);

  /**
   * Refresh notes using the 3-tier discovery strategy:
   *   1. Notification relay (instant)
   *   2. Indexer scan (fast)
   *   3. Chain scan (slow fallback)
   */
  const refreshNotes = useCallback(async () => {
    if (!keypair) return;
    setLoading(true);

    const existingCommitments = new Set(
      storeRef.current.getAll().map((n) => n.noteCommitment.toString())
    );

    let foundNew = false;

    try {
      // Tier 1: Check notification relay (instant)
      try {
        const { scanNotesFromRelay } = await import("@/lib/zktoken/transaction");
        const relayNotes = await scanNotesFromRelay({
          myPrivateKey: keypair.privateKey,
          myPublicKey: keypair.publicKey,
          tokenAddress: TOKEN_ADDRESS,
          existingCommitments,
        });
        for (const note of relayNotes) {
          storeRef.current.save(note);
          existingCommitments.add(note.noteCommitment.toString());
          foundNew = true;
        }
      } catch (err) {
        console.warn("[use-notes] Relay check failed:", err);
      }

      // Tier 2: Indexer scan (for anything the relay missed)
      let indexerWorked = false;
      try {
        const lastBlock = parseInt(localStorage.getItem(SCAN_BLOCK_KEY) ?? "0");
        const { scanNotesFromIndexer } = await import("@/lib/zktoken/transaction");
        const indexerNotes = await scanNotesFromIndexer({
          myPrivateKey: keypair.privateKey,
          myPublicKey: keypair.publicKey,
          tokenAddress: TOKEN_ADDRESS,
          existingCommitments,
          afterBlock: lastBlock,
        });
        for (const note of indexerNotes) {
          storeRef.current.save(note);
          existingCommitments.add(note.noteCommitment.toString());
          foundNew = true;
        }

        // Update scan checkpoint — only if indexer returned data
        const { fetchPoolState } = await import("@/lib/zktoken/indexer");
        const state = await fetchPoolState();
        if (state.lastIndexedBlock > 0) {
          localStorage.setItem(SCAN_BLOCK_KEY, state.lastIndexedBlock.toString());
          indexerWorked = true;
        }
      } catch (err) {
        console.warn("[use-notes] Indexer scan failed:", err);
      }

      // Tier 3: Chain scan — runs whenever indexer failed
      if (!indexerWorked) {
        console.log("[use-notes] Falling back to chain scan...");
        try {
          const { scanChainForNotes } = await import("@/lib/zktoken/transaction");
          const { JsonRpcProvider } = await import("ethers");
          const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

          const chainNotes = await scanChainForNotes({
            provider: provider as never,
            poolAddress: POOL_ADDRESS,
            myPrivateKey: keypair.privateKey,
            myPublicKey: keypair.publicKey,
            tokenAddress: TOKEN_ADDRESS,
            existingNullifiers: new Set(
              storeRef.current.getAll().map((n) => n.nullifier.toString())
            ),
          });

          for (const note of chainNotes) {
            if (!existingCommitments.has(note.noteCommitment.toString())) {
              storeRef.current.save(note);
              foundNew = true;
            }
          }
        } catch (chainErr) {
          console.warn("[use-notes] Chain scan also failed:", chainErr);
        }
      }

      if (foundNew) {
        persist();
      }

      // Reconcile spent status: check every unspent note's nullifier on-chain
      if (POOL_ADDRESS) {
        try {
          const { Contract, JsonRpcProvider } = await import("ethers");
          const { SHIELDED_POOL_ABI } = await import(
            "@/lib/zktoken/abi/shielded-pool"
          );
          const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
          const pool = new Contract(POOL_ADDRESS, SHIELDED_POOL_ABI, provider);

          const unspentNotes = storeRef.current
            .getAll()
            .filter((n) => !n.spent && n.nullifier !== 0n);

          if (unspentNotes.length > 0) {
            const checks = await Promise.all(
              unspentNotes.map((n) =>
                pool.isSpent(n.nullifier).catch(() => false)
              )
            );

            let markedAny = false;
            for (let i = 0; i < unspentNotes.length; i++) {
              if (checks[i]) {
                storeRef.current.markSpent(unspentNotes[i].nullifier);
                markedAny = true;
              }
            }
            if (markedAny) {
              persist();
            }
          }
        } catch (err) {
          console.warn("[use-notes] On-chain nullifier check failed:", err);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [keypair, persist, TOKEN_ADDRESS, POOL_ADDRESS]);

  // Keep ref in sync so the auto-scan effect always calls the latest version
  refreshRef.current = refreshNotes;

  // Auto-scan on login: trigger refreshNotes once per keypair+token per session
  const autoScanTriggered = useRef(false);
  useEffect(() => {
    if (!keypair || !POOL_ADDRESS || !TOKEN_ADDRESS) return;

    const scanKey = keypair.publicKey[0].toString(16).slice(0, 16) + "_" + TOKEN_ADDRESS.toLowerCase();

    // Skip if already auto-scanned this session (across all hook instances)
    if (autoScannedKeys.has(scanKey)) return;

    // Skip if this specific hook instance already triggered (React strict mode double-fire)
    if (autoScanTriggered.current) return;
    autoScanTriggered.current = true;
    autoScannedKeys.add(scanKey);

    // Small delay to let hydration + UI settle before starting background scan
    const timer = setTimeout(() => {
      console.log("[use-notes] Auto-scanning notes on login...");
      refreshRef.current?.();
    }, 500);

    return () => clearTimeout(timer);
  }, [keypair, POOL_ADDRESS, TOKEN_ADDRESS]);

  return {
    notes,
    unspent: notes.filter((n) => !n.spent),
    loading,
    saveNote,
    markSpent,
    getUnspent,
    clearAll,
    refreshNotes,
    persist,
  };
}
