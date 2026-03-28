"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
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

const UNIFIED_POOL_ADDRESS = process.env.NEXT_PUBLIC_UNIFIED_SHIELDED_POOL_ADDRESS ?? "";

/** Wallet token info discovered by scanning ERC20 balances. */
interface WalletToken {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  formatted: string;
}

export function DepositForm() {
  const { ready } = useZkToken();
  const { address, signer, provider, connect: connectWallet, connecting: walletConnecting, disconnect: disconnectWallet } = useWallet();
  const { notes, saveNote } = useNotes();
  const { keypair, deriveKey } = useShieldedKey();
  const { tokens, activeToken } = useToken();

  const isUnified = activeToken?.poolType === "unified";

  // ── V1 pool values (used when !isUnified) ──────────────────────────
  const v1PoolAddress = activeToken?.pool ?? "";
  const v1TokenAddress = activeToken?.token ?? "";
  const v1Symbol = activeToken?.symbol ?? "Token";

  // ── Wallet token discovery (unified pool only) ─────────────────────
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const discoverWalletTokens = useCallback(async () => {
    if (!address || !isUnified) { setWalletTokens([]); return; }
    setLoadingTokens(true);

    const rpcProvider = provider ?? new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const { TEST_TOKEN_ABI } = await import("@/lib/zktoken/abi/test-token");

    // Gather all unique ERC20 addresses: registry tokens + unified pool on-chain list
    const seen = new Set<string>();
    const addresses: string[] = [];
    const addAddr = (addr: string) => {
      const key = addr.toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); addresses.push(addr); }
    };
    for (const t of tokens) addAddr(t.token);

    // Also query the unified pool for any on-chain registered tokens
    if (UNIFIED_POOL_ADDRESS) {
      try {
        const { UNIFIED_SHIELDED_POOL_ABI } = await import("@/lib/zktoken/abi/unified-shielded-pool");
        const pool = new Contract(UNIFIED_POOL_ADDRESS, UNIFIED_SHIELDED_POOL_ABI as never, rpcProvider);
        const count = Number(await pool.getAllowedTokenCount());
        for (let i = 0; i < count; i++) {
          const addr: string = await pool.getAllowedToken(i);
          addAddr(addr);
        }
      } catch { /* ignore */ }
    }

    const results: WalletToken[] = [];
    await Promise.all(
      addresses.map(async (tokenAddr) => {
        try {
          const erc20 = new Contract(tokenAddr, TEST_TOKEN_ABI, rpcProvider as never);
          const [rawBalance, decimals, symbol] = await Promise.all([
            erc20.balanceOf(address) as Promise<bigint>,
            erc20.decimals().then(Number),
            erc20.symbol() as Promise<string>,
          ]);
          if (rawBalance > 0n) {
            results.push({ address: tokenAddr, symbol, decimals, balance: rawBalance, formatted: formatUnits(rawBalance, decimals) });
          }
        } catch { /* skip */ }
      })
    );

    // Deduplicate by address (case-insensitive)
    const unique = new Map<string, WalletToken>();
    for (const r of results) {
      unique.set(r.address.toLowerCase(), r);
    }
    const deduped = [...unique.values()];
    deduped.sort((a, b) => a.symbol.localeCompare(b.symbol));
    setWalletTokens(deduped);
    setLoadingTokens(false);
  }, [address, provider, tokens, isUnified]);

  useEffect(() => { discoverWalletTokens(); }, [discoverWalletTokens]);

  // ── Selected token for unified pool (local state) ──────────────────
  const [selectedAddr, setSelectedAddr] = useState<string>("");

  useEffect(() => {
    if (walletTokens.length > 0 && !walletTokens.find((t) => t.address.toLowerCase() === selectedAddr.toLowerCase())) {
      setSelectedAddr(walletTokens[0].address.toLowerCase());
    }
  }, [walletTokens, selectedAddr]);

  const selectedWalletToken = walletTokens.find(
    (t) => t.address.toLowerCase() === selectedAddr.toLowerCase()
  );

  // ── Effective token symbol (unified = wallet selection, V1 = fixed) ─
  const tokenSymbol = isUnified ? (selectedWalletToken?.symbol ?? "Token") : v1Symbol;

  // ── Amount state ───────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [useNativeAvax, setUseNativeAvax] = useState(false);

  const ROUND_AMOUNTS = ["100", "500", "1000", "5000", "10000"];

  const isNonRoundAmount =
    amount.trim() !== "" &&
    /^\d+$/.test(amount.trim()) &&
    !ROUND_AMOUNTS.includes(amount.trim());

  const pendingNotes = notes.filter((n) => n.leafIndex < 0);

  // Detect WAVAX for V1 pools
  const isWavaxPool = useMemo(() => {
    if (isUnified || !v1TokenAddress) return false;
    const wavax = getWavaxAddress();
    return v1TokenAddress.toLowerCase() === wavax.toLowerCase();
  }, [isUnified, v1TokenAddress]);

  // ── Deposit handler ────────────────────────────────────────────────
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

      if (isUnified) {
        // ── Unified pool path ──────────────────────────────────────────
        if (!selectedWalletToken) { setStatus("Error: select a token"); return; }
        if (!UNIFIED_POOL_ADDRESS) { setStatus("Error: unified pool not configured"); return; }

        const { depositUnified, waitForUnifiedDeposit } = await import("@/lib/zktoken/transaction");

        setStatus("Approve the token transfer in your wallet...");
        const result = await depositUnified({
          signer: signer as never,
          poolAddress: UNIFIED_POOL_ADDRESS,
          tokenAddress: selectedWalletToken.address,
          amount: BigInt(trimmed),
          ownerPublicKey: kp.publicKey,
        });

        setStatus(`Deposit submitted: ${result.tx.hash}. Waiting for confirmation...`);
        const finalizedNote = await waitForUnifiedDeposit(
          result.tx, result.pendingNote, provider! as never, UNIFIED_POOL_ADDRESS
        );
        saveNote(finalizedNote);

        setStatus(`Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer.`);
        setAmount("");
        await discoverWalletTokens();
      } else {
        // ── V1 pool path ───────────────────────────────────────────────
        // Wrap native AVAX if needed
        if (isWavaxPool && useNativeAvax) {
          setStatus("Wrapping native AVAX to WAVAX...");
          const wavaxContract = new Contract(v1TokenAddress, WAVAX_ABI, signer);
          const amountScale = activeToken?.decimals ?? 18;
          const wrapValue = BigInt(trimmed) * (10n ** BigInt(amountScale));
          const wrapTx = await wavaxContract.deposit({ value: wrapValue });
          await wrapTx.wait();
          setStatus("AVAX wrapped. Now depositing into shielded pool...");
        }

        const { deposit, waitForDeposit } = await import("@/lib/zktoken/transaction");

        setStatus("Approve the token transfer in your wallet...");
        const result = await deposit({
          signer: signer as never,
          poolAddress: v1PoolAddress,
          tokenAddress: v1TokenAddress,
          amount: BigInt(trimmed),
          ownerPublicKey: kp.publicKey,
        });

        setStatus(`Deposit submitted: ${result.tx.hash}. Waiting for confirmation...`);
        const finalizedNote = await waitForDeposit(
          result.tx, result.pendingNote, provider! as never, v1PoolAddress
        );
        saveNote(finalizedNote);

        setStatus(`Deposit confirmed! Leaf #${finalizedNote.leafIndex} — ready to transfer.`);
        setAmount("");
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Recovery ───────────────────────────────────────────────────────
  const handleRecoverNotes = async () => {
    if (!provider || pendingNotes.length === 0) return;
    setRecovering(true);
    const poolAddr = isUnified ? UNIFIED_POOL_ADDRESS : v1PoolAddress;
    setStatus(`Syncing Merkle tree to recover ${pendingNotes.length} unfinalized note(s)...`);

    try {
      const { MerkleTreeSync } = await import("@/lib/zktoken/merkle");
      const { finaliseNote } = await import("@/lib/zktoken/note");

      const depth = isUnified ? 24 : 20;
      const tree = new MerkleTreeSync(depth);
      if (isUnified) {
        const { UNIFIED_SHIELDED_POOL_ABI } = await import("@/lib/zktoken/abi/unified-shielded-pool");
        await tree.syncFromChain(provider as never, poolAddr, undefined, UNIFIED_SHIELDED_POOL_ABI as never);
      } else {
        await tree.syncFromChain(provider as never, poolAddr);
      }

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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleDeposit} className="space-y-4">
      {/* Wallet connection */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
        {address ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#888888]">Connected Wallet</p>
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
              Connect your wallet to deposit tokens into the shielded pool.
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

      {/* Token selector — only for unified pool (wallet token scan) */}
      {isUnified && address && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Token
          </label>
          {loadingTokens ? (
            <p className="text-sm text-[#444444]">Scanning wallet...</p>
          ) : walletTokens.length === 0 ? (
            <p className="text-sm text-[#444444]">No tokens found in wallet. Use the faucet to get test tokens.</p>
          ) : (
            <CustomSelect
              value={selectedAddr}
              options={(() => {
                // Detect duplicate symbols to disambiguate with address snippet
                const symbolCount = new Map<string, number>();
                for (const t of walletTokens) {
                  symbolCount.set(t.symbol, (symbolCount.get(t.symbol) ?? 0) + 1);
                }
                return walletTokens.map((t) => {
                  const hasDup = (symbolCount.get(t.symbol) ?? 0) > 1;
                  const addrTag = hasDup ? ` (${t.address.slice(0, 6)}…${t.address.slice(-4)})` : "";
                  return {
                    value: t.address.toLowerCase(),
                    label: `${t.symbol}${addrTag} — ${Number(t.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
                  };
                });
              })()}
              onChange={(val) => setSelectedAddr(val)}
              placeholder="Select token..."
            />
          )}
        </div>
      )}

      {/* V1 pool: fixed token display */}
      {!isUnified && address && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3">
          <p className="text-xs text-[#888888]">Depositing into</p>
          <p className="text-sm text-[#acf901] font-medium">{v1Symbol} Pool</p>
        </div>
      )}

      {/* AVAX / WAVAX toggle — V1 WAVAX pools only */}
      {!isUnified && isWavaxPool && (
        <div>
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Deposit From
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setUseNativeAvax(true)} className={toggleBtn(useNativeAvax)}>
              Native AVAX
            </button>
            <button type="button" onClick={() => setUseNativeAvax(false)} className={toggleBtn(!useNativeAvax)}>
              WAVAX (ERC20)
            </button>
          </div>
          {useNativeAvax && (
            <p className="mt-1 text-xs text-[#666666]">
              Your native AVAX will be automatically wrapped to WAVAX, then deposited.
            </p>
          )}
        </div>
      )}

      {/* Amount input */}
      <div>
        <label className="block text-sm font-medium text-[#888888] mb-1">
          Amount ({!isUnified && isWavaxPool && useNativeAvax ? "AVAX" : tokenSymbol})
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
            Non-round amounts reduce privacy. Use a round denomination for stronger anonymity.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready || !address || !keypair || (isUnified && !selectedWalletToken)}
        className={btnPrimary}
      >
        {!address
          ? "Connect wallet first"
          : !ready
          ? "Initializing..."
          : isUnified && !selectedWalletToken
          ? "Select a token"
          : isUnified
          ? `Deposit ${tokenSymbol}`
          : isWavaxPool && useNativeAvax
          ? "Wrap AVAX & Deposit"
          : `Deposit ${v1Symbol}`}
      </button>

      {/* Recovery button */}
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
