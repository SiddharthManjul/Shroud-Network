import { createMiddleware } from "hono/factory";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";

type ApiKeyScope = "secret" | "publishable";

interface ApiKeyContext {
  apiKeyId: string;
  developerId: string;
  environment: string;
  scope: ApiKeyScope;
  plan: string;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseKeyPrefix(key: string): {
  scope: ApiKeyScope;
  environment: string;
} | null {
  if (key.startsWith("sk_live_")) return { scope: "secret", environment: "live" };
  if (key.startsWith("sk_test_")) return { scope: "secret", environment: "test" };
  if (key.startsWith("pk_live_")) return { scope: "publishable", environment: "live" };
  if (key.startsWith("pk_test_")) return { scope: "publishable", environment: "test" };
  return null;
}

/**
 * Middleware that validates API key from Authorization header.
 * Sets apiKey context on the request.
 */
export const apiKeyAuth = (options?: { requireSecret?: boolean }) =>
  createMiddleware<{ Variables: { apiKey: ApiKeyContext } }>(
    async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader) {
        return c.json({ error: "Authorization header required" }, 401);
      }

      const key = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      const parsed = parseKeyPrefix(key);
      if (!parsed) {
        return c.json({ error: "Invalid API key format" }, 401);
      }

      if (options?.requireSecret && parsed.scope !== "secret") {
        return c.json(
          { error: "Secret API key required for this endpoint" },
          403
        );
      }

      const keyHash = await hashKey(key);

      const result = await db
        .select({
          keyId: schema.apiKeys.id,
          developerId: schema.apiKeys.developerId,
          environment: schema.apiKeys.environment,
          scope: schema.apiKeys.scope,
          isActive: schema.apiKeys.isActive,
          plan: schema.developers.plan,
        })
        .from(schema.apiKeys)
        .innerJoin(
          schema.developers,
          eq(schema.apiKeys.developerId, schema.developers.id)
        )
        .where(
          and(
            eq(schema.apiKeys.keyHash, keyHash),
            eq(schema.apiKeys.isActive, true)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return c.json({ error: "Invalid or revoked API key" }, 401);
      }

      const row = result[0];

      // Update last_used_at (fire and forget)
      db.update(schema.apiKeys)
        .set({ lastUsedAt: new Date().toISOString() as unknown as Date })
        .where(eq(schema.apiKeys.id, row.keyId))
        .execute()
        .catch(() => {});

      c.set("apiKey", {
        apiKeyId: row.keyId,
        developerId: row.developerId,
        environment: row.environment,
        scope: row.scope as ApiKeyScope,
        plan: row.plan,
      });

      await next();
    }
  );

export { hashKey, parseKeyPrefix, type ApiKeyContext };
