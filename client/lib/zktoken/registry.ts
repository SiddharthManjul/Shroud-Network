/**
 * registry.ts — Client-side interface to the PoolRegistry contract.
 *
 * Queries the on-chain registry to discover available shielded pools
 * and their associated paymasters, token symbols, and decimals.
 */

import { Contract } from "ethers";
import { POOL_REGISTRY_ABI } from "./abi/pool-registry";

export interface PoolInfo {
  pool: string;
  paymaster: string;
  token: string;
  symbol: string;
  decimals: number;
  createdAt: number;
}

/**
 * Convert a raw ethers v6 Result (struct) to typed PoolInfo.
 * Ethers v6 returns structs as Result objects with both index and named access.
 */
function parsePoolInfo(raw: Record<string, unknown>): PoolInfo {
  return {
    pool: String(raw.pool ?? raw[0] ?? ""),
    paymaster: String(raw.paymaster ?? raw[1] ?? ""),
    token: String(raw.token ?? raw[2] ?? ""),
    symbol: String(raw.symbol ?? raw[3] ?? ""),
    decimals: Number(raw.decimals ?? raw[4] ?? 18),
    createdAt: Number(raw.createdAt ?? raw[5] ?? 0),
  };
}

/**
 * Fetch all registered pools from the on-chain PoolRegistry.
 */
export async function fetchAllPools(
  registryAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any
): Promise<PoolInfo[]> {
  const registry = new Contract(registryAddress, POOL_REGISTRY_ABI, provider);
  const rawPools = await registry.getAllPools();
  const results: PoolInfo[] = [];
  for (let i = 0; i < rawPools.length; i++) {
    results.push(parsePoolInfo(rawPools[i]));
  }
  return results;
}

/**
 * Fetch pool info for a specific token. Returns null if no pool exists.
 */
export async function getPoolForToken(
  registryAddress: string,
  tokenAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any
): Promise<PoolInfo | null> {
  const registry = new Contract(registryAddress, POOL_REGISTRY_ABI, provider);
  try {
    const raw = await registry.tryGetPool(tokenAddress);
    const info = parsePoolInfo(raw);
    if (
      info.pool === "0x0000000000000000000000000000000000000000" ||
      !info.pool
    )
      return null;
    return info;
  } catch {
    return null;
  }
}
