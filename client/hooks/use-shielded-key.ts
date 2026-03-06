"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./use-wallet";
import type { BabyJubKeyPair } from "@/lib/zktoken/types";
import type { VaultMethod, VaultStatus } from "@/lib/zktoken/key-vault";

/**
 * Derives a persistent Baby Jubjub keypair from the connected EVM wallet.
 *
 * The private key is encrypted at rest using either:
 *   - WebAuthn passkey (biometrics / device unlock) — preferred
 *   - 6-digit PIN via PBKDF2 — fallback
 *
 * Flow:
 *   1. First use: wallet signature → derive key → choose security method → encrypt & store
 *   2. Subsequent use: biometric prompt or PIN entry → decrypt → keypair in memory
 *   3. Session: keypair stays in memory until page reload or lock()
 */
export function useShieldedKey() {
  const { address, signer } = useWallet();
  const [keypair, setKeypair] = useState<BabyJubKeyPair | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>({ exists: false, method: null });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const derivedForRef = useRef<string | null>(null);
  // Hold derived private key hex temporarily during setup flow
  const pendingKeyRef = useRef<string | null>(null);

  // Check vault status when address changes
  useEffect(() => {
    if (!address) {
      setKeypair(null);
      setVaultStatus({ exists: false, method: null });
      setNeedsSetup(false);
      setNeedsUnlock(false);
      setError(null);
      derivedForRef.current = null;
      pendingKeyRef.current = null;
      return;
    }

    if (derivedForRef.current === address) return;

    (async () => {
      const { getVaultStatus, getPlaintextKeyForMigration } = await import(
        "@/lib/zktoken/key-vault"
      );

      const status = getVaultStatus(address);
      setVaultStatus(status);

      if (status.exists) {
        // Vault exists — needs unlock (biometric or PIN)
        setNeedsUnlock(true);
        setNeedsSetup(false);
      } else {
        // Check for old plaintext key that needs migration
        const oldKey = getPlaintextKeyForMigration(address);
        if (oldKey) {
          // Old key exists — migrate to vault
          pendingKeyRef.current = oldKey;
          setNeedsSetup(true);
          setNeedsUnlock(false);
        }
        // Otherwise, user needs to derive key first (no vault, no old key)
      }
    })();
  }, [address]);

  /**
   * Derive the shielded key from wallet signature.
   * After derivation, triggers security setup (passkey or PIN).
   */
  const deriveKey = useCallback(async () => {
    if (!signer || !address) return null;

    setDeriving(true);
    setError(null);
    try {
      const { KeyManager, SUBGROUP_ORDER } = await import("@/lib/zktoken/keys");
      const { keccak256, toUtf8Bytes } = await import("ethers");

      const message = "zktoken-shielded-key-v1:" + address.toLowerCase();
      const signature = await signer.signMessage(message);

      const hash = keccak256(toUtf8Bytes(signature));
      let privKey = BigInt(hash) % SUBGROUP_ORDER;
      if (privKey === 0n) privKey = 1n;

      const privKeyHex = privKey.toString(16).padStart(64, "0");

      // Store temporarily — user must choose security method
      pendingKeyRef.current = privKeyHex;
      setNeedsSetup(true);

      return null; // Don't return keypair yet — needs encryption first
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to derive key");
      return null;
    } finally {
      setDeriving(false);
    }
  }, [signer, address]);

  /**
   * Complete vault setup with chosen security method.
   * Called after deriveKey() or during migration of old plaintext key.
   */
  const setupVault = useCallback(
    async (method: VaultMethod, pin?: string) => {
      if (!address || !pendingKeyRef.current) return;

      setError(null);
      try {
        const { storeWithPIN, storeWithPasskey } = await import("@/lib/zktoken/key-vault");
        const { KeyManager } = await import("@/lib/zktoken/keys");

        const privKeyHex = pendingKeyRef.current;

        if (method === "passkey") {
          await storeWithPasskey(address, privKeyHex);
        } else {
          if (!pin) throw new Error("PIN required");
          await storeWithPIN(address, privKeyHex, pin);
        }

        // Now load the keypair into memory
        const kp = await KeyManager.fromPrivateKey(privKeyHex);
        setKeypair(kp);
        derivedForRef.current = address;
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
    [address]
  );

  /**
   * Unlock an existing vault with biometrics or PIN.
   */
  const unlockVault = useCallback(
    async (pin?: string) => {
      if (!address) return null;

      setError(null);
      try {
        const { unlock } = await import("@/lib/zktoken/key-vault");
        const { KeyManager } = await import("@/lib/zktoken/keys");

        const privKeyHex = await unlock(address, pin);
        const kp = await KeyManager.fromPrivateKey(privKeyHex);

        setKeypair(kp);
        derivedForRef.current = address;
        setNeedsUnlock(false);

        return kp;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unlock failed";
        setError(msg);
        return null;
      }
    },
    [address]
  );

  /**
   * Lock the vault — clear keypair from memory.
   */
  const lock = useCallback(() => {
    setKeypair(null);
    derivedForRef.current = null;
    if (vaultStatus.exists) {
      setNeedsUnlock(true);
    }
  }, [vaultStatus.exists]);

  /**
   * Delete the vault entirely (requires re-derivation from wallet).
   */
  const resetVault = useCallback(async () => {
    if (!address) return;
    const { deleteVault } = await import("@/lib/zktoken/key-vault");
    deleteVault(address);
    setKeypair(null);
    derivedForRef.current = null;
    pendingKeyRef.current = null;
    setVaultStatus({ exists: false, method: null });
    setNeedsSetup(false);
    setNeedsUnlock(false);
  }, [address]);

  return {
    keypair,
    deriving,
    deriveKey,
    // Vault state
    vaultStatus,
    needsSetup,
    needsUnlock,
    error,
    // Vault actions
    setupVault,
    unlockVault,
    lock,
    resetVault,
    clearError: () => setError(null),
  };
}
