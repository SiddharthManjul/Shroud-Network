/**
 * Encrypted memo protocol.
 *
 * On-chain bytes layout (per CLAUDE.md):
 *   ek_pub (32B compressed x-coord) || nonce (12B) || ciphertext (128B) || GCM tag (16B)
 *   = 188 bytes total
 *
 * Encryption:
 *   1. Sender generates ephemeral Baby Jubjub keypair (ek_priv, ek_pub)
 *   2. Shared secret = ECDH(ek_priv, recipient_pub)  → Baby Jubjub point
 *   3. AES key = SHA-256(shared_secret.x || shared_secret.y)  (32 bytes)
 *   4. Plaintext = ABI-packed (amount, blinding, secret, nullifier_preimage) = 4×32 = 128 bytes
 *   5. Encrypt with AES-256-GCM
 *
 * Decryption (scanning):
 *   1. Decode ek_pub.x from first 32 bytes
 *   2. Shared secret = ECDH(my_priv, ek_pub)
 *   3. Derive AES key, attempt GCM decrypt
 *   4. If auth tag passes → note is mine → decode plaintext
 */

import { ecdh } from './wallet';
import type { InternalNote } from './wallet';

// ─── Encoding constants ───────────────────────────────────────────────────────

const EK_PUB_BYTES = 32;  // compressed x-coord of ephemeral pubkey
const NONCE_BYTES = 12;
const PLAINTEXT_BYTES = 128; // 4 × 32 bytes
const TAG_BYTES = 16;
export const MEMO_BYTES = EK_PUB_BYTES + NONCE_BYTES + PLAINTEXT_BYTES + TAG_BYTES; // 188

// ─── circomlibjs lazy loader ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BabyJub = any;
let _babyJub: BabyJub | null = null;

async function getBabyJub(): Promise<BabyJub> {
  if (_babyJub) return _babyJub;
  const { buildBabyjub } = await import('circomlibjs');
  _babyJub = await buildBabyjub();
  return _babyJub;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytes32ToBigint(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 0; i < 32; i++) {
    value = (value << 8n) | BigInt(bytes[i]!);
  }
  return value;
}

async function deriveAesKey(sharedPoint: [bigint, bigint]): Promise<CryptoKey> {
  const material = new Uint8Array(64);
  material.set(bigintToBytes32(sharedPoint[0]), 0);
  material.set(bigintToBytes32(sharedPoint[1]), 32);

  const hash = await crypto.subtle.digest('SHA-256', material);

  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Plaintext codec ──────────────────────────────────────────────────────────

function encodePlaintext(
  amount: bigint,
  blinding: bigint,
  secret: bigint,
  nullifierPreimage: bigint,
): Uint8Array {
  const buf = new Uint8Array(PLAINTEXT_BYTES);
  buf.set(bigintToBytes32(amount), 0);
  buf.set(bigintToBytes32(blinding), 32);
  buf.set(bigintToBytes32(secret), 64);
  buf.set(bigintToBytes32(nullifierPreimage), 96);
  return buf;
}

function decodePlaintext(buf: Uint8Array): {
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
} {
  return {
    amount: bytes32ToBigint(buf.slice(0, 32)),
    blinding: bytes32ToBigint(buf.slice(32, 64)),
    secret: bytes32ToBigint(buf.slice(64, 96)),
    nullifierPreimage: bytes32ToBigint(buf.slice(96, 128)),
  };
}

// ─── Ephemeral keypair ────────────────────────────────────────────────────────

const SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

function bigintToLEBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

async function generateEphemeralKeypair(): Promise<{
  privKey: bigint;
  pubKey: [bigint, bigint];
}> {
  const babyJub = await getBabyJub();
  const F = babyJub.F;

  const raw = crypto.getRandomValues(new Uint8Array(32));
  let privKey = 0n;
  for (const b of raw) {
    privKey = (privKey << 8n) | BigInt(b);
  }
  privKey = (privKey % (SUBGROUP_ORDER - 1n)) + 1n;

  const privBytes = bigintToLEBytes32(privKey);
  const pubPoint: [unknown, unknown] = babyJub.mulPointEscalar(babyJub.Base8, privBytes);

  return {
    privKey,
    pubKey: [F.toObject(pubPoint[0]) as bigint, F.toObject(pubPoint[1]) as bigint],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt a note's private fields into an on-chain memo blob.
 * Returns a hex string (without 0x prefix).
 */
export async function encryptMemo(
  amount: bigint,
  blinding: bigint,
  secret: bigint,
  nullifierPreimage: bigint,
  recipientPublicKey: [bigint, bigint],
): Promise<string> {
  const ephemeral = await generateEphemeralKeypair();
  const sharedPoint = await ecdh(ephemeral.privKey, recipientPublicKey);
  const aesKey = await deriveAesKey(sharedPoint);

  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const plaintext = encodePlaintext(amount, blinding, secret, nullifierPreimage);

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    plaintext,
  );

  // Layout: ek_pub_x (32B) || nonce (12B) || ciphertext+tag (144B)
  const memo = new Uint8Array(MEMO_BYTES);
  memo.set(bigintToBytes32(ephemeral.pubKey[0]), 0);
  memo.set(nonce, EK_PUB_BYTES);
  memo.set(new Uint8Array(ciphertextWithTag), EK_PUB_BYTES + NONCE_BYTES);

  return Array.from(memo)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Attempt to decrypt a memo using the recipient's private key.
 * Returns null if the memo is not addressed to this key (GCM auth fails).
 */
export async function tryDecryptMemo(
  memoHex: string,
  myPrivateKey: bigint,
): Promise<{
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
} | null> {
  const clean = memoHex.startsWith('0x') ? memoHex.slice(2) : memoHex;
  if (clean.length < MEMO_BYTES * 2) return null;

  const memoBytes = new Uint8Array(MEMO_BYTES);
  for (let i = 0; i < MEMO_BYTES; i++) {
    memoBytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  const ekPubX = bytes32ToBigint(memoBytes.slice(0, EK_PUB_BYTES));
  const nonce = memoBytes.slice(EK_PUB_BYTES, EK_PUB_BYTES + NONCE_BYTES);
  const ciphertextWithTag = memoBytes.slice(EK_PUB_BYTES + NONCE_BYTES);

  // Recover ephemeral public key y-coordinate via Baby Jubjub curve equation
  const babyJub = await getBabyJub();
  const F = babyJub.F;
  const ekPubPoint = recoverPointFromX(ekPubX, babyJub, F);
  if (!ekPubPoint) return null;

  const sharedPoint = await ecdh(myPrivateKey, ekPubPoint);
  const aesKey = await deriveAesKey(sharedPoint);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      ciphertextWithTag,
    );
    return decodePlaintext(new Uint8Array(plaintext));
  } catch {
    // GCM authentication failed → not for us
    return null;
  }
}

/**
 * Scan a batch of raw memo hex strings and return all that decrypt successfully.
 */
export async function scanMemos(
  memos: Array<{ hex: string; meta: Record<string, unknown> }>,
  myPrivateKey: bigint,
): Promise<Array<{
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
  meta: Record<string, unknown>;
}>> {
  const results = [];
  for (const { hex, meta } of memos) {
    const decoded = await tryDecryptMemo(hex, myPrivateKey);
    if (decoded !== null) {
      results.push({ ...decoded, meta });
    }
  }
  return results;
}

// ─── Curve helper ─────────────────────────────────────────────────────────────

/**
 * Recover a Baby Jubjub point from an x-coordinate.
 * Baby Jubjub twisted Edwards: a*x^2 + y^2 = 1 + d*x^2*y^2
 * Solve for y: y^2 = (1 - a*x^2) / (1 - d*x^2)  (mod p)
 */
function recoverPointFromX(
  x: bigint,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  babyJub: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F: any,
): [bigint, bigint] | null {
  try {
    const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const a = 168700n;
    const d = 168696n;

    const x2 = (x * x) % p;
    const numerator = (1n - (a * x2) % p + p) % p;
    const denominator = (1n - (d * x2) % p + p) % p;

    // Modular inverse of denominator
    const denomInv = modpow(denominator, p - 2n, p);
    const y2 = (numerator * denomInv) % p;

    // Square root mod p (p ≡ 3 mod 4, so sqrt = y2^((p+1)/4))
    const y = modpow(y2, (p + 1n) / 4n, p);

    // Verify: y^2 == y2
    if ((y * y) % p !== y2) return null;

    // Verify the point is on the curve
    const lhs = (a * x2 + y * y) % p;
    const rhs = (1n + d * x2 % p * ((y * y) % p)) % p;
    if (lhs !== rhs) return null;

    return [x, y];
  } catch {
    return null;
  }
}

function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e /= 2n;
  }
  return result;
}

// Re-export for testing
export { encodePlaintext, decodePlaintext, deriveAesKey };
export type { InternalNote };
