/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback } from "react";
import { JsonRpcProvider } from "ethers";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { ProofStatus } from "./proof-status";
import { CustomSelect } from "./custom-select";
import type { Note } from "@/lib/zktoken/types";
import { getPoolConfig } from "@/lib/zktoken/pool-config";

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

export function TransferForm() {
  const { ready } = useZkToken();
  const { unspent, saveNote, markSpent } = useNotes();
  const { keypair, deriveKey } = useShieldedKey();
  const { activeToken } = useToken();

  const POOL_ADDRESS = activeToken?.pool ?? "";
  const tokenSymbol = activeToken?.symbol ?? "Token";
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number>(-1);
  const [recipientPkX, setRecipientPkX] = useState("");
  const [recipientPkY, setRecipientPkY] = useState("");
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const selectedNote: Note | undefined =
    selectedNoteIdx >= 0 ? unspent[selectedNoteIdx] : undefined;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !selectedNote) return;

    const trimmed = amount.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      setStatus("Error: amount must be a whole number (no decimals)");
      return;
    }
    const transferAmount = BigInt(trimmed);
    if (transferAmount <= 0n || transferAmount > selectedNote.amount) {
      setStatus(`Error: amount must be between 1 and ${selectedNote.amount}`);
      return;
    }

    if (!recipientPkX || !recipientPkY) {
      setStatus("Error: enter the recipient's shielded public key (both X and Y)");
      return;
    }

    let recipientPublicKey: [bigint, bigint];
    try {
      recipientPublicKey = [BigInt(recipientPkX), BigInt(recipientPkY)];
    } catch {
      setStatus("Error: invalid public key format. Must be decimal or hex (0x...) numbers.");
      return;
    }

    setGenerating(true);
    setTxHash(null);
    setStatus(null);

    try {
      let kp = keypair;
      if (!kp) {
        setStatus("Sign the message in your wallet to derive your shielded key...");
        kp = await deriveKey();
        if (!kp) throw new Error("Failed to derive shielded key");
      }

      setStatus("Syncing Merkle tree...");
      const { relayTransfer, relayTransferUnified } = await import("@/lib/zktoken/transaction");
      const {
        createTransferPendingTx,
        updatePendingTx,
        removePendingTx,
      } = await import("@/lib/zktoken/pending-tx");
      const { encodeNote: encNote } = await import("@/lib/zktoken/note");

      // Persist intent before submission so reload can reconcile
      const pendingId = createTransferPendingTx(selectedNote, POOL_ADDRESS);

      setStatus("Generating ZK proof (this may take a moment)...");
      const poolConfig = activeToken ? getPoolConfig(activeToken, selectedNote.assetId) : null;

      let result;
      try {
        const rpcProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

        if (poolConfig?.poolType === "unified") {
          result = await relayTransferUnified({
            provider: rpcProvider as never,
            poolAddress: POOL_ADDRESS,
            inputNote: selectedNote,
            transferAmount,
            recipientPublicKey,
            senderPublicKey: kp.publicKey,
            senderPrivateKey: kp.privateKey,
            wasmPath: poolConfig.circuitPaths.transferWasm,
            zkeyPath: poolConfig.circuitPaths.transferZkey,
            assetId: poolConfig.assetId,
          });
        } else {
          const paths = poolConfig?.circuitPaths ?? { transferWasm: "/circuits/transfer.wasm", transferZkey: "/circuits/transfer_final.zkey" };
          result = await relayTransfer({
            provider: rpcProvider as never,
            poolAddress: POOL_ADDRESS,
            inputNote: selectedNote,
            transferAmount,
            recipientPublicKey,
            senderPublicKey: kp.publicKey,
            senderPrivateKey: kp.privateKey,
            wasmPath: paths.transferWasm,
            zkeyPath: paths.transferZkey,
            paymasterAddress: activeToken?.paymaster,
          });
        }
      } catch (relayErr) {
        removePendingTx(pendingId);
        throw relayErr;
      }

      // Relay confirmed — update pending tx with change note before reconciling
      updatePendingTx(pendingId, {
        status: "submitted",
        txHash: result.relay.txHash,
        changeNoteEncoded:
          result.changeNote && result.changeNote.amount > 0n
            ? encNote(result.changeNote)
            : undefined,
      });

      setTxHash(result.relay.txHash);

      markSpent(selectedNote.nullifier);
      if (result.changeNote && result.changeNote.amount > 0n) {
        saveNote(result.changeNote);
      }

      // Notes reconciled — safe to remove pending record
      removePendingTx(pendingId);

      setStatus("Transfer confirmed via relay!");
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
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Select Note to Spend
        </label>
        {unspent.length === 0 ? (
          <p className="text-sm text-[#444444]">No unspent notes. Deposit tokens first.</p>
        ) : (
          <CustomSelect
            value={String(selectedNoteIdx)}
            options={[
              { value: "-1", label: "Choose a note..." },
              ...unspent.map((note, i) => ({
                value: String(i),
                label: `${note.amount.toString()} ${tokenSymbol} (leaf #${note.leafIndex})`,
              })),
            ]}
            onChange={(val) => setSelectedNoteIdx(Number(val))}
            placeholder="Choose a note..."
          />
        )}
      </div>

      {/* Show user's own public key for sharing */}
      {keypair && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 space-y-2 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-[#888888]">Your Shielded Public Key (share with senders):</p>
            <button
              type="button"
              onClick={() => copyToClipboard(
                `${keypair.publicKey[0].toString()}\n${keypair.publicKey[1].toString()}`,
                "both"
              )}
              className="flex items-center gap-1 shrink-0 rounded px-2 py-0.5 text-xs text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/10 transition-colors duration-200"
            >
              <ClipboardIcon />
              {copied === "both" ? "Copied!" : "Copy Both"}
            </button>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <p className="text-xs text-[#acf901] font-mono break-all select-all min-w-0 flex-1">
              X: {keypair.publicKey[0].toString()}
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(keypair.publicKey[0].toString(), "x")}
              className="shrink-0 rounded p-1 text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/10 transition-colors duration-200"
              title="Copy X"
            >
              {copied === "x" ? <span className="text-xs">Copied!</span> : <ClipboardIcon />}
            </button>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <p className="text-xs text-[#acf901] font-mono break-all select-all min-w-0 flex-1">
              Y: {keypair.publicKey[1].toString()}
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(keypair.publicKey[1].toString(), "y")}
              className="shrink-0 rounded p-1 text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/10 transition-colors duration-200"
              title="Copy Y"
            >
              {copied === "y" ? <span className="text-xs">Copied!</span> : <ClipboardIcon />}
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Recipient Shielded Key (X)
        </label>
        <input
          type="text"
          value={recipientPkX}
          onChange={(e) => setRecipientPkX(e.target.value)}
          placeholder="Recipient's public key X coordinate"
          className={`${inputClass} font-mono text-sm`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Recipient Shielded Key (Y)
        </label>
        <input
          type="text"
          value={recipientPkY}
          onChange={(e) => setRecipientPkY(e.target.value)}
          placeholder="Recipient's public key Y coordinate"
          className={`${inputClass} font-mono text-sm`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount ({tokenSymbol})
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedNote ? `Max: ${selectedNote.amount}` : "100"}
          className={inputClass}
        />
      </div>

      <ProofStatus generating={generating} />
      <button
        type="submit"
        disabled={!ready || generating || !selectedNote}
        className={btnPrimary}
      >
        {!ready
          ? "Initializing..."
          : !selectedNote
          ? "Select a note"
          : generating
          ? "Generating proof..."
          : "Transfer"}
      </button>

      {txHash && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3">
          <p className="text-xs text-[#888888] mb-1">Transaction Hash</p>
          <p className="text-sm text-[#acf901] font-mono break-all">{txHash}</p>
        </div>
      )}
      {status && (
        <p className="text-sm text-[#888888] break-all">{status}</p>
      )}
    </form>
  );
}
