/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useMemo } from "react";
import { JsonRpcProvider } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { ProofStatus } from "./proof-status";
import { CustomSelect } from "./custom-select";
import type { Note } from "@/lib/zktoken/types";

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const toggleBtn = (active: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
    active
      ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/40"
      : "bg-[#0d0d0d] text-[#888888] border border-[#2a2a2a] hover:text-[#acf901] hover:border-[#acf901]/30"
  }`;

const META_TX_RELAYER_ADDRESS = process.env.NEXT_PUBLIC_META_TX_RELAYER_ADDRESS;

// Fee: 0.1% of withdrawal, minimum 1 token unit
function computeFee(amount: bigint): bigint {
  const fee = amount / 1000n;
  return fee < 1n ? 1n : fee;
}

export function WithdrawForm() {
  const { ready } = useZkToken();
  const { signer, provider } = useWallet();
  const { unspent, saveNote, markSpent } = useNotes();
  const { keypair, deriveKey } = useShieldedKey();
  const { activeToken } = useToken();

  const POOL_ADDRESS = activeToken?.pool ?? "";
  const tokenSymbol = activeToken?.symbol ?? "Token";
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number>(-1);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [useMetaRelay, setUseMetaRelay] = useState(false);

  const ROUND_AMOUNTS = ["100", "500", "1000", "5000", "10000"];

  const isNonRoundAmount =
    amount.trim() !== "" &&
    /^\d+$/.test(amount.trim()) &&
    !ROUND_AMOUNTS.includes(amount.trim());

  const selectedNote: Note | undefined =
    selectedNoteIdx >= 0 ? unspent[selectedNoteIdx] : undefined;

  const metaRelayAvailable = !!META_TX_RELAYER_ADDRESS;

  // Compute fee for display
  const parsedAmount = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return 0n;
    return BigInt(trimmed);
  }, [amount]);

  const relayFee = useMemo(() => {
    if (parsedAmount <= 0n) return 0n;
    return computeFee(parsedAmount);
  }, [parsedAmount]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !selectedNote) return;

    const trimmed = amount.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      setStatus("Error: amount must be a whole number (no decimals)");
      return;
    }
    const withdrawAmount = BigInt(trimmed);
    if (withdrawAmount <= 0n || withdrawAmount > selectedNote.amount) {
      setStatus(`Error: amount must be between 1 and ${selectedNote.amount}`);
      return;
    }

    if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
      setStatus("Error: enter a valid EVM recipient address");
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

      const {
        createWithdrawPendingTx,
        updatePendingTx,
        removePendingTx,
      } = await import("@/lib/zktoken/pending-tx");
      const { encodeNote: encNote } = await import("@/lib/zktoken/note");

      // Persist intent before submission so reload can reconcile
      const pendingId = createWithdrawPendingTx(selectedNote, POOL_ADDRESS);

      // ── Meta-tx relay path (fee in ERC20, gasless) ────────────────────
      if (useMetaRelay && META_TX_RELAYER_ADDRESS && signer) {
        const fee = computeFee(withdrawAmount);
        if (fee >= withdrawAmount) {
          setStatus("Error: withdrawal amount too small to cover relay fee");
          removePendingTx(pendingId);
          setGenerating(false);
          return;
        }

        setStatus("Syncing Merkle tree...");
        const { relayMetaWithdraw } = await import("@/lib/zktoken/transaction");

        setStatus("Generating ZK proof (this may take a moment)...");
        let result;
        try {
          result = await relayMetaWithdraw({
            signer: signer as never,
            provider: provider as never,
            poolAddress: POOL_ADDRESS,
            inputNote: selectedNote,
            withdrawAmount,
            recipient,
            senderPublicKey: kp.publicKey,
            senderPrivateKey: kp.privateKey,
            wasmPath: "/circuits/withdraw.wasm",
            zkeyPath: "/circuits/withdraw_final.zkey",
            fee,
            metaTxRelayerAddress: META_TX_RELAYER_ADDRESS,
          });
        } catch (relayErr) {
          removePendingTx(pendingId);
          throw relayErr;
        }

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
        removePendingTx(pendingId);

        setStatus(`Withdrawal confirmed via meta-tx relay! (Fee: ${fee} ${tokenSymbol})`);
        setSelectedNoteIdx(-1);
        setAmount("");
        setRecipient("");
        setGenerating(false);
        return;
      }

      // ── Paymaster relay path (existing flow) ──────────────────────────
      setStatus("Syncing Merkle tree...");
      const { relayWithdraw } = await import("@/lib/zktoken/transaction");
      const rpcProvider = provider ?? new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

      setStatus("Generating ZK proof (this may take a moment)...");
      let result;
      try {
        result = await relayWithdraw({
          provider: rpcProvider as never,
          poolAddress: POOL_ADDRESS,
          inputNote: selectedNote,
          withdrawAmount,
          recipient,
          senderPublicKey: kp.publicKey,
          senderPrivateKey: kp.privateKey,
          wasmPath: "/circuits/withdraw.wasm",
          zkeyPath: "/circuits/withdraw_final.zkey",
          paymasterAddress: activeToken?.paymaster,
        });
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

      setStatus("Withdrawal confirmed via relay!");
      setSelectedNoteIdx(-1);
      setAmount("");
      setRecipient("");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <form onSubmit={handleWithdraw} className="space-y-4">
      {/* Gas payment mode toggle — only shown when MetaTxRelayer is configured */}
      {metaRelayAvailable && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Gas Payment
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseMetaRelay(false)}
              className={toggleBtn(!useMetaRelay)}
            >
              Paymaster (AVAX)
            </button>
            <button
              type="button"
              onClick={() => setUseMetaRelay(true)}
              className={toggleBtn(useMetaRelay)}
            >
              Token Fee (Gasless)
            </button>
          </div>
          {useMetaRelay && (
            <p className="mt-1 text-xs text-[#666666]">
              A small fee in {tokenSymbol} is deducted from the withdrawal. You need zero AVAX.
            </p>
          )}
        </div>
      )}

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

      {/* Recipient */}
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Recipient Address (public EVM)
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className={`${inputClass} font-mono text-sm`}
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount ({tokenSymbol})
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedNote ? `Max: ${selectedNote.amount}` : "500"}
          className={inputClass}
        />
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {ROUND_AMOUNTS.filter(
            (v) => !selectedNote || BigInt(v) <= selectedNote.amount
          ).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                amount === v
                  ? "bg-[#acf901]/15 text-[#acf901] border border-[#acf901]/50"
                  : "bg-[#0d0d0d] text-[#888888] border border-[#2a2a2a] hover:text-[#acf901] hover:border-[#acf901]/30"
              }`}
            >
              {Number(v).toLocaleString()}
            </button>
          ))}
        </div>
        {isNonRoundAmount && (
          <p className="mt-2 text-xs text-yellow-500/90">
            Withdrawing a non-round amount can link your deposit and withdrawal.
            Use a round denomination to preserve anonymity, and withdraw the
            remainder separately.
          </p>
        )}
      </div>

      {/* Meta-relay fee breakdown */}
      {useMetaRelay && parsedAmount > 0n && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Withdrawal amount</span>
            <span className="text-[#acf901]">{parsedAmount.toString()} {tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Relay fee (0.1%)</span>
            <span className="text-[#acf901]">-{relayFee.toString()} {tokenSymbol}</span>
          </div>
          <div className="border-t border-[#2a2a2a] pt-1 flex justify-between text-sm font-medium">
            <span className="text-[#888888]">Recipient receives</span>
            <span className="text-[#acf901]">
              {parsedAmount > relayFee ? (parsedAmount - relayFee).toString() : "0"} {tokenSymbol}
            </span>
          </div>
        </div>
      )}

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
          : useMetaRelay
          ? "Withdraw (Gasless)"
          : "Withdraw via Relay"}
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
