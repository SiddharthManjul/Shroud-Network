import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { verifyJwt } from "./auth.js";
import { hashKey } from "../middleware/auth.js";

const apiKeysRouter = new Hono();

function generateApiKey(
  scope: "secret" | "publishable",
  environment: "live" | "test"
): string {
  const prefix = scope === "secret" ? "sk" : "pk";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${environment}_${hex}`;
}

/** JWT auth guard for all api-keys routes */
async function requireJwt(
  c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => Response }
): Promise<{ sub: string; email: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    c.json({ error: "Unauthorized" }, 401);
    return null;
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) {
    c.json({ error: "Invalid token" }, 401);
    return null;
  }
  return payload;
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100).default("Default"),
  environment: z.enum(["live", "test"]).default("test"),
  scope: z.enum(["secret", "publishable"]).default("secret"),
});

// POST /v1/auth/api-keys — Create new API key
apiKeysRouter.post("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const body = await c.req.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { name, environment, scope } = parsed.data;
  const rawKey = generateApiKey(
    scope as "secret" | "publishable",
    environment as "live" | "test"
  );
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + "...";

  const [inserted] = await db
    .insert(schema.apiKeys)
    .values({
      developerId: payload.sub,
      keyHash,
      keyPrefix,
      name,
      environment,
      scope,
    })
    .returning();

  // Return the raw key ONCE — it won't be retrievable again
  return c.json(
    {
      id: inserted.id,
      key: rawKey,
      keyPrefix,
      name: inserted.name,
      environment: inserted.environment,
      scope: inserted.scope,
      createdAt: inserted.createdAt,
    },
    201
  );
});

// GET /v1/auth/api-keys — List API keys (without raw key)
apiKeysRouter.get("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const keys = await db
    .select({
      id: schema.apiKeys.id,
      keyPrefix: schema.apiKeys.keyPrefix,
      name: schema.apiKeys.name,
      environment: schema.apiKeys.environment,
      scope: schema.apiKeys.scope,
      isActive: schema.apiKeys.isActive,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
      revokedAt: schema.apiKeys.revokedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.developerId, payload.sub))
    .orderBy(schema.apiKeys.createdAt);

  return c.json({ keys });
});

// DELETE /v1/auth/api-keys/:id — Revoke API key
apiKeysRouter.delete("/:id", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const keyId = c.req.param("id");

  const [updated] = await db
    .update(schema.apiKeys)
    .set({ isActive: false, revokedAt: new Date().toISOString() as unknown as Date })
    .where(
      and(
        eq(schema.apiKeys.id, keyId),
        eq(schema.apiKeys.developerId, payload.sub)
      )
    )
    .returning({ id: schema.apiKeys.id });

  if (!updated) {
    return c.json({ error: "API key not found" }, 404);
  }

  return c.json({ success: true, id: updated.id });
});

export { apiKeysRouter };
