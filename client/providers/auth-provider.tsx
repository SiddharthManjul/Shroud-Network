"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/**
 * AuthProvider — Manages Privy email authentication and embedded wallet access.
 *
 * The embedded wallet is used ONLY for signing a deterministic message to derive
 * the Baby Jubjub shielded key. It does NOT hold funds or pay gas.
 *
 * External wallets (MetaMask etc.) are still used for deposits (ERC20 transfers).
 */

interface AuthContextValue {
  /** Whether Privy has finished loading */
  ready: boolean;
  /** Whether user is authenticated via Privy (email) */
  authenticated: boolean;
  /** User's email address (if logged in) */
  email: string | null;
  /** User's Privy user ID (stable identifier) */
  userId: string | null;
  /** Sign a message with the Privy embedded wallet */
  signWithEmbeddedWallet: (message: string) => Promise<string>;
  /** Login via Privy (opens email OTP modal) */
  login: () => void;
  /** Logout */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  authenticated: false,
  email: null,
  userId: null,
  signWithEmbeddedWallet: async () => "",
  login: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated && user) {
      setEmail(user.email?.address ?? null);
      setUserId(user.id ?? null);
    } else {
      setEmail(null);
      setUserId(null);
    }
  }, [authenticated, user]);

  const signWithEmbeddedWallet = useCallback(
    async (message: string): Promise<string> => {
      // Find the Privy embedded wallet
      const embedded = wallets.find((w) => w.walletClientType === "privy");
      if (!embedded) {
        throw new Error(
          "Embedded wallet not found. Please wait for wallet initialization."
        );
      }

      const ethereumProvider = await embedded.getEthereumProvider();
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();
      return signer.signMessage(message);
    },
    [wallets]
  );

  return (
    <AuthContext.Provider
      value={{
        ready,
        authenticated,
        email,
        userId,
        signWithEmbeddedWallet,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
