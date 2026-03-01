"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { ProofStatus } from "./proof-status";
import type { Note } from "@/lib/zktoken/types";

const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL_ADDRESS ?? "";

export function TransferForm() {
  const { ready } = useZkToken();
  const { address, signer, provider } = useWallet();
  const { unspent, saveNote, markSpent } = useNotes();
  const { keypair, deriving, deriveKey } = useShieldedKey();
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number>(-1);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const selectedNote: Note | undefined = selectedNoteIdx >= 0 ? unspent[selectedNoteIdx] : undefined;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !address || !signer || !provider || !selectedNote) return;

    const transferAmount = BigInt(amount);
    if (transferAmount <= 0n || transferAmount > selectedNote.amount) {
      setStatus(`Error: amount must be between 1 and ${selectedNote.amount}`);
      return;
    }

    if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
      setStatus("Error: enter a valid EVM address");
      return;
    }

    setGenerating(true);
    setTxHash(null);
    setStatus(null);

    try {
      // 1. Ensure sender has a shielded keypair
      let kp = keypair;
      if (!kp) {
        setStatus("Sign the message in your wallet to derive your shielded key...");
        kp = await deriveKey();
        if (!kp) throw new Error("Failed to derive shielded key");
      }

      // 2. Derive recipient's shielded public key
      //    For now: recipient must have signed and their key is stored locally.
      //    In production: query on-chain registry.
      setStatus("Resolving recipient shielded key...");
      const { keccak256, toUtf8Bytes } = await import("ethers");
      const { KeyManager, SUBGROUP_ORDER } = await import("@/lib/zktoken/keys");

      // Check if we have the recipient's key in localStorage
      const recipientKeyStored = localStorage.getItem(
        "zktoken_shielded_key_" + recipient.toLowerCase()
      );

      let recipientPublicKey;
      if (recipientKeyStored) {
        const recipientKp = await KeyManager.fromPrivateKey(recipientKeyStored);
        recipientPublicKey = recipientKp.publicKey;
      } else if (recipient.toLowerCase() === address.toLowerCase()) {
        // Self-transfer
        recipientPublicKey = kp.publicKey;
      } else {
        throw new Error(
          "Recipient has not registered a shielded key yet. " +
          "They must connect their wallet and derive their shielded key first."
        );
      }

      // 3. Sync Merkle tree and get path
      setStatus("Syncing Merkle tree...");
      const { transfer } = await import("@/lib/zktoken/transaction");

      // 4. Generate proof and submit
      setStatus("Generating ZK proof (this may take a moment)...");
      const result = await transfer({
        signer: signer as never,
        provider: provider as never,
        poolAddress: POOL_ADDRESS,
        inputNote: selectedNote,
        transferAmount,
        recipientPublicKey,
        senderPublicKey: kp.publicKey,
        senderPrivateKey: kp.privateKey,
        wasmPath: "/circuits/transfer.wasm",
        zkeyPath: "/circuits/transfer_final.zkey",
      });

      setTxHash(result.tx.hash);
      setStatus("Transfer submitted. Waiting for confirmation...");

      const receipt = await result.tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction reverted");

      // 5. Mark input note as spent, save change note
      markSpent(selectedNote.nullifier);
      if (result.changeNote && result.changeNote.amount > 0n) {
        saveNote(result.changeNote);
      }

      setStatus("Transfer confirmed!");
      setSelectedNoteIdx(-1);
      setAmount("");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <form onSubmit={handleTransfer} className="space-y-4">
      {/* Note selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Select Note to Spend
        </label>
        {unspent.length === 0 ? (
          <p className="text-sm text-zinc-600">No unspent notes. Deposit tokens first.</p>
        ) : (
          <select
            value={selectedNoteIdx}
            onChange={(e) => setSelectedNoteIdx(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value={-1}>Choose a note...</option>
            {unspent.map((note, i) => (
              <option key={note.noteCommitment.toString()} value={i}>
                {note.amount.toString()} SRD (leaf #{note.leafIndex})
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Amount (SRD)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedNote ? `Max: ${selectedNote.amount}` : "100"}
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

      <ProofStatus generating={generating} />
      <button
        type="submit"
        disabled={!ready || !address || generating || !selectedNote}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {!address ? "Connect wallet first" : !ready ? "Initializing..." : !selectedNote ? "Select a note" : generating ? "Generating proof..." : "Transfer"}
      </button>

      {txHash && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500 mb-1">Transaction Hash</p>
          <p className="text-sm text-white font-mono break-all">{txHash}</p>
        </div>
      )}
      {status && (
        <p className="text-sm text-zinc-400 break-all">{status}</p>
      )}
    </form>
  );
}
