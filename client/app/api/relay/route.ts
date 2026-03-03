import { NextRequest, NextResponse } from "next/server";
import { Interface, JsonRpcProvider, Wallet } from "ethers";
import { PAYMASTER_ABI } from "@/lib/zktoken/abi/paymaster";

export const runtime = "nodejs";

const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;
const RELAY_RPC_URL = process.env.RELAY_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;
const PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;

// ─── GET /api/relay — Discovery endpoint ─────────────────────────────────────

export async function GET() {
  if (!RELAY_PRIVATE_KEY || !PAYMASTER_ADDRESS) {
    return NextResponse.json(
      { error: "Relay not configured" },
      { status: 503 }
    );
  }

  const provider = new JsonRpcProvider(RELAY_RPC_URL);
  const wallet = new Wallet(RELAY_PRIVATE_KEY, provider);

  return NextResponse.json({
    relayerAddress: wallet.address,
    paymasterAddress: PAYMASTER_ADDRESS,
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
}

type RelayBody = TransferBody | WithdrawBody;

export async function POST(request: NextRequest) {
  if (!RELAY_PRIVATE_KEY || !RELAY_RPC_URL || !PAYMASTER_ADDRESS) {
    return NextResponse.json(
      { error: "Relay not configured. Set RELAY_PRIVATE_KEY, RELAY_RPC_URL, and NEXT_PUBLIC_PAYMASTER_ADDRESS." },
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

  const provider = new JsonRpcProvider(RELAY_RPC_URL);
  const wallet = new Wallet(RELAY_PRIVATE_KEY, provider);
  const paymasterIface = new Interface(PAYMASTER_ABI);

  try {
    let data: string;

    if (body.type === "transfer") {
      const t = body as TransferBody;
      if (!t.proof || !t.merkleRoot || !t.nullifierHash || !t.newCommitment1 || !t.newCommitment2) {
        return NextResponse.json({ error: "Missing required transfer fields" }, { status: 400 });
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
      to: PAYMASTER_ADDRESS,
      data,
    });

    const receipt = await tx.wait();

    return NextResponse.json({
      txHash: tx.hash,
      blockNumber: receipt!.blockNumber,
      status: receipt!.status,
    });
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
