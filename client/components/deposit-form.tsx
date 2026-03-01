"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";

const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL_ADDRESS ?? "";
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";

export function DepositForm() {
  const { ready } = useZkToken();
  const { address, signer, provider } = useWallet();
  const { saveNote } = useNotes();
  const { keypair, deriving, deriveKey } = useShieldedKey();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !signer || !address) return;

    setStatus("Preparing deposit...");
    try {
      // Ensure we have a shielded keypair
      let kp = keypair;
      if (!kp) {
        setStatus("Sign the message in your wallet to derive your shielded key...");
        kp = await deriveKey();
        if (!kp) throw new Error("Failed to derive shielded key");
      }

      const { deposit, waitForDeposit } = await import("@/lib/zktoken/transaction");

      setStatus("Approve the token transfer in your wallet...");
      const result = await deposit({
        signer: signer as never,
        poolAddress: POOL_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        amount: BigInt(amount),
        ownerPublicKey: kp.publicKey,
      });

      setStatus(`Deposit submitted: ${result.tx.hash}. Waiting for confirmation...`);

      const finalizedNote = await waitForDeposit(
        result.tx,
        result.pendingNote,
        provider! as never,
        POOL_ADDRESS
      );
      saveNote(finalizedNote);

      setStatus(`Deposit confirmed: ${result.tx.hash}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <form onSubmit={handleDeposit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Amount (SRD)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {!keypair && address && (
        <button
          type="button"
          onClick={deriveKey}
          disabled={deriving}
          className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {deriving ? "Signing..." : "Derive Shielded Key (one-time)"}
        </button>
      )}

      <button
        type="submit"
        disabled={!ready || !address}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {!address ? "Connect wallet first" : !ready ? "Initializing..." : "Deposit"}
      </button>
      {status && (
        <p className="text-sm text-zinc-400 break-all">{status}</p>
      )}
    </form>
  );
}
