import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8080/v1/graphql";

/**
 * POST /api/indexer
 * Proxies GraphQL requests to the Envio HyperIndex indexer,
 * avoiding CORS issues when called from the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Indexer proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
