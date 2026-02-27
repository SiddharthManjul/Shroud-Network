"use client";

import type { Note } from "@/lib/zktoken/types";
import { NoteCard } from "./note-card";

export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
        <p className="text-zinc-500">No notes found.</p>
        <p className="mt-1 text-sm text-zinc-600">
          Deposit tokens to create your first shielded note.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {notes.map((note, i) => (
        <NoteCard key={`${note.noteCommitment}-${i}`} note={note} />
      ))}
    </div>
  );
}
