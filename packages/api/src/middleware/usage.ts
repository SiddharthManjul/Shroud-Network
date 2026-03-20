import { createMiddleware } from "hono/factory";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { ApiKeyContext } from "./auth.js";

/**
 * Usage tracking middleware. Records request counts per endpoint per hour.
 * Runs asynchronously after response to avoid latency impact.
 */
export const trackUsage = () =>
  createMiddleware<{ Variables: { apiKey: ApiKeyContext } }>(
    async (c, next) => {
      const start = Date.now();
      await next();
      const latency = Date.now() - start;

      const apiKey = c.get("apiKey");
      if (!apiKey) return;

      const endpoint = c.req.method + " " + c.req.routePath;
      const hourDate = new Date();
      hourDate.setMinutes(0, 0, 0);
      const hour = hourDate.toISOString();

      const isError = c.res.status >= 400 ? 1 : 0;

      // Fire and forget — don't block the response
      db.insert(schema.usageHourly)
        .values({
          apiKeyId: apiKey.apiKeyId,
          hour,
          endpoint,
          requestCount: 1,
          errorCount: isError,
          totalLatencyMs: latency,
        })
        .onConflictDoUpdate({
          target: [
            schema.usageHourly.apiKeyId,
            schema.usageHourly.hour,
            schema.usageHourly.endpoint,
          ],
          set: {
            requestCount: sql`${schema.usageHourly.requestCount} + 1`,
            errorCount: sql`${schema.usageHourly.errorCount} + ${isError}`,
            totalLatencyMs: sql`${schema.usageHourly.totalLatencyMs} + ${latency}`,
          },
        })
        .execute()
        .catch((err) => {
          console.error("Usage tracking error:", err);
        });
    }
  );
