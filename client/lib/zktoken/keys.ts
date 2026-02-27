/**
 * keys.ts — KeyManager
 *
 * Baby Jubjub keypair generation and management.
 *
 * Baby Jubjub is a twisted Edwards curve whose base field is the BN254 scalar
 * field.  circomlibjs exposes the curve operations via `buildBabyjub()`.
 *
 * Subgroup order L = 2736030358979909402780800718157159386076813972158567259200215660948447373041
 *
 * A private key is a random scalar in [1, L-1].
 * The public key is privateKey * Base8 (the standard Baby Jubjub generator).
 *
 * NOTE: Base8 = 8 * Base (cofactor clearing) — circomlibjs' `babyJub.Base8`.
 */

import { getBabyJub } from "./crypto";
import type { BabyJubKeyPair, BabyJubPoint } from "./types";
import { bytesToHex } from "./utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Baby Jubjub subgroup order L.
 * Private keys must be in [1, L-1].
 */
export const SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random bigint in [1, max-1].
 * Uses rejection sampling to avoid modular bias.
 */
function randomScalarBelow(max: bigint): bigint {
  const byteLen = Math.ceil(max.toString(16).length / 2);
  while (true) {
    const bytes = new Uint8Array(byteLen);
    crypto.getRandomValues(bytes);
    const value = BigInt("0x" + bytesToHex(bytes));
    if (value >= 1n && value < max) {
      return value;
    }
  }
}

/** Convert a Baby Jubjub point (F1 field elements) to a [bigint, bigint] tuple. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pointToBigInt(babyJub: any, pt: any[]): BabyJubPoint {
  return [babyJub.F.toObject(pt[0]) as bigint, babyJub.F.toObject(pt[1]) as bigint];
}

// ─── KeyManager ───────────────────────────────────────────────────────────────

export class KeyManager {
  /**
   * Generate a new random Baby Jubjub keypair.
   * The private key is sampled from a CSPRNG in [1, L-1].
   */
  static async generate(): Promise<BabyJubKeyPair> {
    const babyJub = await getBabyJub();
    const privateKey = randomScalarBelow(SUBGROUP_ORDER);
    const pubKeyRaw = babyJub.mulPointEscalar(babyJub.Base8, privateKey);
    const publicKey = pointToBigInt(babyJub, pubKeyRaw);
    return { privateKey, publicKey };
  }

  /**
   * Restore a keypair from a hex-encoded private key string.
   * @param hexPrivateKey  64-char hex string (without 0x prefix), or with 0x.
   */
  static async fromPrivateKey(hexPrivateKey: string): Promise<BabyJubKeyPair> {
    const babyJub = await getBabyJub();
    const clean = hexPrivateKey.startsWith("0x")
      ? hexPrivateKey.slice(2)
      : hexPrivateKey;
    const privateKey = BigInt("0x" + clean);
    if (privateKey < 1n || privateKey >= SUBGROUP_ORDER) {
      throw new Error("KeyManager: private key out of valid range [1, L-1]");
    }
    const pubKeyRaw = babyJub.mulPointEscalar(babyJub.Base8, privateKey);
    const publicKey = pointToBigInt(babyJub, pubKeyRaw);
    return { privateKey, publicKey };
  }

  /**
   * Derive just the public key from a private key.
   * Useful when you already have the KeyPair but want to share the pubkey.
   */
  static async derivePublicKey(privateKey: bigint): Promise<BabyJubPoint> {
    const babyJub = await getBabyJub();
    if (privateKey < 1n || privateKey >= SUBGROUP_ORDER) {
      throw new Error("KeyManager: private key out of valid range [1, L-1]");
    }
    const pubKeyRaw = babyJub.mulPointEscalar(babyJub.Base8, privateKey);
    return pointToBigInt(babyJub, pubKeyRaw);
  }

  /** Encode private key as a 0x-prefixed 64-char hex string. */
  static privateKeyToHex(privateKey: bigint): string {
    return "0x" + privateKey.toString(16).padStart(64, "0");
  }

  /** Encode public key as a JSON-serializable object with hex strings. */
  static publicKeyToHex(publicKey: BabyJubPoint): { x: string; y: string } {
    return {
      x: "0x" + publicKey[0].toString(16).padStart(64, "0"),
      y: "0x" + publicKey[1].toString(16).padStart(64, "0"),
    };
  }

  /** Parse a hex-encoded public key back to BabyJubPoint. */
  static publicKeyFromHex(hex: { x: string; y: string }): BabyJubPoint {
    return [BigInt(hex.x), BigInt(hex.y)];
  }

  /**
   * Perform ECDH key exchange on Baby Jubjub.
   *
   * Given your private key and the other party's public key, compute the
   * shared EC point.  Use the x-coordinate as the shared secret.
   *
   *   shared = myPrivKey * theirPubKey
   *
   * Both parties compute the same point because:
   *   myPrivKey * (theirPrivKey * G) = theirPrivKey * (myPrivKey * G)
   */
  static async ecdh(
    myPrivateKey: bigint,
    theirPublicKey: BabyJubPoint
  ): Promise<BabyJubPoint> {
    const babyJub = await getBabyJub();
    const theirPtRaw = [
      babyJub.F.e(theirPublicKey[0]),
      babyJub.F.e(theirPublicKey[1]),
    ];
    const sharedRaw = babyJub.mulPointEscalar(theirPtRaw, myPrivateKey);
    return pointToBigInt(babyJub, sharedRaw);
  }
}
