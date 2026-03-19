import { NextResponse } from "next/server";

/**
 * POST /api/waitlist
 *
 * Receives waitlist signup and appends to a Google Sheet via the
 * Google Sheets API (v4). Uses a service account for auth.
 *
 * Required env vars:
 *   GOOGLE_SHEETS_ID          — Spreadsheet ID from the sheet URL
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — service account email
 *   GOOGLE_PRIVATE_KEY        — PEM private key (with \n escaped)
 *
 * The Google Sheet should have columns:
 *   A: Timestamp | B: Email | C: Name | D: Company | E: Use Case
 */

interface WaitlistBody {
  email: string;
  name?: string;
  company?: string;
  useCase?: string;
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Google service account credentials not configured");
  }

  // Build JWT header + claim set
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64url");

  const unsignedToken = `${enc(header)}.${enc(claim)}`;

  // Sign with RS256 using Node.js crypto
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const signature = sign.sign(key, "base64url");

  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to get access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function appendToSheet(row: string[]): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) {
    throw new Error("GOOGLE_SHEETS_ID not configured");
  }

  const accessToken = await getAccessToken();

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [row],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to append to sheet: ${errText}`);
  }
}

export async function POST(request: Request) {
  try {
    const body: WaitlistBody = await request.json();

    if (!body.email || typeof body.email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      body.email,
      body.name || "",
      body.company || "",
      body.useCase || "",
    ];

    // If Google Sheets is configured, append to sheet
    if (process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      await appendToSheet(row);
    } else {
      // Fallback: log to console (for development)
      console.log("[Waitlist Signup]", { timestamp, ...body });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Failed to process signup" },
      { status: 500 }
    );
  }
}
