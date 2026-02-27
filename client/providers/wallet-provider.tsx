"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";

interface WalletContextValue {
  address: string | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  chainId: bigint | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  signer: null,
  provider: null,
  chainId: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export function useWalletContext() {
  return useContext(WalletContext);
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No injected wallet found");
    }

    setConnecting(true);
    try {
      const bp = new BrowserProvider(window.ethereum);
      await bp.send("eth_requestAccounts", []);
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      const network = await bp.getNetwork();

      setProvider(bp);
      setSigner(s);
      setAddress(addr);
      setChainId(network.chainId);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else if (address) {
        // Reconnect with new account
        connect();
      }
    };

    const handleChainChanged = () => {
      // Reconnect to pick up new chain
      if (address) connect();
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, connect, disconnect]);

  return (
    <WalletContext.Provider
      value={{ address, signer, provider, chainId, connecting, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}
