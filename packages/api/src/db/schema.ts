import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  bigserial,
  integer,
  bigint,
  unique,
} from "drizzle-orm/pg-core";

export const developers = pgTable("developers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  company: text("company"),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id")
    .notNull()
    .references(() => developers.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").unique().notNull(),
  keyPrefix: text("key_prefix").notNull(),
  name: text("name").notNull().default("Default"),
  environment: text("environment").notNull(), // 'live' | 'test'
  scope: text("scope").notNull().default("secret"), // 'secret' | 'publishable'
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const usageHourly = pgTable(
  "usage_hourly",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
    endpoint: text("endpoint").notNull(),
    requestCount: integer("request_count").default(0),
    errorCount: integer("error_count").default(0),
    totalLatencyMs: bigint("total_latency_ms", { mode: "number" }).default(0),
  },
  (table) => [unique().on(table.apiKeyId, table.hour, table.endpoint)]
);

export const relayTransactions = pgTable("relay_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  txType: text("tx_type").notNull(), // 'deposit' | 'transfer' | 'withdraw'
  txHash: text("tx_hash"),
  status: text("status").notNull(), // 'pending' | 'success' | 'failed'
  gasUsed: bigint("gas_used", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
