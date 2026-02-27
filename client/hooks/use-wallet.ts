"use client";

import { useWalletContext } from "@/providers/wallet-provider";

/**
 * Hook to access wallet connection state.
 */
export function useWallet() {
  return useWalletContext();
}
