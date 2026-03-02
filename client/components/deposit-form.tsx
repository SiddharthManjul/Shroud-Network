"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";

const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL_ADDRESS ?? "";
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#ff1a1a] placeholder:text-[#444444] focus:border-[#ff1a1a] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2 text-sm font-medium text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a] disabled:opacity-40 transition-colors duration-200";

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
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount (SRD)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className={inputClass}
        />
      </div>

      {!keypair && address && (
        <button
          type="button"
          onClick={deriveKey}
          disabled={deriving}
          className={btnSecondary}
        >
          {deriving ? "Signing..." : "Derive Shielded Key (one-time)"}
        </button>
      )}

      <button type="submit" disabled={!ready || !address} className={btnPrimary}>
        {!address ? "Connect wallet first" : !ready ? "Initializing..." : "Deposit"}
      </button>

      {status && (
        <p className="text-sm text-[#888888] break-all">{status}</p>
      )}
    </form>
  );
}
