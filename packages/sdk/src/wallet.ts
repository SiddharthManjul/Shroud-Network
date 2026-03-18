/**
 * Wallet module — self-contained Baby Jubjub keypair management.
 *
 * All Baby Jubjub operations use circomlibjs directly so this package
 * has no dependency on the monorepo's client/lib/zktoken/* modules.
 */

// circomlibjs is a CJS package; we access it through dynamic import to remain
// compatible with both bundler (tree-shaking) and Node.js ESM environments.
import type { ShroudWallet } from './types';
import { InvalidKeyError } from './errors';

// ─── Baby Jubjub parameters ───────────────────────────────────────────────────

/** BN254 scalar field prime */
const FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Baby Jubjub subgroup order */
const SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

// ─── Internal state ───────────────────────────────────────────────────────────

export interface WalletState {
  keypair: { privateKey: bigint; publicKey: [bigint, bigint] };
  /** Per-token note storage: tokenAddress (lowercase) → serialised notes JSON */
  notesByToken: Map<string, InternalNote[]>;
}

/** Minimal in-process note — stored only in memory (or serialised to StorageAdapter by client.ts) */
export interface InternalNote {
  amount: bigint;
  blinding: bigint;
  secret: bigint;
  nullifierPreimage: bigint;
  ownerPublicKey: [bigint, bigint];
  leafIndex: number;
  noteCommitment: bigint;
  pedersenCommitment: [bigint, bigint];
  nullifier: bigint;
  spent: boolean;
  tokenAddress: string;
  createdAtBlock: number;
}

/** walletAddress → WalletState */
const walletRegistry = new Map<string, WalletState>();

// ─── circomlibjs lazy loader ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CircomlibBabyJub = any;

let _babyJub: CircomlibBabyJub | null = null;

async function getBabyJub(): Promise<CircomlibBabyJub> {
  if (_babyJub) return _babyJub;
  // circomlibjs uses a builder pattern
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildBabyjub } = await import('circomlibjs');
  _babyJub = await buildBabyjub();
  return _babyJub;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CircomlibPoseidon = any;
let _poseidon: CircomlibPoseidon | null = null;

async function getPoseidon(): Promise<CircomlibPoseidon> {
  if (_poseidon) return _poseidon;
  const { buildPoseidon } = await import('circomlibjs');
  _poseidon = await buildPoseidon();
  return _poseidon;
}

// ─── Key utilities ────────────────────────────────────────────────────────────

/**
 * Clamp a random 32-byte buffer into a valid Baby Jubjub private key.
 * The private key must be < SUBGROUP_ORDER.
 */
function bytesToPrivateKey(bytes: Uint8Array): bigint {
  // Interpret as big-endian bigint, then reduce mod SUBGROUP_ORDER
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  // Ensure non-zero
  const key = value % SUBGROUP_ORDER;
  return key === 0n ? 1n : key;
}

/**
 * HKDF-SHA-256 (simplified, extract+expand) for deterministic key derivation.
 * Returns 32 pseudo-random bytes.
 */
async function hkdf(
  inputKeyMaterial: Uint8Array,
  info: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = encoder.encode('shroud-bjj-v1');
  const infoBytes = encoder.encode(info);

  const prk = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      salt,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ),
    inputKeyMaterial,
  );

  const okm = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      prk,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ),
    new Uint8Array([...infoBytes, 0x01]),
  );

  return new Uint8Array(okm);
}

async function deriveKeypair(
  privKey: bigint,
): Promise<{ privateKey: bigint; publicKey: [bigint, bigint] }> {
  const babyJub = await getBabyJub();
  const F = babyJub.F;

  // mulPointEscalar expects a Uint8Array representation of the scalar
  const privKeyBytes = bigintToLEBytes(privKey, 32);
  const pubPoint: [unknown, unknown] = babyJub.mulPointEscalar(
    babyJub.Base8,
    privKeyBytes,
  );

  const pubX = F.toObject(pubPoint[0]) as bigint;
  const pubY = F.toObject(pubPoint[1]) as bigint;

  return { privateKey: privKey, publicKey: [pubX, pubY] };
}

function bigintToLEBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

function walletAddress(pubKey: [bigint, bigint]): string {
  return '0x' + pubKey[0].toString(16).padStart(64, '0');
}

// ─── Public factory functions ─────────────────────────────────────────────────

/**
 * Create a new random wallet. Uses CSPRNG internally.
 */
export async function createRandomWallet(): Promise<ShroudWallet> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const privKey = bytesToPrivateKey(raw);
  return buildWallet(privKey);
}

/**
 * Deterministically derive a wallet from a seed phrase or byte array.
 * The same seed always produces the same keypair.
 */
export async function createWalletFromSeed(
  seed: string | Uint8Array,
): Promise<ShroudWallet> {
  let seedBytes: Uint8Array;
  if (typeof seed === 'string') {
    seedBytes = new TextEncoder().encode(seed);
  } else {
    seedBytes = seed;
  }
  const derived = await hkdf(seedBytes, 'shroud-bjj-private-key');
  const privKey = bytesToPrivateKey(derived);
  return buildWallet(privKey);
}

/**
 * Restore a wallet from a hex-encoded private key string.
 */
export async function restoreWallet(privateKeyHex: string): Promise<ShroudWallet> {
  const clean = privateKeyHex.startsWith('0x')
    ? privateKeyHex.slice(2)
    : privateKeyHex;

  if (!/^[0-9a-fA-F]{1,64}$/.test(clean)) {
    throw new InvalidKeyError('Expected a 1-64 character hex string');
  }

  const privKey = BigInt('0x' + clean);

  if (privKey === 0n || privKey >= SUBGROUP_ORDER) {
    throw new InvalidKeyError(
      `Private key must be in range [1, subgroup_order). Got: ${privKey}`,
    );
  }

  return buildWallet(privKey);
}

/** Export private key as a 0x-prefixed hex string */
export function exportWallet(wallet: ShroudWallet): string {
  const state = getWalletState(wallet);
  return '0x' + state.keypair.privateKey.toString(16).padStart(64, '0');
}

/** Parse a recipient public key from a hex address or JSON string */
export function parseRecipientPublicKey(input: string): [bigint, bigint] {
  // Try JSON format first: {"x": "0x...", "y": "0x..."}
  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input) as { x: string; y: string };
      return [BigInt(parsed.x), BigInt(parsed.y)];
    } catch {
      throw new InvalidKeyError('Invalid JSON public key format');
    }
  }

  // Hex x-coordinate only (ShroudWallet.address format)
  const clean = input.startsWith('0x') ? input.slice(2) : input;
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new InvalidKeyError(
      'Recipient key must be a 32-byte hex string (x coordinate) or JSON {x, y}',
    );
  }

  // We only have x — we cannot reconstruct y without curve arithmetic.
  // Callers that need the full point must pass JSON format.
  // For ECDH purposes inside the circuit, only x is needed as a Poseidon input.
  // Return y=0n as sentinel; the caller must handle this limitation.
  return [BigInt('0x' + clean), 0n];
}

// ─── ECDH ─────────────────────────────────────────────────────────────────────

/**
 * Baby Jubjub ECDH: shared_secret = my_priv * their_pub
 * Returns the shared EC point [x, y].
 */
export async function ecdh(
  myPrivateKey: bigint,
  theirPublicKey: [bigint, bigint],
): Promise<[bigint, bigint]> {
  const babyJub = await getBabyJub();
  const F = babyJub.F;

  const theirPoint = [
    F.e(theirPublicKey[0]),
    F.e(theirPublicKey[1]),
  ];

  const scalar = bigintToLEBytes(myPrivateKey, 32);
  const shared: [unknown, unknown] = babyJub.mulPointEscalar(theirPoint, scalar);

  return [F.toObject(shared[0]) as bigint, F.toObject(shared[1]) as bigint];
}

// ─── Note creation ────────────────────────────────────────────────────────────

/**
 * Create a new in-memory note for a deposit or received transfer.
 * Computes the Pedersen commitment and note commitment from scratch.
 */
export async function createNote(
  amount: bigint,
  ownerPublicKey: [bigint, bigint],
  tokenAddress: string,
  createdAtBlock: number,
): Promise<Omit<InternalNote, 'leafIndex' | 'nullifier'>> {
  const babyJub = await getBabyJub();
  const poseidon = await getPoseidon();
  const F = babyJub.F;

  // Random 31-byte values (< FIELD_PRIME)
  const blinding = randomScalar();
  const secret = randomScalar();
  const nullifierPreimage = randomScalar();

  // Hardcoded G and H for Baby Jubjub (from CLAUDE.md / gen_h_point.js)
  const G = babyJub.Base8; // (Gx, Gy)
  const Hx = 11991158623290214195992298073348058700477835202184614670606597982489144817024n;
  const Hy = 21045328185755068580775605509882913360526674377439752325760858626206285218496n;
  const H = [F.e(Hx), F.e(Hy)];

  // Pedersen commitment: amount*G + blinding*H
  const amountBytes = bigintToLEBytes(amount, 32);
  const blindingBytes = bigintToLEBytes(blinding, 32);

  const amountG = babyJub.mulPointEscalar(G, amountBytes);
  const blindingH = babyJub.mulPointEscalar(H, blindingBytes);
  const pedersenPoint: [unknown, unknown] = babyJub.addPoint(amountG, blindingH);

  const pedersenX = F.toObject(pedersenPoint[0]) as bigint;
  const pedersenY = F.toObject(pedersenPoint[1]) as bigint;

  // Note commitment: Poseidon(ped_x, ped_y, secret, nullifier_preimage, owner_pk_x)
  const noteCommitmentRaw = poseidon([
    pedersenX,
    pedersenY,
    secret,
    nullifierPreimage,
    ownerPublicKey[0],
  ]);
  const noteCommitment = poseidon.F.toObject(noteCommitmentRaw) as bigint;

  return {
    amount,
    blinding,
    secret,
    nullifierPreimage,
    ownerPublicKey,
    noteCommitment,
    pedersenCommitment: [pedersenX, pedersenY],
    spent: false,
    tokenAddress: tokenAddress.toLowerCase(),
    createdAtBlock,
  };
}

/**
 * Compute the nullifier for a note.
 * nullifier = Poseidon(nullifier_preimage, secret, leaf_index)
 */
export async function computeNullifier(
  nullifierPreimage: bigint,
  secret: bigint,
  leafIndex: number,
): Promise<bigint> {
  const poseidon = await getPoseidon();
  const raw = poseidon([nullifierPreimage, secret, BigInt(leafIndex)]);
  return poseidon.F.toObject(raw) as bigint;
}

// ─── Serialisation ────────────────────────────────────────────────────────────

export function serialiseNote(note: InternalNote): string {
  return JSON.stringify({
    amount: note.amount.toString(),
    blinding: note.blinding.toString(),
    secret: note.secret.toString(),
    nullifierPreimage: note.nullifierPreimage.toString(),
    ownerPublicKey: [note.ownerPublicKey[0].toString(), note.ownerPublicKey[1].toString()],
    leafIndex: note.leafIndex,
    noteCommitment: note.noteCommitment.toString(),
    pedersenCommitment: [note.pedersenCommitment[0].toString(), note.pedersenCommitment[1].toString()],
    nullifier: note.nullifier.toString(),
    spent: note.spent,
    tokenAddress: note.tokenAddress,
    createdAtBlock: note.createdAtBlock,
  });
}

export function deserialiseNote(json: string): InternalNote {
  const raw = JSON.parse(json) as {
    amount: string;
    blinding: string;
    secret: string;
    nullifierPreimage: string;
    ownerPublicKey: [string, string];
    leafIndex: number;
    noteCommitment: string;
    pedersenCommitment: [string, string];
    nullifier: string;
    spent: boolean;
    tokenAddress: string;
    createdAtBlock: number;
  };
  return {
    amount: BigInt(raw.amount),
    blinding: BigInt(raw.blinding),
    secret: BigInt(raw.secret),
    nullifierPreimage: BigInt(raw.nullifierPreimage),
    ownerPublicKey: [BigInt(raw.ownerPublicKey[0]), BigInt(raw.ownerPublicKey[1])],
    leafIndex: raw.leafIndex,
    noteCommitment: BigInt(raw.noteCommitment),
    pedersenCommitment: [BigInt(raw.pedersenCommitment[0]), BigInt(raw.pedersenCommitment[1])],
    nullifier: BigInt(raw.nullifier),
    spent: raw.spent,
    tokenAddress: raw.tokenAddress,
    createdAtBlock: raw.createdAtBlock,
  };
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

export function getWalletState(wallet: ShroudWallet): WalletState {
  const state = walletRegistry.get(wallet.address);
  if (!state) {
    throw new Error(
      `Wallet ${wallet.address} not found in registry — was it created by this ShroudClient instance?`,
    );
  }
  return state;
}

export function hasWalletState(wallet: ShroudWallet): boolean {
  return walletRegistry.has(wallet.address);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function buildWallet(privKey: bigint): Promise<ShroudWallet> {
  const keypair = await deriveKeypair(privKey);
  const address = walletAddress(keypair.publicKey);

  const wallet: ShroudWallet = {
    address,
    publicKey: keypair.publicKey,
  };

  if (!walletRegistry.has(address)) {
    walletRegistry.set(address, {
      keypair,
      notesByToken: new Map(),
    });
  }

  return wallet;
}

function randomScalar(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  const result = value % FIELD_PRIME;
  return result === 0n ? 1n : result;
}

// Re-export for use in client.ts
export { FIELD_PRIME, SUBGROUP_ORDER };
