/**
 * encryption.test.ts — Unit tests for MemoEncryptor
 */

import { describe, it, expect } from "bun:test";
import { KeyManager } from "../lib/zktoken/keys";
import {
  encryptMemo,
  decryptMemo,
  scanMemos,
  MEMO_BYTES,
} from "../lib/zktoken/encryption";
import type { NoteMemoData, MemoEvent } from "../lib/zktoken/encryption";
import { bytesToHex } from "../lib/zktoken/utils";

/** Fixed test note data (not cryptographically valid — just for testing). */
const TEST_MEMO_DATA: NoteMemoData = {
  amount: 1_000_000n,
  blinding: 0xdeadbeef12345678901234567890n,
  secret: 0xcafebabe0987654321fedcba9876n,
  nullifierPreimage: 0xfeedfacec0ffee1234567890abcdefn,
};

describe("encryptMemo / decryptMemo", () => {
  it("should produce a memo of the expected wire format length", async () => {
    const recipient = await KeyManager.generate();
    const memo = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    expect(memo.length).toBe(MEMO_BYTES);
  });

  it("should successfully decrypt a memo for the correct recipient", async () => {
    const recipient = await KeyManager.generate();
    const encrypted = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    const decrypted = await decryptMemo(encrypted, recipient.privateKey);

    expect(decrypted).not.toBeNull();
    expect(decrypted!.amount).toBe(TEST_MEMO_DATA.amount);
    expect(decrypted!.blinding).toBe(TEST_MEMO_DATA.blinding);
    expect(decrypted!.secret).toBe(TEST_MEMO_DATA.secret);
    expect(decrypted!.nullifierPreimage).toBe(TEST_MEMO_DATA.nullifierPreimage);
  });

  it("should return null when decrypting with the wrong private key", async () => {
    const recipient = await KeyManager.generate();
    const eavesdropper = await KeyManager.generate();

    const encrypted = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    const result = await decryptMemo(encrypted, eavesdropper.privateKey);

    expect(result).toBeNull();
  });

  it("should return null for a memo that is too short", async () => {
    const { privateKey } = await KeyManager.generate();
    const result = await decryptMemo(new Uint8Array(10), privateKey);
    expect(result).toBeNull();
  });

  it("should return null for a tampered memo (bit flipped)", async () => {
    const recipient = await KeyManager.generate();
    const encrypted = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    // Flip a byte in the ciphertext region
    encrypted[100]! ^= 0xff;
    const result = await decryptMemo(encrypted, recipient.privateKey);
    expect(result).toBeNull();
  });

  it("should produce different ciphertexts on each call (random nonce+ephemeral)", async () => {
    const recipient = await KeyManager.generate();
    const m1 = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    const m2 = await encryptMemo(TEST_MEMO_DATA, recipient.publicKey);
    // Should not be identical due to random ephemeral key + nonce
    expect(bytesToHex(m1)).not.toBe(bytesToHex(m2));
    // But both should decrypt to the same data
    expect(await decryptMemo(m1, recipient.privateKey)).toEqual(TEST_MEMO_DATA);
    expect(await decryptMemo(m2, recipient.privateKey)).toEqual(TEST_MEMO_DATA);
  });

  it("should work with extreme values (0 amount)", async () => {
    const recipient = await KeyManager.generate();
    const data: NoteMemoData = { amount: 0n, blinding: 1n, secret: 2n, nullifierPreimage: 3n };
    const encrypted = await encryptMemo(data, recipient.publicKey);
    const decrypted = await decryptMemo(encrypted, recipient.privateKey);
    expect(decrypted!.amount).toBe(0n);
  });

  it("should handle max uint256 values", async () => {
    const recipient = await KeyManager.generate();
    const maxVal = 2n ** 256n - 1n;
    const data: NoteMemoData = {
      amount: maxVal,
      blinding: maxVal,
      secret: maxVal,
      nullifierPreimage: maxVal,
    };
    const encrypted = await encryptMemo(data, recipient.publicKey);
    const decrypted = await decryptMemo(encrypted, recipient.privateKey);
    expect(decrypted!.amount).toBe(maxVal);
  });
});

describe("scanMemos", () => {
  it("should find memos addressed to the given private key", async () => {
    const alice = await KeyManager.generate();
    const bob = await KeyManager.generate();

    // Two memos: one for alice, one for bob
    const aliceMemo = await encryptMemo(TEST_MEMO_DATA, alice.publicKey);
    const bobMemoData: NoteMemoData = { ...TEST_MEMO_DATA, amount: 500n };
    const bobMemo = await encryptMemo(bobMemoData, bob.publicKey);

    const events: MemoEvent[] = [
      {
        memoBytes: aliceMemo,
        commitment: 0xaaaaaan,
        leafIndex: 0,
        blockNumber: 100,
        eventType: "transfer",
      },
      {
        memoBytes: bobMemo,
        commitment: 0xbbbbbn,
        leafIndex: 1,
        blockNumber: 101,
        eventType: "transfer",
      },
    ];

    const aliceResults = await scanMemos(events, alice.privateKey);
    expect(aliceResults).toHaveLength(1);
    expect(aliceResults[0]!.memoData.amount).toBe(TEST_MEMO_DATA.amount);
    expect(aliceResults[0]!.commitment).toBe(0xaaaaaan);

    const bobResults = await scanMemos(events, bob.privateKey);
    expect(bobResults).toHaveLength(1);
    expect(bobResults[0]!.memoData.amount).toBe(500n);
  });

  it("should return empty array when no memos are addressed to the key", async () => {
    const alice = await KeyManager.generate();
    const charlie = await KeyManager.generate();

    const aliceMemo = await encryptMemo(TEST_MEMO_DATA, alice.publicKey);
    const events: MemoEvent[] = [
      {
        memoBytes: aliceMemo,
        commitment: 1n,
        leafIndex: 0,
        blockNumber: 1,
        eventType: "transfer",
      },
    ];

    const results = await scanMemos(events, charlie.privateKey);
    expect(results).toHaveLength(0);
  });

  it("should handle empty event array", async () => {
    const { privateKey } = await KeyManager.generate();
    const results = await scanMemos([], privateKey);
    expect(results).toHaveLength(0);
  });
});
