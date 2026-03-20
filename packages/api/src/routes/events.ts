import { Hono } from "hono";

const events = new Hono();

const INDEXER_URL =
  process.env.INDEXER_URL || "http://localhost:8080/v1/graphql";

// GET /v1/events/memos — Encrypted memo events for note scanning
events.get("/memos", async (c) => {
  const afterBlock = c.req.query("afterBlock") || "0";
  const limit = Math.min(Number(c.req.query("limit") || "500"), 2000);

  try {
    const query = `
      query MemoEvents($afterBlock: Int!, $limit: Int!) {
        TransferEvent(
          where: { blockNumber_gt: $afterBlock }
          order_by: { blockNumber: asc }
          limit: $limit
        ) {
          id
          nullifier
          commitment1
          commitment2
          encryptedMemo1
          encryptedMemo2
          leafIndex1
          leafIndex2
          blockNumber
          transactionHash
        }
        WithdrawalEvent(
          where: { blockNumber_gt: $afterBlock }
          order_by: { blockNumber: asc }
          limit: $limit
        ) {
          id
          nullifier
          changeCommitment
          encryptedMemo
          changeLeafIndex
          blockNumber
          transactionHash
          amount
          recipient
        }
      }
    `;

    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { afterBlock: Number(afterBlock), limit },
      }),
    });

    if (!res.ok) {
      return c.json({ error: "Indexer unavailable" }, 502);
    }

    const data = await res.json();

    return c.json({
      transfers: data.data?.TransferEvent || [],
      withdrawals: data.data?.WithdrawalEvent || [],
    });
  } catch {
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

export { events };
