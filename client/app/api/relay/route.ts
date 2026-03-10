import { NextRequest, NextResponse } from "next/server";
import { Contract, Interface, JsonRpcProvider, Wallet, formatEther } from "ethers";
import { PAYMASTER_ABI } from "@/lib/zktoken/abi/paymaster";
import { SHIELDED_POOL_ABI } from "@/lib/zktoken/abi/shielded-pool";
import { TRANSFER_VERIFIER_ABI } from "@/lib/zktoken/abi/transfer-verifier";
import { WITHDRAW_VERIFIER_ABI } from "@/lib/zktoken/abi/withdraw-verifier";

export const runtime = "nodejs";

const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;
const RELAY_RPC_URL = process.env.RELAY_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;
const PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;

// ─── Rate limiter (per-IP sliding window) ────────────────────────────────────

const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 5; // max requests per window per IP

/** Map of IP → list of timestamps within the current window. */
const requestLog = new Map<string, number[]>();

/** Prune stale entries periodically to prevent memory leak. */
let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60_000;

function pruneStaleEntries() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  const cutoff = now - RATE_WINDOW_MS;
  for (const [ip, timestamps] of requestLog) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, valid);
    }
  }
}

/** Returns true if the request should be rate-limited (rejected). */
function isRateLimited(ip: string): boolean {
  pruneStaleEntries();
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= RATE_MAX_REQUESTS) {
    requestLog.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Proof pre-validation helpers ────────────────────────────────────────────

/**
 * Decode the 256-byte proof blob into the (pA, pB, pC) arrays expected by
 * the on-chain verifier's `verifyProof` function.
 *
 * Layout: 8 × 32-byte uint256 words packed as:
 *   pA[0], pA[1], pB[0][0], pB[0][1], pB[1][0], pB[1][1], pC[0], pC[1]
 */
function decodeProofBytes(proofHex: string): {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
} | null {
  try {
    const hex = proofHex.startsWith("0x") ? proofHex.slice(2) : proofHex;
    if (hex.length !== 512) return null; // 256 bytes = 512 hex chars
    const w = (i: number) => BigInt("0x" + hex.slice(i * 64, (i + 1) * 64));
    return {
      pA: [w(0), w(1)],
      pB: [[w(2), w(3)], [w(4), w(5)]],
      pC: [w(6), w(7)],
    };
  } catch {
    return null;
  }
}

/**
 * Pre-validate a proof off-chain by calling the verifier's `verifyProof`
 * as a static call (no gas cost). Returns true if valid, false if invalid,
 * null if the check couldn't be performed (non-fatal).
 */
async function preValidateProof(opts: {
  provider: JsonRpcProvider;
  poolAddress: string;
  proofHex: string;
  pubSignals: bigint[];
  txType: "transfer" | "withdraw";
}): Promise<boolean | null> {
  const { provider, poolAddress, proofHex, pubSignals, txType } = opts;

  const decoded = decodeProofBytes(proofHex);
  if (!decoded) return null;

  try {
    const pool = new Contract(poolAddress, SHIELDED_POOL_ABI, provider);

    const verifierAddr: string =
      txType === "transfer"
        ? await pool.transferVerifier()
        : await pool.withdrawVerifier();

    const verifierAbi =
      txType === "transfer" ? TRANSFER_VERIFIER_ABI : WITHDRAW_VERIFIER_ABI;
    const verifier = new Contract(verifierAddr, verifierAbi, provider);

    const valid: boolean = await verifier.verifyProof(
      decoded.pA,
      decoded.pB,
      decoded.pC,
      pubSignals
    );
    return valid;
  } catch {
    // Static call reverted or RPC error — skip pre-validation
    return null;
  }
}

// ─── Paymaster balance check ─────────────────────────────────────────────────

const LOW_BALANCE_THRESHOLD = BigInt("100000000000000000"); // 0.1 AVAX

async function checkPaymasterBalance(
  provider: JsonRpcProvider,
  paymasterAddr: string
): Promise<{ balance: bigint; low: boolean }> {
  try {
    const paymaster = new Contract(paymasterAddr, PAYMASTER_ABI, provider);
    const balance: bigint = await paymaster.getBalance();
    return { balance, low: balance < LOW_BALANCE_THRESHOLD };
  } catch {
    return { balance: 0n, low: false }; // Can't check — don't block the request
  }
}

// ─── GET /api/relay — Discovery endpoint ─────────────────────────────────────

export async function GET() {
  if (!RELAY_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Relay not configured" },
      { status: 503 }
    );
  }

  const provider = new JsonRpcProvider(RELAY_RPC_URL);
  const wallet = new Wallet(RELAY_PRIVATE_KEY, provider);

  return NextResponse.json({
    relayerAddress: wallet.address,
    paymasterAddress: PAYMASTER_ADDRESS ?? null,
  });
}

// ─── POST /api/relay — Submit proof bundle ───────────────────────────────────

interface TransferBody {
  type: "transfer";
  proof: string;
  merkleRoot: string;
  nullifierHash: string;
  newCommitment1: string;
  newCommitment2: string;
  encryptedMemo1: string;
  encryptedMemo2: string;
  paymasterAddress?: string;
}

interface WithdrawBody {
  type: "withdraw";
  proof: string;
  merkleRoot: string;
  nullifierHash: string;
  amount: string;
  changeCommitment: string;
  recipient: string;
  encryptedMemo: string;
  paymasterAddress?: string;
}

type RelayBody = TransferBody | WithdrawBody;

export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 5 requests per minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  if (!RELAY_PRIVATE_KEY || !RELAY_RPC_URL) {
    return NextResponse.json(
      { error: "Relay not configured. Set RELAY_PRIVATE_KEY and RELAY_RPC_URL." },
      { status: 503 }
    );
  }

  let body: RelayBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type || !["transfer", "withdraw"].includes(body.type)) {
    return NextResponse.json(
      { error: "Missing or invalid 'type' field. Must be 'transfer' or 'withdraw'." },
      { status: 400 }
    );
  }

  // Use paymasterAddress from body (multi-token), fall back to env var (legacy)
  const targetPaymaster = body.paymasterAddress || PAYMASTER_ADDRESS;
  if (!targetPaymaster) {
    return NextResponse.json(
      { error: "No paymaster address provided and NEXT_PUBLIC_PAYMASTER_ADDRESS not set." },
      { status: 400 }
    );
  }

  const provider = new JsonRpcProvider(RELAY_RPC_URL);
  const wallet = new Wallet(RELAY_PRIVATE_KEY, provider);
  const paymasterIface = new Interface(PAYMASTER_ABI);

  // ── Paymaster balance check ────────────────────────────────────────────────
  const { balance: paymasterBalance, low: paymasterLow } =
    await checkPaymasterBalance(provider, targetPaymaster);

  if (paymasterBalance === 0n) {
    return NextResponse.json(
      { error: "Paymaster has zero balance — cannot refund gas." },
      { status: 503 }
    );
  }

  try {
    let data: string;
    let poolAddress: string | null = null;

    if (body.type === "transfer") {
      const t = body as TransferBody;
      if (!t.proof || !t.merkleRoot || !t.nullifierHash || !t.newCommitment1 || !t.newCommitment2) {
        return NextResponse.json({ error: "Missing required transfer fields" }, { status: 400 });
      }

      // Resolve pool address from paymaster for pre-validation
      try {
        const paymaster = new Contract(targetPaymaster, PAYMASTER_ABI, provider);
        poolAddress = await paymaster.pool();
      } catch { /* non-fatal */ }

      // ── Off-chain proof pre-validation ───────────────────────────────────
      if (poolAddress) {
        const valid = await preValidateProof({
          provider,
          poolAddress,
          proofHex: t.proof,
          pubSignals: [
            BigInt(t.merkleRoot),
            BigInt(t.nullifierHash),
            BigInt(t.newCommitment1),
            BigInt(t.newCommitment2),
          ],
          txType: "transfer",
        });
        if (valid === false) {
          return NextResponse.json(
            { error: "Proof verification failed — invalid proof." },
            { status: 400 }
          );
        }
      }

      data = paymasterIface.encodeFunctionData("relayTransfer", [
        wallet.address,
        t.proof,
        BigInt(t.merkleRoot),
        BigInt(t.nullifierHash),
        BigInt(t.newCommitment1),
        BigInt(t.newCommitment2),
        t.encryptedMemo1 ?? "0x",
        t.encryptedMemo2 ?? "0x",
      ]);
    } else {
      const w = body as WithdrawBody;
      if (!w.proof || !w.merkleRoot || !w.nullifierHash || !w.amount || !w.recipient) {
        return NextResponse.json({ error: "Missing required withdraw fields" }, { status: 400 });
      }

      // Resolve pool address from paymaster for pre-validation
      try {
        const paymaster = new Contract(targetPaymaster, PAYMASTER_ABI, provider);
        poolAddress = await paymaster.pool();
      } catch { /* non-fatal */ }

      // ── Off-chain proof pre-validation ───────────────────────────────────
      if (poolAddress) {
        const valid = await preValidateProof({
          provider,
          poolAddress,
          proofHex: w.proof,
          pubSignals: [
            BigInt(w.merkleRoot),
            BigInt(w.nullifierHash),
            BigInt(w.amount),
            BigInt(w.changeCommitment ?? "0"),
          ],
          txType: "withdraw",
        });
        if (valid === false) {
          return NextResponse.json(
            { error: "Proof verification failed — invalid proof." },
            { status: 400 }
          );
        }
      }

      data = paymasterIface.encodeFunctionData("relayWithdraw", [
        wallet.address,
        w.proof,
        BigInt(w.merkleRoot),
        BigInt(w.nullifierHash),
        BigInt(w.amount),
        BigInt(w.changeCommitment ?? "0"),
        w.recipient,
        w.encryptedMemo ?? "0x",
      ]);
    }

    const tx = await wallet.sendTransaction({
      to: targetPaymaster,
      data,
    });

    const receipt = await tx.wait();

    const response: Record<string, unknown> = {
      txHash: tx.hash,
      blockNumber: receipt!.blockNumber,
      status: receipt!.status,
    };

    // Include paymaster balance warning if low
    if (paymasterLow) {
      response.paymasterWarning = `Paymaster balance low: ${formatEther(paymasterBalance)} AVAX`;
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Surface actionable errors
    if (message.includes("insufficient funds")) {
      return NextResponse.json(
        { error: "Relay wallet has insufficient AVAX for gas" },
        { status: 503 }
      );
    }
    if (message.includes("Paymaster: refund failed") || message.includes("insufficient balance")) {
      return NextResponse.json(
        { error: "Paymaster underfunded — gas refund failed" },
        { status: 503 }
      );
    }

    console.error("[relay] Transaction failed:", message);
    return NextResponse.json(
      { error: `Transaction failed: ${message}` },
      { status: 500 }
    );
  }
}
