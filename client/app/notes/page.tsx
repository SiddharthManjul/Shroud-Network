"use client";

import { useNotes } from "@/hooks/use-notes";
import { NoteList } from "@/components/note-list";

export default function NotesPage() {
  const { notes, unspent, clearAll } = useNotes();

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
        {notes.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-lg border border-[#ff1a1a]/30 px-3 py-1.5 text-sm text-[#ff1a1a]/80 hover:bg-[#ff1a1a]/10 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

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
