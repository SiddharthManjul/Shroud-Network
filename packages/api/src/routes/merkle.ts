import { Hono } from "hono";

const merkle = new Hono();

const INDEXER_URL =
  process.env.INDEXER_URL || "http://localhost:8080/v1/graphql";

// GET /v1/merkle/leaves — Paginated Merkle leaves from indexer
merkle.get("/leaves", async (c) => {
  const afterIndex = c.req.query("afterIndex") || "0";
  const pool = c.req.query("pool") || "";
  const limit = Math.min(Number(c.req.query("limit") || "1000"), 5000);

  try {
    const query = `
      query MerkleLeaves($afterIndex: Int!, $limit: Int!) {
        MerkleLeaf(
          where: { leafIndex_gt: $afterIndex }
          order_by: { leafIndex: asc }
          limit: $limit
        ) {
          id
          commitment
          leafIndex
        }
      }
    `;

    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { afterIndex: Number(afterIndex), limit },
      }),
    });

    if (!res.ok) {
      return c.json({ error: "Indexer unavailable" }, 502);
    }

    const data = await res.json();
    return c.json({ leaves: data.data?.MerkleLeaf || [] });
  } catch {
    return c.json({ error: "Failed to fetch leaves" }, 500);
  }
});

// GET /v1/merkle/root — Current Merkle root from on-chain
merkle.get("/root", async (c) => {
  const pool = c.req.query("pool");

  try {
    const query = `
      query PoolState {
        PoolState(limit: 1) {
          id
          nextLeafIndex
          lastIndexedBlock
        }
      }
    `;

    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return c.json({ error: "Indexer unavailable" }, 502);
    }

    const data = await res.json();
    const state = data.data?.PoolState?.[0];

    return c.json({
      nextLeafIndex: state?.nextLeafIndex || 0,
      lastIndexedBlock: state?.lastIndexedBlock || 0,
    });
  } catch {
    return c.json({ error: "Failed to fetch root" }, 500);
  }
});

export { merkle };
