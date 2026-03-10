/**
 * note-backup.ts — Encrypted note backup (export / import)
 *
 * Encrypts all notes with an AES-256-GCM key derived from the user's
 * Baby Jubjub private key.  Only the same wallet can decrypt the backup.
 *
 * File format: human-readable JSON (.zkbak.json), openable in any text editor.
 * {
 *   "format": "shroud-backup-v1",
 *   "exportedAt": "...",
 *   "noteCount": N,
 *   "unspentCount": M,
 *   "hint": "...",
 *   "iv": "<base64>",
 *   "ciphertext": "<base64>"
 * }
 */

import type { Note } from "./types";
import { encodeNote, decodeNote } from "./note";

const FORMAT_ID = "shroud-backup-v1";
const IV_LENGTH = 12;

/** Base64-encode a Uint8Array. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Base64-decode a string to Uint8Array. */
function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Derive an AES-256-GCM CryptoKey from the Baby Jubjub private key. */
async function deriveKey(privateKey: bigint): Promise<CryptoKey> {
  const hex = privateKey.toString(16).padStart(64, "0");
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const digest = await crypto.subtle.digest("SHA-256", keyBytes);

  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface BackupFile {
  format: string;
  exportedAt: string;
  noteCount: number;
  unspentCount: number;
  hint: string;
  iv: string;
  ciphertext: string;
}

/**
 * Export notes as an encrypted JSON backup string.
 *
 * The returned string is valid JSON, openable in any text editor or browser.
 * Note data is AES-256-GCM encrypted — only the matching shielded key can
 * decrypt.  Metadata (counts, timestamp) is visible in cleartext.
 */
export async function exportNotesEncrypted(
  notes: Note[],
  privateKey: bigint
): Promise<string> {
  const payload = JSON.stringify({
    version: 1,
    notes: notes.map((n) => encodeNote(n)),
  });

  const key = await deriveKey(privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(payload)
  );

  const unspentCount = notes.filter((n) => !n.spent).length;

  const backup: BackupFile = {
    format: FORMAT_ID,
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    unspentCount,
    hint: `Shroud shielded note backup. ${notes.length} notes (${unspentCount} unspent). Encrypted with your shielded private key — import in the Shroud app to restore.`,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Import notes from an encrypted JSON backup string.
 *
 * @throws on wrong format, decryption failure (wrong key), or malformed data.
 */
export async function importNotesEncrypted(
  jsonString: string,
  privateKey: bigint
): Promise<Note[]> {
  let backup: BackupFile;
  try {
    backup = JSON.parse(jsonString);
  } catch {
    throw new Error("Not a valid backup file — could not parse JSON.");
  }

  if (backup.format !== FORMAT_ID) {
    throw new Error(
      `Unrecognized backup format: "${backup.format || "(none)"}". Expected "${FORMAT_ID}".`
    );
  }

  if (!backup.iv || !backup.ciphertext) {
    throw new Error("Backup file is missing encrypted data.");
  }

  const iv = fromBase64(backup.iv);
  const ciphertext = fromBase64(backup.ciphertext);
  const key = await deriveKey(privateKey);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      ciphertext as unknown as ArrayBuffer
    );
  } catch {
    throw new Error(
      "Decryption failed — wrong shielded key or corrupted file."
    );
  }

  const json = new TextDecoder().decode(plaintext);

  let parsed: { version: number; notes: string[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Backup file contains malformed data.");
  }

  if (!Array.isArray(parsed.notes)) {
    throw new Error("Backup file missing notes array.");
  }

  return parsed.notes.map((encoded) => decodeNote(encoded));
}
