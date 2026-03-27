"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import type { PoolInfo } from "@/lib/zktoken/registry";
import { UNIFIED_SHIELDED_POOL_ABI } from "@/lib/zktoken/abi/unified-shielded-pool";

const STORAGE_KEY = "zktoken_active_token";

interface TokenContextValue {
  /** All registered tokens from the on-chain registry. */
  tokens: PoolInfo[];
  /** Currently selected token (null while loading or if none available). */
  activeToken: PoolInfo | null;
  /** Switch the active token. */
  setActiveToken: (token: PoolInfo) => void;
  /** True while fetching from registry. */
  loading: boolean;
  /** Reload pools from the registry. */
  refresh: () => Promise<void>;
}

const TokenContext = createContext<TokenContextValue>({
  tokens: [],
  activeToken: null,
  setActiveToken: () => {},
  loading: false,
  refresh: async () => {},
});

export function useToken() {
  return useContext(TokenContext);
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<PoolInfo[]>([]);
  const [activeToken, setActiveTokenState] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const registryAddress =
    process.env.NEXT_PUBLIC_POOL_REGISTRY_ADDRESS ?? "";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
  const unifiedPoolAddress =
    process.env.NEXT_PUBLIC_UNIFIED_SHIELDED_POOL_ADDRESS ?? "";

  // Stable read-only provider for registry queries (no wallet needed)
  const readProviderRef = useRef<JsonRpcProvider | null>(null);
  if (!readProviderRef.current) {
    readProviderRef.current = new JsonRpcProvider(rpcUrl);
  }

  const fetchPools = useCallback(async () => {
    if (!registryAddress) {
      // Fallback: construct a single pool from legacy env vars
      const poolAddr = process.env.NEXT_PUBLIC_SHIELDED_POOL_ADDRESS ?? "";
      const tokenAddr = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";
      const paymasterAddr = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ?? "";
      if (poolAddr && tokenAddr) {
        const fallback: PoolInfo = {
          pool: poolAddr,
          paymaster: paymasterAddr,
          token: tokenAddr,
          symbol: "SRD",
          decimals: 18,
          createdAt: 0,
        };
        setTokens([fallback]);
        setActiveTokenState(fallback);
      }
      return;
    }

    setLoading(true);
    try {
      const { fetchAllPools } = await import("@/lib/zktoken/registry");
      const pools = await fetchAllPools(registryAddress, readProviderRef.current!);

      // Mark all fetched pools as V1 initially
      for (const p of pools) {
        if (!p.poolType) p.poolType = "v1";
      }

      // Upgrade tokens that are explicitly whitelisted in the unified pool.
      // Only tokens returned by getAllowedToken() can be deposited — getAssetId()
      // is a pure computation that succeeds for any address, but deposit() will
      // revert for non-whitelisted tokens.
      if (unifiedPoolAddress) {
        try {
          const unifiedPool = new Contract(
            unifiedPoolAddress,
            UNIFIED_SHIELDED_POOL_ABI as never,
            readProviderRef.current!
          );
          const erc20Abi = ["function decimals() view returns (uint8)"];
          const tokenCount = Number(await unifiedPool.getAllowedTokenCount());

          for (let i = 0; i < tokenCount; i++) {
            const tokenAddr: string = await unifiedPool.getAllowedToken(i);
            const assetId: bigint = await unifiedPool.getAssetId(tokenAddr);
            const existing = pools.find(
              (p) => p.token.toLowerCase() === tokenAddr.toLowerCase()
            );
            if (existing) {
              // Upgrade the matching V1 entry to use the unified pool
              existing.pool = unifiedPoolAddress;
              existing.poolType = "unified";
              existing.assetId = assetId;
              existing.paymaster = "";
            } else {
              // Token is only in the unified pool — add a new entry
              let decimals = 18;
              try {
                const erc20 = new Contract(tokenAddr, erc20Abi, readProviderRef.current!);
                decimals = await erc20.decimals().then(Number);
              } catch { /* use default */ }

              pools.push({
                pool: unifiedPoolAddress,
                paymaster: "",
                token: tokenAddr,
                symbol: "Unified",
                decimals,
                createdAt: 0,
                poolType: "unified",
                assetId,
              });
            }
          }
        } catch (err) {
          console.warn("[TokenProvider] Failed to query unified pool:", err);
        }
      }

      setTokens(pools);

      if (pools.length > 0) {
        // Restore previously selected token from localStorage
        const savedAddr =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
        const saved = savedAddr
          ? pools.find(
              (p) => p.token.toLowerCase() === savedAddr.toLowerCase()
            )
          : null;
        setActiveTokenState(saved ?? pools[0]);
      }
    } catch (err) {
      console.warn("[TokenProvider] Failed to fetch pools from registry:", err);
      // Fallback to legacy env vars
      const poolAddr = process.env.NEXT_PUBLIC_SHIELDED_POOL_ADDRESS ?? "";
      const tokenAddr = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";
      const paymasterAddr = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ?? "";
      if (poolAddr && tokenAddr) {
        const fallback: PoolInfo = {
          pool: poolAddr,
          paymaster: paymasterAddr,
          token: tokenAddr,
          symbol: "SRD",
          decimals: 18,
          createdAt: 0,
        };
        setTokens([fallback]);
        setActiveTokenState(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [registryAddress]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const setActiveToken = useCallback((token: PoolInfo) => {
    setActiveTokenState(token);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, token.token);
    }
  }, []);

  return (
    <TokenContext.Provider
      value={{ tokens, activeToken, setActiveToken, loading, refresh: fetchPools }}
    >
      {children}
    </TokenContext.Provider>
  );
}
