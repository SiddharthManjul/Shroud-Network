"use client";

import { useRef, useState } from "react";
import { useNotes } from "@/hooks/use-notes";
import { useWallet } from "@/hooks/use-wallet";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { NoteList } from "@/components/note-list";
import {
  exportNotesEncrypted,
  importNotesEncrypted,
} from "@/lib/zktoken/note-backup";

export default function NotesPage() {
  const { notes, unspent, clearAll, loading, refreshNotes, saveNote, persist } =
    useNotes();
  const { address } = useWallet();
  const { keypair } = useShieldedKey();
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!keypair || notes.length === 0) return;
    try {
      setBackupStatus("Exporting...");
      const json = await exportNotesEncrypted(notes, keypair.privateKey);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `shroud-notes-${date}.zkbak.json`;
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus(`Exported ${notes.length} notes.`);
    } catch (err) {
      setBackupStatus(
        `Export failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
    setTimeout(() => setBackupStatus(null), 4000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !keypair) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    try {
      setBackupStatus("Importing...");
      const text = await file.text();
      const imported = await importNotesEncrypted(text, keypair.privateKey);
      let count = 0;
      for (const note of imported) {
        saveNote(note);
        count++;
      }
      if (count > 0) persist();
      setBackupStatus(`Imported ${count} notes.`);
    } catch (err) {
      setBackupStatus(
        `Import failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
    setTimeout(() => setBackupStatus(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#acf901]">Notes</h1>
          <p className="mt-1 text-[#888888]">
            Your shielded note inventory. {unspent.length} unspent of{" "}
            {notes.length} total.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {address && keypair && (
            <button
              onClick={async () => {
                setScanStatus("Scanning...");
                await refreshNotes();
                setScanStatus("Scan complete.");
                setTimeout(() => setScanStatus(null), 3000);
              }}
              disabled={loading}
              className="rounded-lg bg-[#b0b0b0] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200"
            >
              {loading ? "Scanning..." : "Scan"}
            </button>
          )}
          {notes.length > 0 && keypair && (
            <button
              onClick={handleExport}
              className="rounded-lg bg-[#b0b0b0] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] transition-colors duration-200"
            >
              Export
            </button>
          )}
          {keypair && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-[#b0b0b0] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] transition-colors duration-200"
              >
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zkbak"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
          {notes.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-lg border border-[#acf901]/30 px-3 py-1.5 text-sm text-[#acf901]/80 hover:bg-[#acf901]/10 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      {scanStatus && !loading && (
        <p className="text-sm text-[#888888]">{scanStatus}</p>
      )}
      {backupStatus && (
        <p className="text-sm text-[#888888]">{backupStatus}</p>
      )}

      <div>
        <h2 className="text-lg font-semibold text-[#acf901] mb-3">Unspent</h2>
        <NoteList notes={unspent} />
      </div>

      {notes.some((n) => n.spent) && (
        <div>
          <h2 className="text-lg font-semibold text-[#acf901] mb-3">Spent</h2>
          <NoteList notes={notes.filter((n) => n.spent)} />
        </div>
      )}
    </div>
  );
}
