import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { db, schema } from "../db/index.js";
import type { ApiKeyContext } from "../middleware/auth.js";

const relay = new Hono<{ Variables: { apiKey: ApiKeyContext } }>();

const SHIELDED_POOL_ABI = [
  "function deposit(uint256 amount, uint256 noteCommitment) external",
  "function transfer(uint256[2] proof_a, uint256[2][2] proof_b, uint256[2] proof_c, uint256 merkleRoot, uint256 nullifierHash, uint256 newCommitment1, uint256 newCommitment2, bytes encryptedMemo1, bytes encryptedMemo2) external",
  "function withdraw(uint256[2] proof_a, uint256[2][2] proof_b, uint256[2] proof_c, uint256 merkleRoot, uint256 nullifierHash, uint256 amount, uint256 changeCommitment, address recipient, bytes encryptedMemo) external",
];

function getRelayWallet(): Wallet {
  const rpcUrl =
    process.env.AVALANCHE_RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";
  const provider = new JsonRpcProvider(rpcUrl);
  const privateKey = process.env.RELAY_PRIVATE_KEY;
  if (!privateKey) throw new Error("RELAY_PRIVATE_KEY not configured");
  return new Wallet(privateKey, provider);
}

const transferSchema = z.object({
  poolAddress: z.string(),
  proof: z.object({
    pi_a: z.array(z.string()).length(2),
    pi_b: z.array(z.array(z.string()).length(2)).length(2),
    pi_c: z.array(z.string()).length(2),
  }),
  merkleRoot: z.string(),
  nullifierHash: z.string(),
  newCommitment1: z.string(),
  newCommitment2: z.string(),
  encryptedMemo1: z.string(),
  encryptedMemo2: z.string(),
});

const withdrawSchema = z.object({
  poolAddress: z.string(),
  proof: z.object({
    pi_a: z.array(z.string()).length(2),
    pi_b: z.array(z.array(z.string()).length(2)).length(2),
    pi_c: z.array(z.string()).length(2),
  }),
  merkleRoot: z.string(),
  nullifierHash: z.string(),
  amount: z.string(),
  changeCommitment: z.string(),
  recipient: z.string(),
  encryptedMemo: z.string(),
});

const depositSchema = z.object({
  poolAddress: z.string(),
  tokenAddress: z.string(),
  amount: z.string(),
  noteCommitment: z.string(),
  signedApprovalTx: z.string().optional(),
});

// POST /v1/relay/transfer
relay.post("/transfer", async (c) => {
  const apiKey = c.get("apiKey");
  const body = await c.req.json();
  const parsed = transferSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  // Record pending relay tx
  const [relayTx] = await db
    .insert(schema.relayTransactions)
    .values({
      apiKeyId: apiKey.apiKeyId,
      txType: "transfer",
      status: "pending",
    })
    .returning();

  try {
    const wallet = getRelayWallet();
    const pool = new Contract(data.poolAddress, SHIELDED_POOL_ABI, wallet);

    const tx = await pool.transfer(
      data.proof.pi_a,
      data.proof.pi_b,
      data.proof.pi_c,
      data.merkleRoot,
      data.nullifierHash,
      data.newCommitment1,
      data.newCommitment2,
      data.encryptedMemo1,
      data.encryptedMemo2
    );

    const receipt = await tx.wait();

    await db
      .update(schema.relayTransactions)
      .set({
        txHash: receipt.hash,
        status: receipt.status === 1 ? "success" : "failed",
        gasUsed: Number(receipt.gasUsed),
      })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    return c.json({
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "success" : "failed",
    });
  } catch (err: unknown) {
    await db
      .update(schema.relayTransactions)
      .set({ status: "failed" })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    const message = err instanceof Error ? err.message : "Relay failed";
    return c.json({ error: message }, 500);
  }
});

// POST /v1/relay/withdraw
relay.post("/withdraw", async (c) => {
  const apiKey = c.get("apiKey");
  const body = await c.req.json();
  const parsed = withdrawSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  const [relayTx] = await db
    .insert(schema.relayTransactions)
    .values({
      apiKeyId: apiKey.apiKeyId,
      txType: "withdraw",
      status: "pending",
    })
    .returning();

  try {
    const wallet = getRelayWallet();
    const pool = new Contract(data.poolAddress, SHIELDED_POOL_ABI, wallet);

    const tx = await pool.withdraw(
      data.proof.pi_a,
      data.proof.pi_b,
      data.proof.pi_c,
      data.merkleRoot,
      data.nullifierHash,
      data.amount,
      data.changeCommitment,
      data.recipient,
      data.encryptedMemo
    );

    const receipt = await tx.wait();

    await db
      .update(schema.relayTransactions)
      .set({
        txHash: receipt.hash,
        status: receipt.status === 1 ? "success" : "failed",
        gasUsed: Number(receipt.gasUsed),
      })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    return c.json({
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "success" : "failed",
    });
  } catch (err: unknown) {
    await db
      .update(schema.relayTransactions)
      .set({ status: "failed" })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    const message = err instanceof Error ? err.message : "Relay failed";
    return c.json({ error: message }, 500);
  }
});

// POST /v1/relay/deposit
relay.post("/deposit", async (c) => {
  const apiKey = c.get("apiKey");
  const body = await c.req.json();
  const parsed = depositSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  const [relayTx] = await db
    .insert(schema.relayTransactions)
    .values({
      apiKeyId: apiKey.apiKeyId,
      txType: "deposit",
      status: "pending",
    })
    .returning();

  try {
    const wallet = getRelayWallet();
    const pool = new Contract(data.poolAddress, SHIELDED_POOL_ABI, wallet);

    const tx = await pool.deposit(data.amount, data.noteCommitment);
    const receipt = await tx.wait();

    await db
      .update(schema.relayTransactions)
      .set({
        txHash: receipt.hash,
        status: receipt.status === 1 ? "success" : "failed",
        gasUsed: Number(receipt.gasUsed),
      })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    return c.json({
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "success" : "failed",
    });
  } catch (err: unknown) {
    await db
      .update(schema.relayTransactions)
      .set({ status: "failed" })
      .where(
        eq(schema.relayTransactions.id, relayTx.id)
      );

    const message = err instanceof Error ? err.message : "Relay failed";
    return c.json({ error: message }, 500);
  }
});

export { relay };
