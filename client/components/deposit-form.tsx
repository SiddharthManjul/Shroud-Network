/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useMemo } from "react";
import { Contract, parseEther } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { getWavaxAddress, WAVAX_ABI } from "@/lib/zktoken/abi/wavax";

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnWarning =
  "w-full rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-[#acf901] hover:bg-[#acf901]/10 border border-[#acf901]/40 hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const toggleBtn = (active: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
    active
      ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/40"
      : "bg-[#0d0d0d] text-[#888888] border border-[#2a2a2a] hover:text-[#acf901] hover:border-[#acf901]/30"
  }`;

const META_TX_RELAYER_ADDRESS = process.env.NEXT_PUBLIC_META_TX_RELAYER_ADDRESS;

// Fee: 0.1% of deposit, minimum 1 token unit
function computeFee(amount: bigint): bigint {
  const fee = amount / 1000n;
  return fee < 1n ? 1n : fee;
}

export function DepositForm() {
  const { ready } = useZkToken();
  const { address, signer, provider } = useWallet();
  const { notes, saveNote } = useNotes();
  const { keypair, deriveKey } = useShieldedKey();
  const { activeToken } = useToken();

  const POOL_ADDRESS = activeToken?.pool ?? "";
  const TOKEN_ADDRESS = activeToken?.token ?? "";
  const tokenSymbol = activeToken?.symbol ?? "Token";
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [useRelay, setUseRelay] = useState(false);

  const ROUND_AMOUNTS = ["100", "500", "1000", "5000", "10000"];

  const isNonRoundAmount =
    amount.trim() !== "" &&
    /^\d+$/.test(amount.trim()) &&
    !ROUND_AMOUNTS.includes(amount.trim());
  const [recovering, setRecovering] = useState(false);
  const [useNativeAvax, setUseNativeAvax] = useState(false);

  // Relay mode is available when MetaTxRelayer is configured
  const relayAvailable = !!META_TX_RELAYER_ADDRESS;

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

  // Detect if the active token is WAVAX
  const isWavaxPool = useMemo(() => {
    if (!TOKEN_ADDRESS) return false;
    const wavax = getWavaxAddress();
    return TOKEN_ADDRESS.toLowerCase() === wavax.toLowerCase();
  }, [TOKEN_ADDRESS]);

  // Count notes that are stuck pending finalization
  const pendingNotes = notes.filter((n) => n.leafIndex < 0);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !signer || !address) return;

    const trimmed = amount.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      setStatus("Error: amount must be a whole number (no decimals)");
      return;
    }

    setStatus("Preparing deposit...");
    try {
      let kp = keypair;
      if (!kp) {
        setStatus("Sign the message in your wallet to derive your shielded key...");
        kp = await deriveKey();
        if (!kp) throw new Error("Failed to derive shielded key");
      }

      // ── Relay deposit path ──────────────────────────────────────────────
      if (useRelay && META_TX_RELAYER_ADDRESS) {
        setStatus("Preparing relayed deposit...");

        const { relayDeposit, waitForRelayDeposit } = await import("@/lib/zktoken/transaction");
        const fee = computeFee(BigInt(trimmed));

        setStatus("Sign the EIP-712 message in your wallet to authorize the deposit...");
        const result = await relayDeposit({
          signer: signer as never,
          provider: provider! as never,
          poolAddress: POOL_ADDRESS,
          tokenAddress: TOKEN_ADDRESS,
          amount: BigInt(trimmed),
          ownerPublicKey: kp.publicKey,
          fee,
          metaTxRelayerAddress: META_TX_RELAYER_ADDRESS,
        });

        setStatus(`Deposit submitted via relay: ${result.relay.txHash}. Finalizing note...`);

        const finalizedNote = await waitForRelayDeposit(
          result.relay,
          result.pendingNote,
          provider! as never,
          POOL_ADDRESS
        );
        saveNote(finalizedNote);

        setStatus(`Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer. (Fee: ${fee} ${tokenSymbol})`);
        setAmount("");
        return;
      }

      // ── Direct deposit path (existing flow) ─────────────────────────────
      // If depositing native AVAX into a WAVAX pool, wrap first
      if (isWavaxPool && useNativeAvax) {
        setStatus("Wrapping native AVAX to WAVAX...");
        const wavaxContract = new Contract(TOKEN_ADDRESS, WAVAX_ABI, signer);
        const amountScale = activeToken?.decimals ?? 18;
        const wrapValue = BigInt(trimmed) * (10n ** BigInt(amountScale));
        const wrapTx = await wavaxContract.deposit({ value: wrapValue });
        await wrapTx.wait();
        setStatus("AVAX wrapped to WAVAX. Now depositing into shielded pool...");
      }

      const { deposit, waitForDeposit } = await import("@/lib/zktoken/transaction");

      setStatus("Approve the token transfer in your wallet...");
      const result = await deposit({
        signer: signer as never,
        poolAddress: POOL_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        amount: BigInt(trimmed),
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

      setStatus(`Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer.`);
      setAmount("");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Recovery: sync the full Merkle tree and find leaf indices for stuck notes.
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
        }
      }

      setStatus(
        recovered > 0
          ? `Recovered ${recovered} note(s)! They are now ready to use.`
          : `No matching commitments found in ${tree.size} on-chain leaves.`
      );
    } catch (err) {
      setStatus(`Recovery error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRecovering(false);
    }
  };

  return (
    <form onSubmit={handleDeposit} className="space-y-4">
      {/* Relay mode toggle — only shown when MetaTxRelayer is configured */}
      {relayAvailable && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Gas Payment
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseRelay(false)}
              className={toggleBtn(!useRelay)}
            >
              Pay Gas (AVAX)
            </button>
            <button
              type="button"
              onClick={() => setUseRelay(true)}
              className={toggleBtn(useRelay)}
            >
              Gasless (Token Fee)
            </button>
          </div>
          {useRelay && (
            <p className="mt-1 text-xs text-[#666666]">
              A small fee in {tokenSymbol} covers gas. You need zero AVAX.
              One-time token approval may be required.
            </p>
          )}
        </div>
      )}

      {/* AVAX / WAVAX toggle — only shown when active pool is WAVAX and not using relay */}
      {isWavaxPool && !useRelay && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Deposit From
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseNativeAvax(true)}
              className={toggleBtn(useNativeAvax)}
            >
              Native AVAX
            </button>
            <button
              type="button"
              onClick={() => setUseNativeAvax(false)}
              className={toggleBtn(!useNativeAvax)}
            >
              WAVAX (ERC20)
            </button>
          </div>
          {useNativeAvax && (
            <p className="mt-1 text-xs text-[#666666]">
              Your native AVAX will be automatically wrapped to WAVAX, then deposited into the shielded pool.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount ({isWavaxPool && useNativeAvax && !useRelay ? "AVAX" : tokenSymbol})
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className={inputClass}
        />
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {ROUND_AMOUNTS.map((v) => (
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
            Non-round amounts reduce privacy. If someone deposits 7,342 and
            later 7,342 is withdrawn, observers can link them. Use a round
            denomination for stronger anonymity.
          </p>
        )}
      </div>

      {/* Relay fee breakdown */}
      {useRelay && parsedAmount > 0n && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Deposit amount</span>
            <span className="text-[#acf901]">{parsedAmount.toString()} {tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Relay fee (0.1%)</span>
            <span className="text-[#acf901]">{relayFee.toString()} {tokenSymbol}</span>
          </div>
          <div className="border-t border-[#2a2a2a] pt-1 flex justify-between text-sm font-medium">
            <span className="text-[#888888]">Total deducted</span>
            <span className="text-[#acf901]">{(parsedAmount + relayFee).toString()} {tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">You receive in pool</span>
            <span className="text-[#acf901]">{parsedAmount.toString()} {tokenSymbol}</span>
          </div>
        </div>
      )}

      <button type="submit" disabled={!ready || !address || !keypair} className={btnPrimary}>
        {!address
          ? "Connect wallet first"
          : !ready
          ? "Initializing..."
          : useRelay
          ? "Deposit via Relay (Gasless)"
          : isWavaxPool && useNativeAvax
          ? "Wrap AVAX & Deposit"
          : "Deposit"}
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
            : `Recover ${pendingNotes.length} unfinalized note${pendingNotes.length > 1 ? "s" : ""}`}
        </button>
      )}

      {status && (
        <p className="text-sm text-[#888888] break-all">{status}</p>
      )}
    </form>
  );
}
