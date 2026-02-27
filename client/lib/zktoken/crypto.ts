/**
 * crypto.ts — Shared circomlibjs singletons
 *
 * buildBabyjub() and buildPoseidon() each compile WASM from scratch (~1-3s).
 * This module initialises them ONCE and shares the instances across all SDK
 * modules (keys, note, merkle, encryption, prover).
 */

import { buildBabyjub, buildPoseidon } from "circomlibjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _babyJub: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _poseidon: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _babyJubPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _poseidonPromise: Promise<any> | null = null;

/**
 * Get the shared BabyJub instance (lazy, built once).
 * Uses a promise lock so concurrent callers don't trigger duplicate builds.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBabyJub(): Promise<any> {
  if (_babyJub) return _babyJub;
  if (!_babyJubPromise) {
    _babyJubPromise = buildBabyjub().then((bj) => {
      _babyJub = bj;
      return bj;
    });
  }
  return _babyJubPromise;
}

/**
 * Get the shared Poseidon instance (lazy, built once).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPoseidon(): Promise<any> {
  if (_poseidon) return _poseidon;
  if (!_poseidonPromise) {
    _poseidonPromise = buildPoseidon().then((p) => {
      _poseidon = p;
      return p;
    });
  }
  return _poseidonPromise;
}

/**
 * Eagerly initialise both singletons in parallel.
 * Call this once at startup (or in a test globalSetup) to front-load the
 * ~2-4s WASM compilation cost.
 */
export async function initCrypto(): Promise<void> {
  await Promise.all([getBabyJub(), getPoseidon()]);
}
