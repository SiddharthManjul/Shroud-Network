/**
 * Incremental Poseidon Merkle tree — client-side implementation.
 *
 * Mirrors the on-chain IncrementalMerkleTree.sol behaviour exactly:
 * - Append-only, depth 20 (2^20 = 1,048,576 leaves)
 * - Poseidon(left, right) for internal nodes
 * - Zero values: zero[0] = 0, zero[i] = Poseidon(zero[i-1], zero[i-1])
 *
 * Used to reconstruct the tree from Deposit/Transfer events and to
 * produce Merkle inclusion proofs for the ZK circuits.
 */

const TREE_DEPTH = 20;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoseidonFn = any;

let _poseidon: PoseidonFn | null = null;

async function getPoseidon(): Promise<PoseidonFn> {
  if (_poseidon) return _poseidon;
  const { buildPoseidon } = await import('circomlibjs');
  _poseidon = await buildPoseidon();
  return _poseidon;
}

// ─── Zero preimage cache ──────────────────────────────────────────────────────

let _zeros: bigint[] | null = null;

async function getZeros(): Promise<bigint[]> {
  if (_zeros) return _zeros;
  const poseidon = await getPoseidon();
  const zeros: bigint[] = [0n];
  for (let i = 1; i <= TREE_DEPTH; i++) {
    const raw = poseidon([zeros[i - 1]!, zeros[i - 1]!]);
    zeros.push(poseidon.F.toObject(raw) as bigint);
  }
  _zeros = zeros;
  return zeros;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MerkleProof {
  /** The leaf value being proven */
  leaf: bigint;
  /** Leaf index (0-based) */
  leafIndex: number;
  /** Sibling hashes, from leaf level up to root */
  path: bigint[];
  /** 0 = leaf is left child, 1 = leaf is right child, at each level */
  indices: number[];
  /** Computed root */
  root: bigint;
}

// ─── MerkleTree class ─────────────────────────────────────────────────────────

export class MerkleTree {
  /** All inserted leaves in order */
  private readonly leaves: bigint[] = [];
  /**
   * filled_subtrees[i] = the rightmost complete subtree of depth i
   * Used for O(log n) insertion (same as on-chain contract).
   */
  private filledSubtrees: bigint[] = [];
  private currentRoot = 0n;
  private readonly depth: number;

  private poseidon: PoseidonFn | null = null;
  private zeros: bigint[] | null = null;
  private initialised = false;

  constructor(depth = TREE_DEPTH) {
    this.depth = depth;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialised) return;
    this.poseidon = await getPoseidon();
    this.zeros = await getZeros();
    this.filledSubtrees = [...this.zeros!.slice(0, this.depth)];
    this.currentRoot = this.zeros![this.depth]!;
    this.initialised = true;
  }

  // ─── Operations ───────────────────────────────────────────────────────────────

  /** Insert a new commitment leaf. Returns the leaf index. */
  async insert(commitment: bigint): Promise<number> {
    this.assertInitialised();
    const leafIndex = this.leaves.length;
    if (leafIndex >= 2 ** this.depth) {
      throw new Error('Merkle tree is full');
    }

    let currentIndex = leafIndex;
    let currentLevelHash = commitment;

    for (let i = 0; i < this.depth; i++) {
      let left: bigint;
      let right: bigint;

      if (currentIndex % 2 === 0) {
        // Current hash goes on the left; sibling is zero
        left = currentLevelHash;
        right = this.zeros![i]!;
        this.filledSubtrees[i] = currentLevelHash;
      } else {
        // Current hash goes on the right; sibling is filled subtree
        left = this.filledSubtrees[i]!;
        right = currentLevelHash;
      }

      currentLevelHash = this.hash2(left, right);
      currentIndex = Math.floor(currentIndex / 2);
    }

    this.currentRoot = currentLevelHash;
    this.leaves.push(commitment);
    return leafIndex;
  }

  /** Bulk-insert many commitments efficiently. */
  async insertMany(commitments: bigint[]): Promise<void> {
    for (const c of commitments) {
      await this.insert(c);
    }
  }

  /** Build a Merkle inclusion proof for the leaf at `leafIndex`. */
  async getProof(leafIndex: number): Promise<MerkleProof> {
    this.assertInitialised();
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(
        `Leaf index ${leafIndex} out of range (have ${this.leaves.length} leaves)`,
      );
    }

    const path: bigint[] = [];
    const indices: number[] = [];

    // Build a full array of the current state of each level of the tree
    // by computing nodes bottom-up.
    let levelNodes = this.buildLevelNodes(0);

    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = leafIndex % 2 === 0 ? leafIndex + 1 : leafIndex - 1;
      const sibling = levelNodes[siblingIndex] ?? this.zeros![level]!;
      path.push(sibling);
      indices.push(leafIndex % 2); // 0 = I'm left, 1 = I'm right

      // Move up
      levelNodes = this.buildLevelNodes(level + 1, levelNodes);
    }

    return {
      leaf: this.leaves[leafIndex]!,
      leafIndex,
      path,
      indices,
      root: this.currentRoot,
    };
  }

  get root(): bigint {
    this.assertInitialised();
    return this.currentRoot;
  }

  get size(): number {
    return this.leaves.length;
  }

  getLeaf(index: number): bigint | undefined {
    return this.leaves[index];
  }

  /** Verify a Merkle proof against the current root */
  async verify(proof: MerkleProof): Promise<boolean> {
    this.assertInitialised();
    let hash = proof.leaf;
    for (let i = 0; i < proof.path.length; i++) {
      const sibling = proof.path[i]!;
      const isRight = proof.indices[i] === 1;
      hash = isRight
        ? this.hash2(sibling, hash)
        : this.hash2(hash, sibling);
    }
    return hash === this.currentRoot;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Build all nodes at a given level.
   * level=0 → leaves, level=1 → parents of leaves, etc.
   */
  private buildLevelNodes(level: number, prevLevel?: bigint[]): bigint[] {
    if (level === 0) {
      // Fill leaf slots with zeros up to the nearest power of 2
      const size = 2 ** this.depth;
      const nodes: bigint[] = new Array<bigint>(size).fill(0n);
      for (let i = 0; i < this.leaves.length; i++) {
        nodes[i] = this.leaves[i]!;
      }
      return nodes;
    }

    const prev = prevLevel ?? this.buildLevelNodes(level - 1);
    const size = Math.ceil(prev.length / 2);
    const nodes: bigint[] = new Array<bigint>(size);
    for (let i = 0; i < size; i++) {
      const left = prev[2 * i] ?? this.zeros![level - 1]!;
      const right = prev[2 * i + 1] ?? this.zeros![level - 1]!;
      nodes[i] = this.hash2(left, right);
    }
    return nodes;
  }

  private hash2(left: bigint, right: bigint): bigint {
    const raw = this.poseidon!([left, right]);
    return this.poseidon!.F.toObject(raw) as bigint;
  }

  private assertInitialised(): void {
    if (!this.initialised) {
      throw new Error('MerkleTree not initialised — call await tree.init() first');
    }
  }
}
