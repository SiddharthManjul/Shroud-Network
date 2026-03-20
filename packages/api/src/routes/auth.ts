import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db, schema } from "../db/index.js";

const auth = new Hono();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "shroud-dev-secret-change-me-in-production"
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  company: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function createJwt(developerId: string, email: string): Promise<string> {
  return new SignJWT({ sub: developerId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyJwt(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; email: string };
  } catch {
    return null;
  }
}

// POST /v1/auth/register
auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { email, password, name, company } = parsed.data;

  // Check if email exists
  const existing = await db
    .select({ id: schema.developers.id })
    .from(schema.developers)
    .where(eq(schema.developers.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [developer] = await db
    .insert(schema.developers)
    .values({ email, passwordHash, name, company })
    .returning({ id: schema.developers.id, email: schema.developers.email });

  const token = await createJwt(developer.id, developer.email);

  return c.json({ token, developer: { id: developer.id, email: developer.email } }, 201);
});

// POST /v1/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const { email, password } = parsed.data;

  const [developer] = await db
    .select()
    .from(schema.developers)
    .where(eq(schema.developers.email, email))
    .limit(1);

  if (!developer) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await bcrypt.compare(password, developer.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await createJwt(developer.id, developer.email);

  return c.json({
    token,
    developer: {
      id: developer.id,
      email: developer.email,
      name: developer.name,
      company: developer.company,
      plan: developer.plan,
    },
  });
});

// GET /v1/auth/me — get current developer info (requires JWT)
auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyJwt(authHeader.slice(7));
  if (!payload) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const [developer] = await db
    .select({
      id: schema.developers.id,
      email: schema.developers.email,
      name: schema.developers.name,
      company: schema.developers.company,
      plan: schema.developers.plan,
      createdAt: schema.developers.createdAt,
    })
    .from(schema.developers)
    .where(eq(schema.developers.id, payload.sub))
    .limit(1);

  if (!developer) {
    return c.json({ error: "Developer not found" }, 404);
  }

  return c.json({ developer });
});

export { auth };
