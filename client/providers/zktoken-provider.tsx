"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface ZkTokenContextValue {
  ready: boolean;
  error: string | null;
}

const ZkTokenContext = createContext<ZkTokenContextValue>({
  ready: false,
  error: null,
});

export function useZkTokenContext() {
  return useContext(ZkTokenContext);
}

export function ZkTokenProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { initCrypto } = await import("@/lib/zktoken/crypto");
        await initCrypto();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to init WASM");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ZkTokenContext.Provider value={{ ready, error }}>
      {children}
    </ZkTokenContext.Provider>
  );
}
