"use client";

import { useWallet } from "@/hooks/use-wallet";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  const baseClass =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 border";

  if (address) {
    return (
      <button
        onClick={disconnect}
        className={`${baseClass} bg-[#b0b0b0] text-black border-[#b0b0b0] hover:bg-[#ff1a1a] hover:border-[#ff1a1a] hover:text-black font-mono`}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className={`${baseClass} bg-[#b0b0b0] text-black border-[#b0b0b0] hover:bg-[#ff1a1a] hover:border-[#ff1a1a] hover:text-black disabled:opacity-40`}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
