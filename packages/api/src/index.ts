import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

import { auth } from "./routes/auth.js";
import { apiKeysRouter } from "./routes/api-keys.js";
import { pools } from "./routes/pools.js";
import { relay } from "./routes/relay.js";
import { proof } from "./routes/proof.js";
import { merkle } from "./routes/merkle.js";
import { events } from "./routes/events.js";
import { usage } from "./routes/usage.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { trackUsage } from "./middleware/usage.js";

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

// ─── Auth routes (no API key required, uses JWT) ────────────────────────────
app.route("/v1/auth", auth);
app.route("/v1/auth/api-keys", apiKeysRouter);

// ─── Public routes (optional API key) ───────────────────────────────────────
app.route("/v1/pools", pools);

// ─── API key protected routes ───────────────────────────────────────────────

// Merkle data (read-only, publishable key OK)
app.use("/v1/merkle/*", apiKeyAuth());
app.use("/v1/merkle/*", rateLimit("request"));
app.use("/v1/merkle/*", trackUsage());
app.route("/v1/merkle", merkle);

// Events (read-only, publishable key OK)
app.use("/v1/events/*", apiKeyAuth());
app.use("/v1/events/*", rateLimit("request"));
app.use("/v1/events/*", trackUsage());
app.route("/v1/events", events);

// Relay (secret key required)
app.use("/v1/relay/*", apiKeyAuth({ requireSecret: true }));
app.use("/v1/relay/*", rateLimit("relay"));
app.use("/v1/relay/*", trackUsage());
app.route("/v1/relay", relay);

// Server-side proof generation (secret key required)
app.use("/v1/proof/*", apiKeyAuth({ requireSecret: true }));
app.use("/v1/proof/*", rateLimit("proof"));
app.use("/v1/proof/*", trackUsage());
app.route("/v1/proof", proof);

// Usage stats (JWT auth, handled inside routes)
app.route("/v1/usage", usage);

// ─── Start server ───────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 4000;

console.log(`Shroud API starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Shroud API running at http://localhost:${port}`);

export default app;
