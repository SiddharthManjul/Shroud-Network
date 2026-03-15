"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";

/**
 * WalletButton — Shows external wallet connection status.
 * Used for deposit operations that require ERC20 token transfers.
 */
export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  const baseClass =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 border";

  if (address) {
    return (
      <button
        onClick={disconnect}
        className={`${baseClass} bg-[#1a1a1a] text-[#888888] border-[#2a2a2a] hover:border-[#acf901] hover:text-[#acf901] font-mono`}
        title="External wallet (for deposits)"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className={`${baseClass} bg-[#1a1a1a] text-[#888888] border-[#2a2a2a] hover:border-[#acf901] hover:text-[#acf901] disabled:opacity-40`}
      title="Connect wallet for deposits"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}

/**
 * AuthButton — Shows Privy email auth status.
 * Primary auth mechanism for the app.
 */
export function AuthButton() {
  const { authenticated, email, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const baseClass =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 border";

  if (authenticated && email) {
    return (
      <button
        onClick={handleLogout}
        className={`${baseClass} bg-[#b0b0b0] text-black border-[#b0b0b0] hover:bg-[#acf901] hover:border-[#acf901] hover:text-black`}
      >
        {email}
      </button>
    );
  }

  return null;
}
