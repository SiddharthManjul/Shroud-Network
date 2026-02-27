/**
 * prover.test.ts — Unit tests for ProofGenerator
 *
 * NOTE: Full proof generation with snarkjs requires the actual .wasm and .zkey
 * files from the trusted setup. These tests focus on:
 *   1. The proof encoding (encodeProofForContract) — pure TypeScript, no zkey needed.
 *   2. Input validation (amount checks, etc.).
 */

import { describe, it, expect } from "bun:test";
import { encodeProofForContract } from "../lib/zktoken/prover";
import type { Groth16Proof } from "../lib/zktoken/types";
import { KeyManager } from "../lib/zktoken/keys";
import { createNote, finaliseNote } from "../lib/zktoken/note";
import { bytesToHex } from "../lib/zktoken/utils";

/** A mock Groth16 proof with plausible numeric strings. */
const MOCK_PROOF: Groth16Proof = {
  pi_a: [
    "12345678901234567890123456789012345678901234567890123456789012345",
    "98765432109876543210987654321098765432109876543210987654321098765",
    "1",
  ],
  pi_b: [
    [
      "11111111111111111111111111111111111111111111111111111111111111111",
      "22222222222222222222222222222222222222222222222222222222222222222",
    ],
    [
      "33333333333333333333333333333333333333333333333333333333333333333",
      "44444444444444444444444444444444444444444444444444444444444444444",
    ],
    ["1", "0"],
  ],
  pi_c: [
    "55555555555555555555555555555555555555555555555555555555555555555",
    "66666666666666666666666666666666666666666666666666666666666666666",
    "1",
  ],
  protocol: "groth16",
  curve: "bn128",
};

describe("encodeProofForContract", () => {
  it("should produce exactly 256 bytes", () => {
    const encoded = encodeProofForContract(MOCK_PROOF);
    expect(encoded.length).toBe(256);
  });

  it("should be deterministic", () => {
    const e1 = encodeProofForContract(MOCK_PROOF);
    const e2 = encodeProofForContract(MOCK_PROOF);
    expect(bytesToHex(e1)).toBe(bytesToHex(e2));
  });

  it("should produce different encodings for different proofs", () => {
    const proof2: Groth16Proof = {
      ...MOCK_PROOF,
      pi_a: ["99999999999999999999999999999999999999999999999999999999999999999",
             "88888888888888888888888888888888888888888888888888888888888888888",
             "1"],
    };
    const e1 = encodeProofForContract(MOCK_PROOF);
    const e2 = encodeProofForContract(proof2);
    expect(bytesToHex(e1)).not.toBe(bytesToHex(e2));
  });

  it("should produce a Uint8Array (not Buffer or Array)", () => {
    const encoded = encodeProofForContract(MOCK_PROOF);
    expect(encoded).toBeInstanceOf(Uint8Array);
  });
});

describe("generateTransferProof input validation", () => {
  it("should throw when transferAmount is 0", async () => {
    const { generateTransferProof } = await import("../lib/zktoken/prover");
    const { publicKey } = await KeyManager.generate();
    const note = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);

    expect(
      generateTransferProof({
        inputNote: note,
        transferAmount: 0n,
        recipientPublicKey: publicKey,
        senderPublicKey: publicKey,
        senderPrivateKey: 1n,
        merklePath: {
          root: 1n,
          pathElements: new Array(20).fill(0n),
          pathIndices: new Array(20).fill(0),
          leafIndex: 0,
        },
        wasmPath: "nonexistent.wasm",
        zkeyPath: "nonexistent.zkey",
      })
    ).rejects.toThrow("transferAmount must be > 0");
  });

  it("should throw when transferAmount > inputNote.amount", async () => {
    const { generateTransferProof } = await import("../lib/zktoken/prover");
    const { publicKey } = await KeyManager.generate();
    const note = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);

    expect(
      generateTransferProof({
        inputNote: note,
        transferAmount: 101n,
        recipientPublicKey: publicKey,
        senderPublicKey: publicKey,
        senderPrivateKey: 1n,
        merklePath: {
          root: 1n,
          pathElements: new Array(20).fill(0n),
          pathIndices: new Array(20).fill(0),
          leafIndex: 0,
        },
        wasmPath: "nonexistent.wasm",
        zkeyPath: "nonexistent.zkey",
      })
    ).rejects.toThrow("transferAmount");
  });
});

describe("generateWithdrawProof input validation", () => {
  it("should throw when withdrawAmount is 0", async () => {
    const { generateWithdrawProof } = await import("../lib/zktoken/prover");
    const { publicKey } = await KeyManager.generate();
    const note = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);

    expect(
      generateWithdrawProof({
        inputNote: note,
        withdrawAmount: 0n,
        recipient: "0x0000000000000000000000000000000000000001",
        senderPublicKey: publicKey,
        senderPrivateKey: 1n,
        merklePath: {
          root: 1n,
          pathElements: new Array(20).fill(0n),
          pathIndices: new Array(20).fill(0),
          leafIndex: 0,
        },
        wasmPath: "nonexistent.wasm",
        zkeyPath: "nonexistent.zkey",
      })
    ).rejects.toThrow("withdrawAmount must be > 0");
  });
});
