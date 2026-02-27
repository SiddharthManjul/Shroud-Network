/**
 * keys.test.ts — Unit tests for KeyManager
 */

import { describe, it, expect } from "bun:test";
import { KeyManager, SUBGROUP_ORDER } from "../lib/zktoken/keys";

describe("KeyManager", () => {
  describe("generate()", () => {
    it("should produce a private key in [1, L-1]", async () => {
      const kp = await KeyManager.generate();
      expect(kp.privateKey).toBeGreaterThan(0n);
      expect(kp.privateKey).toBeLessThan(SUBGROUP_ORDER);
    });

    it("should produce a public key with two non-zero coordinates", async () => {
      const kp = await KeyManager.generate();
      expect(kp.publicKey[0]).toBeGreaterThan(0n);
      expect(kp.publicKey[1]).toBeGreaterThan(0n);
    });

    it("should produce distinct keypairs on consecutive calls", async () => {
      const kp1 = await KeyManager.generate();
      const kp2 = await KeyManager.generate();
      expect(kp1.privateKey).not.toBe(kp2.privateKey);
    });
  });

  describe("fromPrivateKey()", () => {
    it("should restore the same public key from a hex private key", async () => {
      const kp = await KeyManager.generate();
      const hex = KeyManager.privateKeyToHex(kp.privateKey);
      const restored = await KeyManager.fromPrivateKey(hex);
      expect(restored.publicKey[0]).toBe(kp.publicKey[0]);
      expect(restored.publicKey[1]).toBe(kp.publicKey[1]);
    });

    it("should accept 0x-prefixed hex strings", async () => {
      const kp = await KeyManager.generate();
      const hex = KeyManager.privateKeyToHex(kp.privateKey);
      expect(hex.startsWith("0x")).toBe(true);
      const restored = await KeyManager.fromPrivateKey(hex);
      expect(restored).toBeDefined();
    });

    it("should reject a private key of 0", async () => {
      expect(KeyManager.fromPrivateKey("0x" + "0".repeat(64))).rejects.toThrow(
        "out of valid range"
      );
    });

    it("should reject a private key >= subgroup order", async () => {
      const tooLarge = "0x" + SUBGROUP_ORDER.toString(16);
      expect(KeyManager.fromPrivateKey(tooLarge)).rejects.toThrow(
        "out of valid range"
      );
    });
  });

  describe("privateKeyToHex() / publicKeyToHex()", () => {
    it("should produce 66-char hex strings (0x + 64 hex digits) for private key", async () => {
      const kp = await KeyManager.generate();
      const hex = KeyManager.privateKeyToHex(kp.privateKey);
      expect(hex).toHaveLength(66);
      expect(hex.startsWith("0x")).toBe(true);
    });

    it("should produce hex objects with x and y", async () => {
      const kp = await KeyManager.generate();
      const hex = KeyManager.publicKeyToHex(kp.publicKey);
      expect(hex.x.startsWith("0x")).toBe(true);
      expect(hex.y.startsWith("0x")).toBe(true);
    });

    it("publicKeyFromHex round-trips correctly", async () => {
      const kp = await KeyManager.generate();
      const hex = KeyManager.publicKeyToHex(kp.publicKey);
      const restored = KeyManager.publicKeyFromHex(hex);
      expect(restored[0]).toBe(kp.publicKey[0]);
      expect(restored[1]).toBe(kp.publicKey[1]);
    });
  });

  describe("ecdh()", () => {
    it("should compute the same shared point from both sides", async () => {
      const alice = await KeyManager.generate();
      const bob = await KeyManager.generate();

      const sharedAlice = await KeyManager.ecdh(alice.privateKey, bob.publicKey);
      const sharedBob = await KeyManager.ecdh(bob.privateKey, alice.publicKey);

      expect(sharedAlice[0]).toBe(sharedBob[0]);
      expect(sharedAlice[1]).toBe(sharedBob[1]);
    });

    it("should produce different shared secrets for different keypairs", async () => {
      const alice = await KeyManager.generate();
      const bob = await KeyManager.generate();
      const charlie = await KeyManager.generate();

      const sharedAB = await KeyManager.ecdh(alice.privateKey, bob.publicKey);
      const sharedAC = await KeyManager.ecdh(alice.privateKey, charlie.publicKey);

      expect(sharedAB[0]).not.toBe(sharedAC[0]);
    });
  });
});
