CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"environment" text NOT NULL,
	"scope" text DEFAULT 'secret' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"company" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "developers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "relay_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"tx_type" text NOT NULL,
	"tx_hash" text,
	"status" text NOT NULL,
	"gas_used" bigint,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_key_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"endpoint" text NOT NULL,
	"request_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"total_latency_ms" bigint DEFAULT 0,
	CONSTRAINT "usage_hourly_api_key_id_hour_endpoint_unique" UNIQUE("api_key_id","hour","endpoint")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_transactions" ADD CONSTRAINT "relay_transactions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_hourly" ADD CONSTRAINT "usage_hourly_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;