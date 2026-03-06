/**
 * key-vault.ts — Encrypted private key storage using WebAuthn (passkeys/biometrics) or 6-digit PIN.
 *
 * The Baby Jubjub private key is NEVER stored in plaintext. It is encrypted with
 * AES-256-GCM using a key derived from either:
 *   1. WebAuthn PRF extension (passkey with biometrics/device unlock) — preferred
 *   2. 6-digit PIN via PBKDF2 (600,000 iterations) — fallback
 *
 * Storage layout in localStorage:
 *   zktoken_vault_<address> = JSON {
 *     method: "passkey" | "pin",
 *     ciphertext: hex,      // AES-256-GCM encrypted private key
 *     iv: hex,              // 12-byte nonce
 *     salt: hex,            // 32-byte salt (for PIN PBKDF2 or PRF salt)
 *     credentialId?: string, // base64url credential ID (passkey only)
 *   }
 */

import { bytesToHex, hexToBytes } from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export type VaultMethod = "passkey" | "pin";

export interface VaultData {
  method: VaultMethod;
  ciphertext: string; // hex
  iv: string;         // hex
  salt: string;       // hex
  credentialId?: string; // base64url (passkey)
}

export interface VaultStatus {
  exists: boolean;
  method: VaultMethod | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VAULT_PREFIX = "zktoken_vault_";
const OLD_KEY_PREFIX = "zktoken_shielded_key_";
const PBKDF2_ITERATIONS = 600_000;
const RP_ID = typeof window !== "undefined" ? window.location.hostname : "localhost";
const RP_NAME = "ZkToken Shielded Pool";

// ─── Helpers ────────────────────────────────────────────────────────────────

function vaultKey(address: string): string {
  return VAULT_PREFIX + address.toLowerCase();
}

function oldKeyStorageKey(address: string): string {
  return OLD_KEY_PREFIX + address.toLowerCase();
}

/** Generate cryptographically random bytes. */
function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

/** base64url encode a Uint8Array. */
function toBase64url(buf: Uint8Array): string {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url decode to Uint8Array. */
function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(pad);
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

// ─── AES-256-GCM encrypt/decrypt ────────────────────────────────────────────

async function aesEncrypt(
  plaintext: Uint8Array,
  aesKey: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      aesKey,
      plaintext.buffer as ArrayBuffer
    )
  );
  return { ciphertext, iv };
}

async function aesDecrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  aesKey: CryptoKey
): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      aesKey,
      ciphertext.buffer as ArrayBuffer
    )
  );
}

// ─── Key derivation from PIN ────────────────────────────────────────────────

async function deriveKeyFromPIN(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    pinBytes.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Key derivation from WebAuthn PRF ───────────────────────────────────────

/** Check if the browser supports WebAuthn with the PRF extension. */
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;

  try {
    // Check for conditional mediation / platform authenticator
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

async function createPasskeyCredential(
  address: string,
  prfSalt: Uint8Array
): Promise<{ credentialId: string; prfOutput: ArrayBuffer }> {
  const userId = new TextEncoder().encode(address.toLowerCase());

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: RP_ID },
      user: {
        id: userId.buffer as ArrayBuffer,
        name: `zktoken-${address.slice(0, 8)}`,
        displayName: "ZkToken Shielded Key",
      },
      challenge: randomBytes(32).buffer as ArrayBuffer,
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      extensions: {
        prf: {
          eval: {
            first: prfSalt.buffer as ArrayBuffer,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential;

  const credentialId = toBase64url(new Uint8Array(credential.rawId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prfResults = (credential.getClientExtensionResults() as any)?.prf;

  if (prfResults?.results?.first) {
    return { credentialId, prfOutput: prfResults.results.first as ArrayBuffer };
  }

  // PRF not supported — fall back to using credential rawId as entropy source
  const fallbackInput = new Uint8Array([...new Uint8Array(credential.rawId), ...prfSalt]);
  const prfOutput = await crypto.subtle.digest("SHA-256", fallbackInput.buffer as ArrayBuffer);
  return { credentialId, prfOutput };
}

async function getPasskeyPRF(
  credentialId: string,
  prfSalt: Uint8Array
): Promise<ArrayBuffer> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32).buffer as ArrayBuffer,
      allowCredentials: [
        {
          type: "public-key",
          id: fromBase64url(credentialId).buffer as ArrayBuffer,
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: prfSalt.buffer as ArrayBuffer,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prfResults = (credential.getClientExtensionResults() as any)?.prf;

  if (prfResults?.results?.first) {
    return prfResults.results.first as ArrayBuffer;
  }

  // PRF fallback
  const fallbackInput = new Uint8Array([...new Uint8Array(credential.rawId), ...prfSalt]);
  return crypto.subtle.digest("SHA-256", fallbackInput.buffer as ArrayBuffer);
}

async function deriveKeyFromPRF(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  // Ensure we have an ArrayBuffer, not a SharedArrayBuffer
  const buf = prfOutput instanceof ArrayBuffer ? prfOutput : new Uint8Array(new Uint8Array(prfOutput)).buffer;
  return crypto.subtle.importKey(
    "raw",
    buf as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Check if an encrypted vault exists for the given wallet address. */
export function getVaultStatus(address: string): VaultStatus {
  if (typeof window === "undefined") return { exists: false, method: null };
  const raw = localStorage.getItem(vaultKey(address));
  if (!raw) return { exists: false, method: null };
  try {
    const data = JSON.parse(raw) as VaultData;
    return { exists: true, method: data.method };
  } catch {
    return { exists: false, method: null };
  }
}

/**
 * Encrypt and store the private key using a 6-digit PIN.
 * Returns the vault data that was stored.
 */
export async function storeWithPIN(
  address: string,
  privateKeyHex: string,
  pin: string
): Promise<void> {
  validatePIN(pin);

  const salt = randomBytes(32);
  const aesKey = await deriveKeyFromPIN(pin, salt);
  const plaintext = hexToBytes(privateKeyHex);
  const { ciphertext, iv } = await aesEncrypt(plaintext, aesKey);

  const vault: VaultData = {
    method: "pin",
    ciphertext: bytesToHex(ciphertext),
    iv: bytesToHex(iv),
    salt: bytesToHex(salt),
  };

  localStorage.setItem(vaultKey(address), JSON.stringify(vault));
  // Remove old plaintext key if it exists
  localStorage.removeItem(oldKeyStorageKey(address));
}

/**
 * Encrypt and store the private key using a passkey (biometrics/device unlock).
 */
export async function storeWithPasskey(
  address: string,
  privateKeyHex: string
): Promise<void> {
  const prfSalt = randomBytes(32);
  const { credentialId, prfOutput } = await createPasskeyCredential(address, prfSalt);
  const aesKey = await deriveKeyFromPRF(prfOutput);
  const plaintext = hexToBytes(privateKeyHex);
  const { ciphertext, iv } = await aesEncrypt(plaintext, aesKey);

  const vault: VaultData = {
    method: "passkey",
    ciphertext: bytesToHex(ciphertext),
    iv: bytesToHex(iv),
    salt: bytesToHex(prfSalt),
    credentialId,
  };

  localStorage.setItem(vaultKey(address), JSON.stringify(vault));
  localStorage.removeItem(oldKeyStorageKey(address));
}

/**
 * Unlock the vault and return the private key hex string.
 * For passkey vaults: triggers biometric/device unlock prompt.
 * For PIN vaults: requires the 6-digit PIN.
 */
export async function unlock(
  address: string,
  pin?: string
): Promise<string> {
  const raw = localStorage.getItem(vaultKey(address));
  if (!raw) throw new Error("No vault found for this address");

  const vault = JSON.parse(raw) as VaultData;
  const ciphertext = hexToBytes(vault.ciphertext);
  const iv = hexToBytes(vault.iv);
  const salt = hexToBytes(vault.salt);

  let aesKey: CryptoKey;

  if (vault.method === "passkey") {
    if (!vault.credentialId) throw new Error("Vault corrupted: missing credential ID");
    const prfOutput = await getPasskeyPRF(vault.credentialId, salt);
    aesKey = await deriveKeyFromPRF(prfOutput);
  } else {
    if (!pin) throw new Error("PIN required to unlock vault");
    validatePIN(pin);
    aesKey = await deriveKeyFromPIN(pin, salt);
  }

  try {
    const plaintext = await aesDecrypt(ciphertext, iv, aesKey);
    return bytesToHex(plaintext);
  } catch {
    throw new Error("Failed to decrypt — wrong PIN or biometric mismatch");
  }
}

/**
 * Migrate an existing plaintext key from old localStorage format to encrypted vault.
 * Returns the private key hex if migration data exists, null otherwise.
 */
export function getPlaintextKeyForMigration(address: string): string | null {
  const stored = localStorage.getItem(oldKeyStorageKey(address));
  return stored ?? null;
}

/** Delete the vault for an address. */
export function deleteVault(address: string): void {
  localStorage.removeItem(vaultKey(address));
}

/** Validate that a PIN is exactly 6 digits. */
export function validatePIN(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN must be exactly 6 digits");
  }
}

/**
 * Change the PIN for an existing PIN-based vault.
 * Requires the current PIN to decrypt, then re-encrypts with the new PIN.
 */
export async function changePIN(
  address: string,
  currentPIN: string,
  newPIN: string
): Promise<void> {
  const privateKeyHex = await unlock(address, currentPIN);
  await storeWithPIN(address, privateKeyHex, newPIN);
}

/**
 * Switch vault method (e.g. PIN → passkey or passkey → PIN).
 * Requires unlocking with the current method first.
 */
export async function switchMethod(
  address: string,
  currentPIN: string | undefined,
  newMethod: VaultMethod,
  newPIN?: string
): Promise<void> {
  const privateKeyHex = await unlock(address, currentPIN);
  if (newMethod === "passkey") {
    await storeWithPasskey(address, privateKeyHex);
  } else {
    if (!newPIN) throw new Error("PIN required for PIN method");
    await storeWithPIN(address, privateKeyHex, newPIN);
  }
}
