/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Contract, parseEther, JsonRpcProvider, formatUnits } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import { useZkToken } from "@/hooks/use-zktoken";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { getWavaxAddress, WAVAX_ABI } from "@/lib/zktoken/abi/wavax";
import { CustomSelect } from "./custom-select";

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
  const { address, signer, provider, connect: connectWallet, connecting: walletConnecting, disconnect: disconnectWallet } = useWallet();
  const { notes, saveNote } = useNotes();
  const { keypair, deriveKey } = useShieldedKey();
  const { tokens, activeToken, setActiveToken } = useToken();

  // ── Pool / token selection (local — token switches within a pool don't affect navbar) ──
  // Distinct pools derived from the tokens list
  const distinctPools = useMemo(() => {
    const seen = new Map<string, { pool: string; poolType: string; label: string }>();
    for (const t of tokens) {
      const key = t.pool.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, {
          pool: t.pool,
          poolType: t.poolType ?? "v1",
          label: t.poolType === "unified" ? "Unified Pool" : t.symbol,
        });
      }
    }
    return [...seen.values()];
  }, [tokens]);

  // Selected pool address (local state)
  const [selectedPoolAddr, setSelectedPoolAddr] = useState<string>(
    () => activeToken?.pool.toLowerCase() ?? ""
  );

  // Tokens available in the selected pool
  const poolTokens = useMemo(
    () => tokens.filter((t) => t.pool.toLowerCase() === selectedPoolAddr),
    [tokens, selectedPoolAddr]
  );

  // Selected token within the pool (local state — doesn't touch global activeToken)
  const [selectedToken, setSelectedToken] = useState(() => activeToken);

  // Keep local selection in sync when the global pool changes (e.g. via navbar)
  useEffect(() => {
    if (!activeToken) return;
    const poolAddr = activeToken.pool.toLowerCase();
    setSelectedPoolAddr(poolAddr);
    setSelectedToken(activeToken);
  }, [activeToken?.pool]);

  // When pool changes, update global activeToken (so notes are saved under the right key)
  // and default the token to the first one in that pool.
  const handlePoolChange = useCallback((poolAddr: string) => {
    setSelectedPoolAddr(poolAddr);
    const first = tokens.find((t) => t.pool.toLowerCase() === poolAddr);
    if (first) {
      setSelectedToken(first);
      setActiveToken(first);
    }
  }, [tokens, setActiveToken]);

  const POOL_ADDRESS = selectedToken?.pool ?? "";
  const TOKEN_ADDRESS = selectedToken?.token ?? "";
  const tokenSymbol = selectedToken?.symbol ?? "Token";
  const [amount, setAmount] = useState("");

  // Wallet balances keyed by token address (lowercase)
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>({});

  const fetchWalletBalances = useCallback(async () => {
    if (!address) return;
    const rpcProvider = provider ?? new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    // Deduplicate token addresses
    const uniqueTokens = [...new Map(tokens.map((t) => [t.token.toLowerCase(), t])).values()];
    const { TEST_TOKEN_ABI } = await import("@/lib/zktoken/abi/test-token");
    const results: Record<string, string> = {};
    await Promise.all(
      uniqueTokens.map(async (t) => {
        try {
          const erc20 = new Contract(t.token, TEST_TOKEN_ABI, rpcProvider as never);
          const [balance, decimals] = await Promise.all([
            erc20.balanceOf(address),
            erc20.decimals(),
          ]);
          results[t.token.toLowerCase()] = formatUnits(balance as bigint, Number(decimals));
        } catch {
          // ignore
        }
      })
    );
    setWalletBalances(results);
  }, [address, provider, tokens]);

  useEffect(() => {
    fetchWalletBalances();
  }, [fetchWalletBalances]);
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

        setStatus("Checking token approval for relayer (one-time approval may require a small AVAX gas fee)...");
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

      // ── Unified pool deposit path ────────────────────────────────────────
      if (selectedToken?.poolType === "unified") {
        setStatus("Depositing into unified shielded pool...");
        const { depositUnified, waitForUnifiedDeposit } = await import("@/lib/zktoken/transaction");

        setStatus("Approve the token transfer in your wallet...");
        const result = await depositUnified({
          signer: signer as never,
          poolAddress: POOL_ADDRESS,
          tokenAddress: TOKEN_ADDRESS,
          amount: BigInt(trimmed),
          ownerPublicKey: kp.publicKey,
        });

        setStatus(`Deposit submitted: ${result.tx.hash}. Waiting for confirmation...`);

        const finalizedNote = await waitForUnifiedDeposit(
          result.tx,
          result.pendingNote,
          provider! as never,
          POOL_ADDRESS
        );
        saveNote(finalizedNote);

        setStatus(`Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer.`);
        setAmount("");
        return;
      }

      // ── Direct deposit path (existing flow) ─────────────────────────────
      // If depositing native AVAX into a WAVAX pool, wrap first
      if (isWavaxPool && useNativeAvax) {
        setStatus("Wrapping native AVAX to WAVAX...");
        const wavaxContract = new Contract(TOKEN_ADDRESS, WAVAX_ABI, signer);
        const amountScale = selectedToken?.decimals ?? 18;
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
      {/* Wallet status — deposits require an external wallet for ERC20 transfers */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
        {address ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#888888]">External Wallet (for deposits)</p>
              <p className="text-sm font-mono text-[#acf901]">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
            <button
              type="button"
              onClick={disconnectWallet}
              className="rounded-lg border border-[#acf901]/30 px-3 py-1.5 text-sm text-[#acf901]/80 hover:bg-[#acf901]/10 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#888888]">
              Connect an external wallet (MetaMask) to transfer ERC20 tokens into the shielded pool.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={walletConnecting}
              className="rounded-lg bg-[#b0b0b0] px-4 py-2 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200"
            >
              {walletConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        )}
      </div>

      {/* Pool selector */}
      {distinctPools.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Pool
          </label>
          <CustomSelect
            value={selectedPoolAddr}
            options={distinctPools.map((p) => ({
              value: p.pool.toLowerCase(),
              label: p.label,
            }))}
            onChange={handlePoolChange}
            placeholder="Select pool..."
          />
        </div>
      )}

      {/* Token selector — shown when the selected pool supports multiple tokens */}
      {poolTokens.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Token
          </label>
          <CustomSelect
            value={selectedToken?.token.toLowerCase() ?? ""}
            options={poolTokens.map((t) => {
              const bal = walletBalances[t.token.toLowerCase()];
              const balStr = bal !== undefined
                ? ` — ${Number(bal).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                : "";
              return { value: t.token.toLowerCase(), label: `${t.symbol}${balStr}` };
            })}
            onChange={(val) => {
              const t = poolTokens.find((t) => t.token.toLowerCase() === val);
              if (t) setSelectedToken(t);
              // Intentionally not calling setActiveToken — pool stays fixed in navbar
            }}
            placeholder="Select token..."
          />
        </div>
      )}

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
