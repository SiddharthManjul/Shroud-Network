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

const btnWarning =
  "w-full rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-[#ff1a1a] hover:bg-[#ff1a1a]/10 border border-[#ff1a1a]/40 hover:border-[#ff1a1a] disabled:opacity-40 transition-colors duration-200";

export function DepositForm() {
  const { ready } = useZkToken();
  const { address, signer, provider } = useWallet();
  const { notes, saveNote } = useNotes();
  const { keypair, deriving, deriveKey } = useShieldedKey();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  // Count notes that are stuck pending finalization
  const pendingNotes = notes.filter((n) => n.leafIndex < 0);

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

      setStatus(`✓ Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer.`);
      setAmount("");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Recovery: sync the full Merkle tree and find leaf indices for stuck notes.
  // Notes can come from Deposit, PrivateTransfer, or Withdrawal events —
  // we use MerkleTreeSync which replays ALL event types in order.
  const handleRecoverNotes = async () => {
    if (!provider || pendingNotes.length === 0) return;
    setRecovering(true);
    setStatus(`Syncing Merkle tree to recover ${pendingNotes.length} unfinalized note(s)...`);

    try {
      const { MerkleTreeSync } = await import("@/lib/zktoken/merkle");
      const { finaliseNote } = await import("@/lib/zktoken/note");

      const tree = new MerkleTreeSync();
      await tree.syncFromChain(provider as never, POOL_ADDRESS);

      setStatus(`Tree synced (${tree.size} leaves). Matching commitments...`);

      let recovered = 0;
      for (const note of pendingNotes) {
        const leafIndex = tree.findLeafIndex(note.noteCommitment);
        if (leafIndex >= 0) {
          const finalized = await finaliseNote(note, leafIndex);
          saveNote(finalized);
          recovered++;
        } else {
          console.log(
            `[recovery] no match for local commitment 0x${note.noteCommitment.toString(16).padStart(64, "0")}`
          );
        }
      }

      setStatus(
        recovered > 0
          ? `Recovered ${recovered} note(s)! They are now ready to use.`
          : `No matching commitments found in ${tree.size} on-chain leaves. ` +
            `The notes may have been created with different parameters.`
      );
    } catch (err) {
      setStatus(`Recovery error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRecovering(false);
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

      {/* Recovery button — only shown when there are stuck notes */}
      {pendingNotes.length > 0 && provider && (
        <button
          type="button"
          onClick={handleRecoverNotes}
          disabled={recovering}
          className={btnWarning}
        >
          {recovering
            ? "Scanning chain..."
            : `⚠ Recover ${pendingNotes.length} unfinalized note${pendingNotes.length > 1 ? "s" : ""}`}
        </button>
      )}

      {status && (
        <p className="text-sm text-[#888888] break-all">{status}</p>
      )}
    </form>
  );
}
