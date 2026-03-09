"use client";

export function ProofStatus({ generating }: { generating: boolean }) {
  if (!generating) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#acf901]/30 bg-[#acf901]/5 px-4 py-3">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#acf901] border-t-transparent" />
      <span className="text-sm text-[#acf901]">
        Generating ZK proof... This may take a few seconds.
      </span>
    </div>
  );
}
