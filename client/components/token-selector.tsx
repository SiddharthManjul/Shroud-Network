"use client";

import { useMemo } from "react";
import { useToken } from "@/providers/token-provider";
import type { PoolInfo } from "@/lib/zktoken/registry";
import { CustomSelect } from "./custom-select";

export function TokenSelector() {
  const { tokens, activeToken, setActiveToken, loading } = useToken();

  // Build pool-level options: all unified tokens collapse into one "Unified Pool" entry.
  // useMemo must be called before any early return (Rules of Hooks).
  const { options, currentValue } = useMemo(() => {
    const seen = new Map<string, { label: string; representative: PoolInfo }>();
    for (const t of tokens) {
      const key = t.poolType === "unified" ? "__unified__" : t.token;
      if (!seen.has(key)) {
        seen.set(key, {
          label: t.poolType === "unified" ? "Unified Pool" : t.symbol,
          representative: t,
        });
      }
    }
    const opts = [...seen.entries()].map(([key, { label }]) => ({ value: key, label }));
    const cur = activeToken?.poolType === "unified" ? "__unified__" : (activeToken?.token ?? "");
    return { options: opts, currentValue: cur };
  }, [tokens, activeToken]);

  if (!activeToken) return null;

  if (options.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-2.5 py-1">
        <span className="text-sm font-medium text-[#acf901]">
          {options[0]?.label ?? activeToken.symbol}
        </span>
      </div>
    );
  }

  return (
    <CustomSelect
      value={currentValue}
      options={options}
      onChange={(val) => {
        if (val === "__unified__") {
          // Keep the current unified token if already on unified, otherwise pick the first
          const target =
            (activeToken.poolType === "unified" ? activeToken : null) ??
            tokens.find((t) => t.poolType === "unified");
          if (target) setActiveToken(target);
        } else {
          const selected = tokens.find((t) => t.token === val);
          if (selected) setActiveToken(selected);
        }
      }}
      disabled={loading}
      compact
    />
  );
}
