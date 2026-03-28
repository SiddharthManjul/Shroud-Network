"use client";

import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import type { Note } from "@/lib/zktoken/types";

const symbolCache = new Map<string, string>();

function useTokenSymbol(tokenAddress: string): string | null {
  const [symbol, setSymbol] = useState<string | null>(
    symbolCache.get(tokenAddress.toLowerCase()) ?? null
  );

  useEffect(() => {
    const key = tokenAddress.toLowerCase();
    if (!key || key === "0x") return;
    if (symbolCache.has(key)) {
      setSymbol(symbolCache.get(key)!);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
        const erc20 = new Contract(
          tokenAddress,
          ["function symbol() view returns (string)"],
          provider
        );
        const s: string = await erc20.symbol();
        symbolCache.set(key, s);
        if (!cancelled) setSymbol(s);
      } catch {
        if (!cancelled) setSymbol(null);
      }
    })();
    return () => { cancelled = true; };
  }, [tokenAddress]);

  return symbol;
}

export function NoteCard({ note }: { note: Note }) {
  const symbol = useTokenSymbol(note.tokenAddress);
  const displayName = symbol ? `Shroud ${symbol}` : "Shroud Token";

  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-200 ${
        note.spent
          ? "border-[#2a2a2a] bg-[#0a0a0a] opacity-50"
          : "border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#acf901]/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#acf901]">
            {displayName}
          </span>
          <span className="font-mono text-xs text-[#444444]">
            #{note.leafIndex === -1 ? "pending" : note.leafIndex}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            note.spent
              ? "bg-[#acf901]/10 text-[#acf901]/60"
              : "bg-[#acf901]/15 text-[#acf901]"
          }`}
        >
          {note.spent ? "Spent" : "Unspent"}
        </span>
      </div>
      <div className="mt-2 min-w-0">
        <span className="text-2xl font-bold text-[#acf901] break-all">
          {note.amount.toString()}
        </span>
        <span className="ml-2 text-sm text-[#888888]">{symbol ?? "tokens"}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs font-mono text-[#444444] min-w-0">
        <span className="truncate">
          commitment: 0x{note.noteCommitment.toString(16).slice(0, 16)}...
        </span>
      </div>
      {note.tokenAddress && note.tokenAddress !== "0x" && (
        <div className="mt-1 text-xs font-mono text-[#333333] truncate">
          token: {note.tokenAddress.slice(0, 6)}...{note.tokenAddress.slice(-4)}
        </div>
      )}
    </div>
  );
}
