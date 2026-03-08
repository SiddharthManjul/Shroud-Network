"use client";

import { useToken } from "@/providers/token-provider";
import { CustomSelect } from "./custom-select";

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

  // Multiple tokens — custom dropdown
  return (
    <CustomSelect
      value={activeToken.token}
      options={tokens.map((t) => ({
        value: t.token,
        label: `${t.symbol} (${t.token.slice(0, 6)}...${t.token.slice(-4)})`,
      }))}
      onChange={(val) => {
        const selected = tokens.find((t) => t.token === val);
        if (selected) setActiveToken(selected);
      }}
      disabled={loading}
      compact
    />
  );
}
