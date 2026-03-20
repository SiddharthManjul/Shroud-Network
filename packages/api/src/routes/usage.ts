import { Hono } from "hono";
import { eq, and, inArray, gte, desc, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { verifyJwt } from "./auth.js";

const usage = new Hono();

// GET /v1/usage — Aggregated usage stats for current developer
usage.get("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  // Get all API keys for this developer
  const keys = await db
    .select({ id: schema.apiKeys.id })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.developerId, payload.sub));

  if (keys.length === 0) {
    return c.json({
      totalRequests: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      relayTransactions: 0,
      period: "30d",
    });
  }

  const keyIds = keys.map((k) => k.id);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [stats] = await db
    .select({
      totalRequests: sql<number>`COALESCE(SUM(${schema.usageHourly.requestCount}), 0)`,
      totalErrors: sql<number>`COALESCE(SUM(${schema.usageHourly.errorCount}), 0)`,
      totalLatency: sql<number>`COALESCE(SUM(${schema.usageHourly.totalLatencyMs}), 0)`,
    })
    .from(schema.usageHourly)
    .where(
      and(
        inArray(schema.usageHourly.apiKeyId, keyIds),
        gte(schema.usageHourly.hour, thirtyDaysAgo)
      )
    );

  const [relayStats] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.relayTransactions)
    .where(
      and(
        inArray(schema.relayTransactions.apiKeyId, keyIds),
        gte(schema.relayTransactions.createdAt, thirtyDaysAgo)
      )
    );

  const totalRequests = Number(stats?.totalRequests || 0);
  const totalLatency = Number(stats?.totalLatency || 0);

  return c.json({
    totalRequests,
    totalErrors: Number(stats?.totalErrors || 0),
    avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    relayTransactions: Number(relayStats?.count || 0),
    period: "30d",
  });
});

// GET /v1/usage/history — Hourly usage breakdown
usage.get("/history", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const days = Math.min(Number(c.req.query("days") || "7"), 30);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const keys = await db
    .select({ id: schema.apiKeys.id })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.developerId, payload.sub));

  if (keys.length === 0) {
    return c.json({ history: [], period: `${days}d` });
  }

  const keyIds = keys.map((k) => k.id);

  const history = await db
    .select({
      hour: schema.usageHourly.hour,
      endpoint: schema.usageHourly.endpoint,
      requestCount: schema.usageHourly.requestCount,
      errorCount: schema.usageHourly.errorCount,
      totalLatencyMs: schema.usageHourly.totalLatencyMs,
    })
    .from(schema.usageHourly)
    .where(
      and(
        inArray(schema.usageHourly.apiKeyId, keyIds),
        gte(schema.usageHourly.hour, since)
      )
    )
    .orderBy(desc(schema.usageHourly.hour))
    .limit(1000);

  return c.json({ history, period: `${days}d` });
});

export { usage };
