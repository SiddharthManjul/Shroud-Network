/**
 * note.test.ts — Unit tests for NoteManager
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { KeyManager } from "../lib/zktoken/keys";
import {
  createNote,
  finaliseNote,
  computePedersenCommitment,
  computeNoteCommitment,
  computeNullifier,
  encodeNote,
  decodeNote,
  NoteStore,
  noteFromMemoData,
} from "../lib/zktoken/note";

describe("computePedersenCommitment", () => {
  it("should return a non-zero Baby Jubjub point", async () => {
    const pt = await computePedersenCommitment(100n, 123456789n);
    expect(pt[0]).toBeGreaterThan(0n);
    expect(pt[1]).toBeGreaterThan(0n);
  });

  it("should produce distinct points for different amounts", async () => {
    const pt1 = await computePedersenCommitment(100n, 1n);
    const pt2 = await computePedersenCommitment(200n, 1n);
    expect(pt1[0]).not.toBe(pt2[0]);
  });

  it("should produce distinct points for different blindings", async () => {
    const pt1 = await computePedersenCommitment(100n, 1n);
    const pt2 = await computePedersenCommitment(100n, 2n);
    expect(pt1[0]).not.toBe(pt2[0]);
  });

  it("commitment of (0, blinding) should differ from (amount, 0)", async () => {
    const pt1 = await computePedersenCommitment(0n, 999n);
    const pt2 = await computePedersenCommitment(999n, 0n);
    expect(pt1[0]).not.toBe(pt2[0]);
  });
});

describe("computeNoteCommitment", () => {
  it("should return a non-zero field element", async () => {
    const ped = await computePedersenCommitment(100n, 1n);
    const nc = await computeNoteCommitment(ped, 111n, 222n, 333n);
    expect(nc).toBeGreaterThan(0n);
  });

  it("should be deterministic", async () => {
    const ped = await computePedersenCommitment(50n, 7n);
    const nc1 = await computeNoteCommitment(ped, 1n, 2n, 3n);
    const nc2 = await computeNoteCommitment(ped, 1n, 2n, 3n);
    expect(nc1).toBe(nc2);
  });

  it("should differ when secret changes", async () => {
    const ped = await computePedersenCommitment(50n, 7n);
    const nc1 = await computeNoteCommitment(ped, 1n, 2n, 3n);
    const nc2 = await computeNoteCommitment(ped, 9n, 2n, 3n);
    expect(nc1).not.toBe(nc2);
  });
});

describe("computeNullifier", () => {
  it("should be deterministic", async () => {
    const n1 = await computeNullifier(100n, 200n, 5);
    const n2 = await computeNullifier(100n, 200n, 5);
    expect(n1).toBe(n2);
  });

  it("should differ for different leaf indices", async () => {
    const n1 = await computeNullifier(100n, 200n, 0);
    const n2 = await computeNullifier(100n, 200n, 1);
    expect(n1).not.toBe(n2);
  });

  it("should differ for different secrets", async () => {
    const n1 = await computeNullifier(100n, 1n, 0);
    const n2 = await computeNullifier(100n, 2n, 0);
    expect(n1).not.toBe(n2);
  });
});

describe("createNote", () => {
  it("should create a note with valid fields", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await createNote(1000n, publicKey, "0xtoken");

    expect(note.amount).toBe(1000n);
    expect(note.ownerPublicKey[0]).toBe(publicKey[0]);
    expect(note.ownerPublicKey[1]).toBe(publicKey[1]);
    expect(note.blinding).toBeGreaterThan(0n);
    expect(note.secret).toBeGreaterThan(0n);
    expect(note.nullifierPreimage).toBeGreaterThan(0n);
    expect(note.pedersenCommitment[0]).toBeGreaterThan(0n);
    expect(note.noteCommitment).toBeGreaterThan(0n);
    expect(note.leafIndex).toBe(-1);
    expect(note.spent).toBe(false);
    expect(note.nullifier).toBe(0n); // not finalised yet
  });

  it("should produce distinct notes from same params (random randomness)", async () => {
    const { publicKey } = await KeyManager.generate();
    const n1 = await createNote(100n, publicKey, "0xtoken");
    const n2 = await createNote(100n, publicKey, "0xtoken");
    expect(n1.blinding).not.toBe(n2.blinding);
    expect(n1.noteCommitment).not.toBe(n2.noteCommitment);
  });

  it("should reject zero amount", async () => {
    const { publicKey } = await KeyManager.generate();
    expect(createNote(0n, publicKey, "0xtoken")).rejects.toThrow();
  });

  it("should reject amount >= 2^64", async () => {
    const { publicKey } = await KeyManager.generate();
    expect(createNote(2n ** 64n, publicKey, "0xtoken")).rejects.toThrow();
  });
});

describe("finaliseNote", () => {
  it("should set leafIndex and compute nullifier", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await createNote(500n, publicKey, "0xtoken");
    const finalised = await finaliseNote(note, 42);

    expect(finalised.leafIndex).toBe(42);
    expect(finalised.nullifier).toBeGreaterThan(0n);
    expect(finalised.nullifier).not.toBe(note.nullifier);
  });

  it("should not mutate the original note", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await createNote(500n, publicKey, "0xtoken");
    await finaliseNote(note, 7);
    expect(note.leafIndex).toBe(-1); // original unchanged
    expect(note.nullifier).toBe(0n);
  });
});

describe("encodeNote / decodeNote", () => {
  it("should round-trip a note through JSON serialisation", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await createNote(12345n, publicKey, "0xabcdef");
    const finalised = await finaliseNote(note, 10);

    const encoded = encodeNote(finalised);
    const decoded = decodeNote(encoded);

    expect(decoded.amount).toBe(finalised.amount);
    expect(decoded.blinding).toBe(finalised.blinding);
    expect(decoded.secret).toBe(finalised.secret);
    expect(decoded.nullifierPreimage).toBe(finalised.nullifierPreimage);
    expect(decoded.ownerPublicKey[0]).toBe(finalised.ownerPublicKey[0]);
    expect(decoded.ownerPublicKey[1]).toBe(finalised.ownerPublicKey[1]);
    expect(decoded.noteCommitment).toBe(finalised.noteCommitment);
    expect(decoded.nullifier).toBe(finalised.nullifier);
    expect(decoded.leafIndex).toBe(10);
    expect(decoded.spent).toBe(false);
  });
});

describe("noteFromMemoData", () => {
  it("should reconstruct a note with matching noteCommitment", async () => {
    const { publicKey } = await KeyManager.generate();
    const original = await createNote(999n, publicKey, "0xtoken");
    const finalised = await finaliseNote(original, 5);

    const memoData = {
      amount: finalised.amount,
      blinding: finalised.blinding,
      secret: finalised.secret,
      nullifierPreimage: finalised.nullifierPreimage,
    };

    const reconstructed = await noteFromMemoData(memoData, publicKey, "0xtoken", 5, 100);

    expect(reconstructed.noteCommitment).toBe(finalised.noteCommitment);
    expect(reconstructed.nullifier).toBe(finalised.nullifier);
  });
});

describe("NoteStore", () => {
  let store: NoteStore;

  beforeEach(() => {
    store = new NoteStore();
  });

  it("should save and retrieve notes", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);
    store.save(note);
    expect(store.getAll()).toHaveLength(1);
  });

  it("should filter by token address", async () => {
    const { publicKey } = await KeyManager.generate();
    const n1 = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);
    const n2 = await finaliseNote(await createNote(200n, publicKey, "0xb"), 1);
    store.save(n1);
    store.save(n2);
    expect(store.getAll("0xa")).toHaveLength(1);
    expect(store.getAll("0xb")).toHaveLength(1);
  });

  it("should return only unspent notes", async () => {
    const { publicKey } = await KeyManager.generate();
    const n1 = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);
    const n2 = await finaliseNote(await createNote(200n, publicKey, "0xa"), 1);
    store.save(n1);
    store.save(n2);
    store.markSpent(n1.nullifier);
    expect(store.getUnspent()).toHaveLength(1);
    expect(store.getUnspent()[0]!.amount).toBe(200n);
  });

  it("should correctly mark notes as spent", async () => {
    const { publicKey } = await KeyManager.generate();
    const note = await finaliseNote(await createNote(100n, publicKey, "0xa"), 0);
    store.save(note);
    const found = store.markSpent(note.nullifier);
    expect(found).toBe(true);
    expect(store.getAll()[0]!.spent).toBe(true);
  });

  it("should return false for unknown nullifier", async () => {
    const found = store.markSpent(12345n);
    expect(found).toBe(false);
  });
});
