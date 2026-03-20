import { Hono } from "hono";
import { z } from "zod";
import type { ApiKeyContext } from "../middleware/auth.js";

const proof = new Hono<{ Variables: { apiKey: ApiKeyContext } }>();

// Lazy-loaded snarkjs
let snarkjsModule: typeof import("snarkjs") | null = null;
async function getSnarkjs() {
  if (!snarkjsModule) {
    snarkjsModule = await import("snarkjs");
  }
  return snarkjsModule;
}

const proofRequestSchema = z.object({
  witness: z.record(z.unknown()),
});

// POST /v1/proof/transfer — Server-side transfer proof generation
proof.post("/transfer", async (c) => {
  const body = await c.req.json();
  const parsed = proofRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const basePath =
    process.env.CIRCUIT_BASE_PATH || "../../circuits/build";

  try {
    const snarkjs = await getSnarkjs();

    const { proof: proofData, publicSignals } =
      await snarkjs.groth16.fullProve(
        parsed.data.witness,
        `${basePath}/transfer/transfer_js/transfer.wasm`,
        `${basePath}/transfer/transfer_final.zkey`
      );

    return c.json({ proof: proofData, publicSignals });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Proof generation failed";
    console.error("Transfer proof error:", message);
    return c.json({ error: "Proof generation failed" }, 500);
  }
});

// POST /v1/proof/withdraw — Server-side withdraw proof generation
proof.post("/withdraw", async (c) => {
  const body = await c.req.json();
  const parsed = proofRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const basePath =
    process.env.CIRCUIT_BASE_PATH || "../../circuits/build";

  try {
    const snarkjs = await getSnarkjs();

    const { proof: proofData, publicSignals } =
      await snarkjs.groth16.fullProve(
        parsed.data.witness,
        `${basePath}/withdraw/withdraw_js/withdraw.wasm`,
        `${basePath}/withdraw/withdraw_final.zkey`
      );

    return c.json({ proof: proofData, publicSignals });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Proof generation failed";
    console.error("Withdraw proof error:", message);
    return c.json({ error: "Proof generation failed" }, 500);
  }
});

export { proof };
