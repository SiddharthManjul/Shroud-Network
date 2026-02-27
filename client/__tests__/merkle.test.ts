/**
 * merkle.test.ts — Unit tests for MerkleTreeSync
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { MerkleTreeSync, TREE_DEPTH } from "../lib/zktoken/merkle";

describe("MerkleTreeSync", () => {
  let tree: MerkleTreeSync;

  beforeEach(async () => {
    tree = new MerkleTreeSync();
    await tree.init();
  });

  describe("initial state", () => {
    it("should have zero leaves", () => {
      expect(tree.size).toBe(0);
    });

    it("should return a non-zero root (empty tree = hash of zeros)", async () => {
      const root = await tree.getRoot();
      expect(root).toBeGreaterThan(0n);
    });
  });

  describe("insert()", () => {
    it("should increase tree size by 1", async () => {
      await tree.insert(123456789n);
      expect(tree.size).toBe(1);
    });

    it("should change the root after insertion", async () => {
      const rootBefore = await tree.getRoot();
      await tree.insert(42n);
      const rootAfter = await tree.getRoot();
      expect(rootAfter).not.toBe(rootBefore);
    });

    it("should produce distinct roots for different commitments", async () => {
      const t1 = new MerkleTreeSync();
      const t2 = new MerkleTreeSync();
      await t1.insert(100n);
      await t2.insert(200n);
      const r1 = await t1.getRoot();
      const r2 = await t2.getRoot();
      expect(r1).not.toBe(r2);
    });

    it("should be order-dependent", async () => {
      const t1 = new MerkleTreeSync();
      const t2 = new MerkleTreeSync();
      await t1.insert(1n);
      await t1.insert(2n);
      await t2.insert(2n);
      await t2.insert(1n);
      const r1 = await t1.getRoot();
      const r2 = await t2.getRoot();
      expect(r1).not.toBe(r2);
    });
  });

  describe("getMerklePath()", () => {
    it("should return path of correct depth", async () => {
      await tree.insert(999n);
      const path = await tree.getMerklePath(0);
      expect(path.pathElements).toHaveLength(TREE_DEPTH);
      expect(path.pathIndices).toHaveLength(TREE_DEPTH);
    });

    it("should correctly set leafIndex", async () => {
      await tree.insert(1n);
      await tree.insert(2n);
      const path = await tree.getMerklePath(1);
      expect(path.leafIndex).toBe(1);
    });

    it("should throw for out-of-range leafIndex", async () => {
      await tree.insert(1n);
      expect(tree.getMerklePath(1)).rejects.toThrow("out of range");
      expect(tree.getMerklePath(-1)).rejects.toThrow("out of range");
    });

    it("should return path that verifies correctly", async () => {
      await tree.insert(0xdeadbeefn);
      await tree.insert(0xcafebaben);
      await tree.insert(0xfeedfacen);

      for (let i = 0; i < 3; i++) {
        const path = await tree.getMerklePath(i);
        const leaf = tree.getLeaves()[i]!;
        const valid = await tree.verifyPath(leaf, path);
        expect(valid).toBe(true);
      }
    });

    it("path should fail verification for wrong leaf", async () => {
      await tree.insert(111n);
      const path = await tree.getMerklePath(0);
      const valid = await tree.verifyPath(999n, path); // wrong leaf
      expect(valid).toBe(false);
    });
  });

  describe("verifyPath()", () => {
    it("should verify against a specified root", async () => {
      await tree.insert(555n);
      const path = await tree.getMerklePath(0);
      const root = await tree.getRoot();
      const valid = await tree.verifyPath(555n, path, root);
      expect(valid).toBe(true);
    });

    it("should fail for a stale root after new insertions", async () => {
      await tree.insert(1n);
      const staleRoot = await tree.getRoot();
      await tree.insert(2n); // advances root

      const path = await tree.getMerklePath(0);
      // path.root is fresh; verify against old stale root
      const valid = await tree.verifyPath(1n, path, staleRoot);
      // The path was generated with the new root, not the stale root
      expect(valid).toBe(false);
    });
  });

  describe("two trees in sync", () => {
    it("should produce identical roots when inserting same commitments", async () => {
      const t1 = new MerkleTreeSync();
      const t2 = new MerkleTreeSync();

      const commitments = [100n, 200n, 300n, 400n, 500n];
      for (const c of commitments) {
        await t1.insert(c);
        await t2.insert(c);
      }

      expect(await t1.getRoot()).toBe(await t2.getRoot());
    });
  });
});
