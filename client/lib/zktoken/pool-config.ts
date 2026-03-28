/**
 * pool-config.ts — Pool configuration helper.
 *
 * Maps a PoolInfo entry to the appropriate PoolConfig (V1 or unified),
 * including circuit paths, tree depth, and ABI selection.
 */

import type { PoolConfig, V1PoolConfig, UnifiedPoolConfig } from "./types";
import type { PoolInfo } from "./registry";

/** V1 circuit file paths (served from /public/circuits/). */
const V1_CIRCUIT_PATHS = {
  transferWasm: "/circuits/transfer.wasm",
  transferZkey: "/circuits/transfer_final.zkey",
  withdrawWasm: "/circuits/withdraw.wasm",
  withdrawZkey: "/circuits/withdraw_final.zkey",
} as const;

/** Unified circuit file paths (served from /public/circuits/). */
const UNIFIED_CIRCUIT_PATHS = {
  transferWasm: "/circuits/unified_transfer.wasm",
  transferZkey: "/circuits/unified_transfer_final.zkey",
  withdrawWasm: "/circuits/unified_withdraw.wasm",
  withdrawZkey: "/circuits/unified_withdraw_final.zkey",
} as const;

/**
 * Build a PoolConfig from a PoolInfo entry.
 *
 * Unified pool entries have `poolType: "unified"`.
 * The `assetId` may come from the pool entry or be overridden (e.g. from a note).
 * All others default to V1.
 */
export function getPoolConfig(poolInfo: PoolInfo, overrideAssetId?: bigint): PoolConfig {
  if (poolInfo.poolType === "unified") {
    const assetId = overrideAssetId ?? poolInfo.assetId ?? 0n;
    return {
      poolType: "unified",
      treeDepth: 24,
      assetId,
      tokenAddress: poolInfo.token,
      circuitPaths: UNIFIED_CIRCUIT_PATHS,
    } satisfies UnifiedPoolConfig;
  }

  return {
    poolType: "v1",
    treeDepth: 20,
    circuitPaths: V1_CIRCUIT_PATHS,
  } satisfies V1PoolConfig;
}
