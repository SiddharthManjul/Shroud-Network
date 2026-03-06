"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "43113");

const CHAIN_NAMES: Record<number, string> = {
  43114: "Avalanche C-Chain",
  43113: "Avalanche Fuji",
  31337: "Anvil (local)",
  1: "Ethereum Mainnet",
};

interface WalletContextValue {
  address: string | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  chainId: bigint | null;
  networkName: string | null;
  wrongNetwork: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToExpectedNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  signer: null,
  provider: null,
  chainId: null,
  networkName: null,
  wrongNetwork: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  switchToExpectedNetwork: async () => {},
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
  const connectingRef = useRef(false);

  const switchToExpectedNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    const hexChainId = "0x" + EXPECTED_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (err: unknown) {
      // Chain not added to wallet — try adding Fuji
      if ((err as { code?: number })?.code === 4902 && EXPECTED_CHAIN_ID === 43113) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: "Avalanche Fuji Testnet",
              nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
              rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
              blockExplorerUrls: ["https://testnet.snowtrace.io"],
            },
          ],
        });
      }
    }
  }, []);

  /** Refresh provider/signer/chain state without calling eth_requestAccounts. */
  const refreshState = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const bp = new BrowserProvider(window.ethereum);
      const accounts = (await bp.send("eth_accounts", [])) as string[];
      if (accounts.length === 0) {
        setAddress(null);
        setSigner(null);
        setProvider(null);
        setChainId(null);
        return;
      }
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      const network = await bp.getNetwork();

      setProvider(bp);
      setSigner(s);
      setAddress(addr);
      setChainId(network.chainId);
    } catch {
      // Ignore — wallet may be locked
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No injected wallet found");
    }

    // Prevent concurrent eth_requestAccounts calls
    if (connectingRef.current) return;
    connectingRef.current = true;
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

      // Prompt network switch if on wrong chain (only on explicit connect)
      if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
        try {
          await switchToExpectedNetwork();
        } catch {
          // User rejected — stay on current chain
        }
      }
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }, [switchToExpectedNetwork]);

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
      } else {
        // Refresh state without prompting eth_requestAccounts again
        refreshState();
      }
    };

    const handleChainChanged = () => {
      // Refresh state without prompting eth_requestAccounts or network switch
      refreshState();
    };

    try {
      eth.on("accountsChanged", handleAccountsChanged);
      eth.on("chainChanged", handleChainChanged);
    } catch {
      // Provider doesn't support event listeners
      return;
    }

    return () => {
      try {
        eth.removeListener("accountsChanged", handleAccountsChanged);
        eth.removeListener("chainChanged", handleChainChanged);
      } catch {
        // ignore
      }
    };
  }, [disconnect, refreshState]);

  const networkName = chainId
    ? CHAIN_NAMES[Number(chainId)] ?? `Chain ${chainId}`
    : null;
  const wrongNetwork = chainId !== null && Number(chainId) !== EXPECTED_CHAIN_ID;

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        provider,
        chainId,
        networkName,
        wrongNetwork,
        connecting,
        connect,
        disconnect,
        switchToExpectedNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
