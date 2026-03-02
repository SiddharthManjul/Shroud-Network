"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { ProofStatus } from "./proof-status";

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#ff1a1a] placeholder:text-[#444444] focus:border-[#ff1a1a] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a] disabled:opacity-40 transition-colors duration-200";

export function WithdrawForm() {
  const { ready } = useZkToken();
  const { address } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !address) return;

    setGenerating(true);
    setStatus("Generating ZK proof...");
    try {
      setStatus("Withdraw proof generation requires a selected note and pool connection.");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <form onSubmit={handleWithdraw} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className={`${inputClass} font-mono text-sm`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="500000"
          className={inputClass}
        />
      </div>
      <ProofStatus generating={generating} />
      <button
        type="submit"
        disabled={!ready || !address || generating}
        className={btnPrimary}
      >
        {!address
          ? "Connect wallet first"
          : !ready
          ? "Initializing..."
          : generating
          ? "Generating proof..."
          : "Withdraw"}
      </button>
      {status && (
        <p className="text-sm text-[#888888] break-all">{status}</p>
      )}
    </form>
  );
}
