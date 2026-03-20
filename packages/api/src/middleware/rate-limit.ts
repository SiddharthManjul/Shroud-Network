import { createMiddleware } from "hono/factory";
import type { ApiKeyContext } from "./auth.js";

interface RateLimitConfig {
  requestsPerMinute: number;
  relayPerHour: number;
  proofsPerHour: number;
}

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: { requestsPerMinute: 60, relayPerHour: 10, proofsPerHour: 5 },
  starter: { requestsPerMinute: 300, relayPerHour: 100, proofsPerHour: 50 },
  growth: { requestsPerMinute: 1000, relayPerHour: 500, proofsPerHour: 200 },
  enterprise: {
    requestsPerMinute: 10000,
    relayPerHour: 5000,
    proofsPerHour: 2000,
  },
};

// In-memory rate limit store (swap to Redis for production)
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/**
 * Rate limiter middleware. Applies per-minute request limits based on plan tier.
 */
export const rateLimit = (
  type: "request" | "relay" | "proof" = "request"
) =>
  createMiddleware<{ Variables: { apiKey: ApiKeyContext } }>(
    async (c, next) => {
      const apiKey = c.get("apiKey");
      if (!apiKey) {
        return c.json({ error: "API key context missing" }, 500);
      }

      const tierConfig = TIER_LIMITS[apiKey.plan] || TIER_LIMITS.free;

      let limit: number;
      let windowMs: number;
      let bucketKey: string;

      switch (type) {
        case "relay":
          limit = tierConfig.relayPerHour;
          windowMs = 3600_000;
          bucketKey = `relay:${apiKey.apiKeyId}`;
          break;
        case "proof":
          limit = tierConfig.proofsPerHour;
          windowMs = 3600_000;
          bucketKey = `proof:${apiKey.apiKeyId}`;
          break;
        default:
          limit = tierConfig.requestsPerMinute;
          windowMs = 60_000;
          bucketKey = `req:${apiKey.apiKeyId}`;
      }

      const result = checkLimit(bucketKey, limit, windowMs);

      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header(
        "X-RateLimit-Reset",
        String(Math.ceil(result.resetAt / 1000))
      );

      if (!result.allowed) {
        return c.json(
          {
            error: "Rate limit exceeded",
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          },
          429
        );
      }

      await next();
    }
  );

// Periodic cleanup of expired buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}, 60_000);
