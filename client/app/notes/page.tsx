"use client";

import { useState } from "react";
import { useNotes } from "@/hooks/use-notes";
import { useWallet } from "@/hooks/use-wallet";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { NoteList } from "@/components/note-list";

export default function NotesPage() {
  const { notes, unspent, clearAll, loading, refreshNotes } = useNotes();
  const { address } = useWallet();
  const { keypair } = useShieldedKey();
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#ff1a1a]">Notes</h1>
          <p className="mt-1 text-[#888888]">
            Your shielded note inventory. {unspent.length} unspent of{" "}
            {notes.length} total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {address && keypair && (
            <button
              onClick={async () => {
                setScanStatus("Scanning...");
                await refreshNotes();
                setScanStatus("Scan complete.");
                setTimeout(() => setScanStatus(null), 3000);
              }}
              disabled={loading}
              className="rounded-lg bg-[#b0b0b0] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a] disabled:opacity-40 transition-colors duration-200"
            >
              {loading ? "Scanning..." : "Scan"}
            </button>
          )}
          {notes.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-lg border border-[#ff1a1a]/30 px-3 py-1.5 text-sm text-[#ff1a1a]/80 hover:bg-[#ff1a1a]/10 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      {scanStatus && !loading && (
        <p className="text-sm text-[#888888]">{scanStatus}</p>
      )}

      <div>
        <h2 className="text-lg font-semibold text-[#ff1a1a] mb-3">Unspent</h2>
        <NoteList notes={unspent} />
      </div>

      {notes.some((n) => n.spent) && (
        <div>
          <h2 className="text-lg font-semibold text-[#ff1a1a] mb-3">Spent</h2>
          <NoteList notes={notes.filter((n) => n.spent)} />
        </div>
      )}
    </div>
  );
}
