"use client";

import { useState } from "react";
import { useZkToken } from "@/hooks/use-zktoken";
import { useWallet } from "@/hooks/use-wallet";
import { useNotes } from "@/hooks/use-notes";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { TokenBalances } from "@/components/token-balances";
import Link from "next/link";

export default function DashboardPage() {
  const { ready, error } = useZkToken();
  const { address, chainId, networkName, wrongNetwork, switchToExpectedNetwork } = useWallet();
  const { unspent, loading, refreshNotes } = useNotes();
  const { keypair } = useShieldedKey();
  const { activeToken } = useToken();
  const tokenSymbol = activeToken?.symbol ?? "Token";
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#acf901] tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[#888888]">
          Shroud Network shielded pool — private token transfers on Avalanche
        </p>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
          <p className="text-sm text-[#888888]">WASM Status</p>
          <p className="mt-1 text-lg font-medium">
            {error ? (
              <span className="text-[#acf901]">Error</span>
            ) : ready ? (
              <span className="text-[#acf901]">Ready</span>
            ) : (
              <span className="text-yellow-500">Loading...</span>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
          <p className="text-sm text-[#888888]">Wallet</p>
          <p className="mt-1 text-lg font-medium font-mono truncate">
            {address ? (
              <span className="text-[#acf901]">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            ) : (
              <span className="text-[#444444]">Not connected</span>
            )}
          </p>
          {chainId && (
            <p className="mt-0.5 text-xs text-[#666666]">
              {networkName ?? `Chain ${chainId}`}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
          <p className="text-sm text-[#888888]">Shielded Notes</p>
          <p className="mt-1 text-lg font-medium text-[#acf901]">
            {unspent.length} unspent
          </p>
          <p className="mt-0.5 text-sm font-mono text-[#888888]">
            {unspent.reduce((s, n) => s + n.amount, 0n).toString()} zk{tokenSymbol}
          </p>
        </div>
      </div>

      {/* Wrong network warning */}
      {wrongNetwork && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center justify-between">
          <p className="text-sm text-yellow-400">
            Wrong network — please switch to{" "}
            {process.env.NEXT_PUBLIC_CHAIN_ID === "43114"
              ? "Avalanche C-Chain"
              : "Avalanche Fuji"}
            .
          </p>
          <button
            onClick={switchToExpectedNetwork}
            className="rounded-lg bg-[#b0b0b0] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#acf901] hover:text-black transition-colors duration-200 border border-[#b0b0b0] hover:border-[#acf901]"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Token balances */}
      <TokenBalances />

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-[#acf901] mb-3">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { href: "/deposit", label: "Deposit", desc: "Lock ERC20 tokens into the shielded pool" },
            { href: "/transfer", label: "Transfer", desc: "Send tokens privately within the pool" },
            { href: "/withdraw", label: "Withdraw", desc: "Exit tokens from the pool to any address" },
            { href: "/pools", label: "Pools", desc: "Create a shielded pool for any ERC20 token" },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4 hover:border-[#acf901]/50 hover:bg-[#acf901]/5 transition-all duration-200"
            >
              <p className="font-semibold text-[#acf901]">{label}</p>
              <p className="mt-1 text-sm text-[#888888]">{desc}</p>
            </Link>
          ))}
          <button
            onClick={async () => {
              setScanStatus("Scanning...");
              await refreshNotes();
              setScanStatus("Scan complete.");
              setTimeout(() => setScanStatus(null), 3000);
            }}
            disabled={loading || !address || !keypair}
            className="group rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4 hover:border-[#acf901]/50 hover:bg-[#acf901]/5 transition-all duration-200 text-left disabled:opacity-40"
          >
            <p className="font-semibold text-[#acf901]">
              {loading ? "Scanning..." : "Scan"}
            </p>
            <p className="mt-1 text-sm text-[#888888]">Scan for incoming shielded notes</p>
          </button>
        </div>
        {scanStatus && !loading && (
          <p className="mt-2 text-sm text-[#888888]">{scanStatus}</p>
        )}
      </div>
    </div>
  );
}
