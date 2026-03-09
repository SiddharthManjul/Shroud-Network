"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const router = useRouter();

  const handleDisconnect = () => {
    disconnect();
    router.push("/");
  };

  const baseClass =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 border";

  if (address) {
    return (
      <button
        onClick={handleDisconnect}
        className={`${baseClass} bg-[#b0b0b0] text-black border-[#b0b0b0] hover:bg-[#acf901] hover:border-[#acf901] hover:text-black font-mono`}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className={`${baseClass} bg-[#b0b0b0] text-black border-[#b0b0b0] hover:bg-[#acf901] hover:border-[#acf901] hover:text-black disabled:opacity-40`}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
