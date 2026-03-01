"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./use-wallet";
import type { BabyJubKeyPair } from "@/lib/zktoken/types";

const STORAGE_PREFIX = "zktoken_shielded_key_";

/**
 * Derives a persistent Baby Jubjub keypair from the connected EVM wallet.
 *
 * On first use for a given address, prompts the user to sign a deterministic
 * message. The signature is hashed and reduced mod L (Baby Jubjub subgroup
 * order) to produce a private key. The keypair is cached in localStorage
 * so the user only signs once per address.
 *
 * This ensures:
 *  - Same wallet always produces the same shielded key
 *  - No extra seed phrase to manage
 *  - Key is recoverable by signing again from the same wallet
 */
export function useShieldedKey() {
  const { address, signer } = useWallet();
  const [keypair, setKeypair] = useState<BabyJubKeyPair | null>(null);
  const [deriving, setDeriving] = useState(false);
  const derivedForRef = useRef<string | null>(null);

  // Try to load from localStorage on address change
  useEffect(() => {
    if (!address) {
      setKeypair(null);
      derivedForRef.current = null;
      return;
    }

    if (derivedForRef.current === address) return;

    const stored = localStorage.getItem(STORAGE_PREFIX + address.toLowerCase());
    if (stored) {
      // Restore keypair from stored private key
      (async () => {
        const { KeyManager } = await import("@/lib/zktoken/keys");
        const kp = await KeyManager.fromPrivateKey(stored);
        setKeypair(kp);
        derivedForRef.current = address;
      })();
    }
  }, [address]);

  const deriveKey = useCallback(async () => {
    if (!signer || !address) return null;

    setDeriving(true);
    try {
      const { KeyManager, SUBGROUP_ORDER } = await import("@/lib/zktoken/keys");
      const { keccak256, toUtf8Bytes } = await import("ethers");

      // Sign a deterministic message
      const message = "zktoken-shielded-key-v1:" + address.toLowerCase();
      const signature = await signer.signMessage(message);

      // Hash the signature to get a uniform 256-bit value
      const hash = keccak256(toUtf8Bytes(signature));
      // Reduce mod subgroup order to get a valid private key
      let privKey = BigInt(hash) % SUBGROUP_ORDER;
      if (privKey === 0n) privKey = 1n;

      const kp = await KeyManager.fromPrivateKey(
        privKey.toString(16).padStart(64, "0")
      );

      // Persist so user doesn't need to sign again
      localStorage.setItem(
        STORAGE_PREFIX + address.toLowerCase(),
        privKey.toString(16).padStart(64, "0")
      );

      setKeypair(kp);
      derivedForRef.current = address;
      return kp;
    } finally {
      setDeriving(false);
    }
  }, [signer, address]);

  return { keypair, deriving, deriveKey };
}
