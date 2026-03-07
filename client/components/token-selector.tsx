"use client";

import { useToken } from "@/providers/token-provider";

export function TokenSelector() {
  const { tokens, activeToken, setActiveToken, loading } = useToken();

  if (!activeToken) return null;

  // Single token — show badge
  if (tokens.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-2.5 py-1">
        <span className="text-sm font-medium text-[#ff1a1a]">
          {activeToken.symbol}
        </span>
        <span className="text-xs text-[#666666]">
          {activeToken.token.slice(0, 6)}...{activeToken.token.slice(-4)}
        </span>
      </div>
    );
  }

  // Multiple tokens — dropdown
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[#888888]">Token:</label>
      <select
        value={activeToken.token}
        onChange={(e) => {
          const selected = tokens.find((t) => t.token === e.target.value);
          if (selected) setActiveToken(selected);
        }}
        disabled={loading}
        className="rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-2 py-1 text-sm text-[#ff1a1a] focus:border-[#ff1a1a] focus:outline-none transition-colors duration-200"
      >
        {tokens.map((t) => (
          <option key={t.token} value={t.token}>
            {t.symbol} ({t.token.slice(0, 6)}...{t.token.slice(-4)})
          </option>
        ))}
      </select>
    </div>
  );
}
