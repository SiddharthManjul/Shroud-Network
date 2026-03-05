"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/zktoken/types";
import { NoteStore, encodeNote, decodeNote } from "@/lib/zktoken/note";
import { useShieldedKey } from "./use-shielded-key";

const STORAGE_PREFIX = "zktoken_notes_";

/** Derive the localStorage key for a given shielded public key. */
function storageKeyFor(pkX: bigint): string {
  return STORAGE_PREFIX + pkX.toString(16).slice(0, 16);
}

/**
 * Hook that wraps NoteStore with localStorage persistence.
 * Notes are scoped per shielded key — different users on the same browser
 * have separate note stores.
 */
export function useNotes() {
  const storeRef = useRef(new NoteStore());
  const [notes, setNotes] = useState<Note[]>([]);
  const { keypair } = useShieldedKey();
  const currentKeyRef = useRef<string | null>(null);

  // Hydrate from localStorage when keypair changes
  useEffect(() => {
    storeRef.current.clear();

    if (!keypair) {
      setNotes([]);
      currentKeyRef.current = null;
      return;
    }

    const key = storageKeyFor(keypair.publicKey[0]);
    currentKeyRef.current = key;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        for (const json of arr) {
          storeRef.current.save(decodeNote(json));
        }
      }

      // Migrate: also load old global key if it exists (one-time migration)
      const oldRaw = localStorage.getItem("zktoken_notes");
      if (oldRaw) {
        const oldArr = JSON.parse(oldRaw) as string[];
        for (const json of oldArr) {
          const note = decodeNote(json);
          // Only import notes that belong to this user (matching ownerPublicKey)
          if (note.ownerPublicKey[0] === keypair.publicKey[0]) {
            storeRef.current.save(note);
          }
        }
        // Don't delete old key yet — other users may need their notes migrated too
      }

      setNotes(storeRef.current.getAll());
    } catch {
      // Ignore corrupt storage
    }
  }, [keypair]);

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

  return {
    notes,
    unspent: notes.filter((n) => !n.spent),
    saveNote,
    markSpent,
    getUnspent,
    clearAll,
  };
}
