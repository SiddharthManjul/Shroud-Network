/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { useAuth } from "@/providers/auth-provider";
import type { BabyJubKeyPair } from "@/lib/zktoken/types";
import type { VaultMethod, VaultStatus } from "@/lib/zktoken/key-vault";

// ─── Context shape ────────────────────────────────────────────────────────────

interface ShieldedKeyContextValue {
  keypair: BabyJubKeyPair | null;
  deriving: boolean;
  deriveKey: () => Promise<null>;
  vaultStatus: VaultStatus;
  needsSetup: boolean;
  needsUnlock: boolean;
  error: string | null;
  setupVault: (method: VaultMethod, pin?: string) => Promise<BabyJubKeyPair | null | undefined>;
  unlockVault: (pin?: string) => Promise<BabyJubKeyPair | null>;
  lock: () => void;
  resetVault: () => Promise<void>;
  clearError: () => void;
}

const ShieldedKeyContext = createContext<ShieldedKeyContextValue>({
  keypair: null,
  deriving: false,
  deriveKey: async () => null,
  vaultStatus: { exists: false, method: null },
  needsSetup: false,
  needsUnlock: false,
  error: null,
  setupVault: async () => null,
  unlockVault: async () => null,
  lock: () => {},
  resetVault: async () => {},
  clearError: () => {},
});

export function useShieldedKeyContext() {
  return useContext(ShieldedKeyContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * ShieldedKeyProvider — Shared Baby Jubjub keypair state.
 *
 * Key derivation now uses the Privy embedded wallet signature instead of
 * an external wallet. The user's email auth (via Privy) creates a deterministic
 * embedded wallet, whose signature on a fixed message produces the same
 * Baby Jubjub key every time.
 *
 * Flow:
 *   1. First use: Privy embedded wallet signature → derive key → choose security method → encrypt & store
 *   2. Subsequent use: biometric prompt or PIN entry → decrypt → keypair in memory
 *   3. Session: keypair stays in memory until page reload or lock()
 */
export function ShieldedKeyProvider({ children }: { children: ReactNode }) {
  const { authenticated, userId, signWithEmbeddedWallet } = useAuth();
  const [keypair, setKeypair] = useState<BabyJubKeyPair | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>({ exists: false, method: null });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const derivedForRef = useRef<string | null>(null);
  const pendingKeyRef = useRef<string | null>(null);

  // Use Privy userId as the vault identifier (stable across sessions)
  const vaultId = userId ?? null;

  // Check vault status when auth changes
  useEffect(() => {
    if (!authenticated || !vaultId) {
      setKeypair(null);
      setVaultStatus({ exists: false, method: null });
      setNeedsSetup(false);
      setNeedsUnlock(false);
      setError(null);
      derivedForRef.current = null;
      pendingKeyRef.current = null;
      return;
    }

    if (derivedForRef.current === vaultId) return;

    (async () => {
      const { getVaultStatus, getPlaintextKeyForMigration } = await import(
        "@/lib/zktoken/key-vault"
      );

      const status = getVaultStatus(vaultId);
      setVaultStatus(status);

      if (status.exists) {
        setNeedsUnlock(true);
        setNeedsSetup(false);
      } else {
        const oldKey = getPlaintextKeyForMigration(vaultId);
        if (oldKey) {
          pendingKeyRef.current = oldKey;
          setNeedsSetup(true);
          setNeedsUnlock(false);
        }
      }
    })();
  }, [authenticated, vaultId]);

  const deriveKey = useCallback(async () => {
    if (!authenticated || !vaultId) return null;

    setDeriving(true);
    setError(null);
    try {
      const { KeyManager, SUBGROUP_ORDER } = await import("@/lib/zktoken/keys");
      const { keccak256, toUtf8Bytes } = await import("ethers");

      // Sign a deterministic message with the Privy embedded wallet.
      // Same email → same embedded wallet → same signature → same Baby Jubjub key.
      const message = "shroud-shielded-key-v1:" + vaultId;
      const signature = await signWithEmbeddedWallet(message);

      const hash = keccak256(toUtf8Bytes(signature));
      let privKey = BigInt(hash) % SUBGROUP_ORDER;
      if (privKey === 0n) privKey = 1n;

      const privKeyHex = privKey.toString(16).padStart(64, "0");

      pendingKeyRef.current = privKeyHex;
      setNeedsSetup(true);

      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to derive key");
      return null;
    } finally {
      setDeriving(false);
    }
  }, [authenticated, vaultId, signWithEmbeddedWallet]);

  const setupVault = useCallback(
    async (method: VaultMethod, pin?: string) => {
      if (!vaultId || !pendingKeyRef.current) return;

      setError(null);
      try {
        const { storeWithPIN, storeWithPasskey } = await import("@/lib/zktoken/key-vault");
        const { KeyManager } = await import("@/lib/zktoken/keys");

        const privKeyHex = pendingKeyRef.current;

        if (method === "passkey") {
          await storeWithPasskey(vaultId, privKeyHex);
        } else {
          if (!pin) throw new Error("PIN required");
          await storeWithPIN(vaultId, privKeyHex, pin);
        }

        const kp = await KeyManager.fromPrivateKey(privKeyHex);
        setKeypair(kp);
        derivedForRef.current = vaultId;
        pendingKeyRef.current = null;
        setNeedsSetup(false);
        setNeedsUnlock(false);
        setVaultStatus({ exists: true, method });

        return kp;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Vault setup failed");
        return null;
      }
    },
    [vaultId]
  );

  const unlockVault = useCallback(
    async (pin?: string) => {
      if (!vaultId) return null;

      setError(null);
      try {
        const { unlock } = await import("@/lib/zktoken/key-vault");
        const { KeyManager } = await import("@/lib/zktoken/keys");

        const privKeyHex = await unlock(vaultId, pin);
        const kp = await KeyManager.fromPrivateKey(privKeyHex);

        setKeypair(kp);
        derivedForRef.current = vaultId;
        setNeedsUnlock(false);

        return kp;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unlock failed";
        setError(msg);
        return null;
      }
    },
    [vaultId]
  );

  const lock = useCallback(() => {
    setKeypair(null);
    derivedForRef.current = null;
    if (vaultStatus.exists) {
      setNeedsUnlock(true);
    }
  }, [vaultStatus.exists]);

  const resetVault = useCallback(async () => {
    if (!vaultId) return;
    const { deleteVault } = await import("@/lib/zktoken/key-vault");
    deleteVault(vaultId);
    setKeypair(null);
    derivedForRef.current = null;
    pendingKeyRef.current = null;
    setVaultStatus({ exists: false, method: null });
    setNeedsSetup(false);
    setNeedsUnlock(false);
  }, [vaultId]);

  return (
    <ShieldedKeyContext.Provider
      value={{
        keypair,
        deriving,
        deriveKey,
        vaultStatus,
        needsSetup,
        needsUnlock,
        error,
        setupVault,
        unlockVault,
        lock,
        resetVault,
        clearError: () => setError(null),
      }}
    >
      {children}
    </ShieldedKeyContext.Provider>
  );
}
