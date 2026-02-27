"use client";

import { useZkTokenContext } from "@/providers/zktoken-provider";

/**
 * Hook to access WASM initialization state.
 * All SDK operations require `ready === true`.
 */
export function useZkToken() {
  return useZkTokenContext();
}
