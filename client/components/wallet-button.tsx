"use client";

import { useWallet } from "@/hooks/use-wallet";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-mono text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
