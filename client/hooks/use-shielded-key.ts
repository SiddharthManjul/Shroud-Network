"use client";

import { useShieldedKeyContext } from "@/providers/shielded-key-provider";

/**
 * Hook to access the shared shielded key state.
 *
 * All components calling this hook share the same keypair state via context.
 * When VaultGate unlocks the vault, all consumers see the keypair immediately.
 */
export function useShieldedKey() {
  return useShieldedKeyContext();
}
