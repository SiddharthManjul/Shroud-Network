"use client";

import { useZkToken } from "@/hooks/use-zktoken";
import { useWallet } from "@/hooks/use-wallet";
import { useNotes } from "@/hooks/use-notes";
import Link from "next/link";

export default function DashboardPage() {
  const { ready, error } = useZkToken();
  const { address, chainId } = useWallet();
  const { unspent } = useNotes();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-zinc-400">
          ZkToken shielded pool — private token transfers on Avalanche
        </p>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">WASM Status</p>
          <p className="mt-1 text-lg font-medium">
            {error ? (
              <span className="text-red-400">Error</span>
            ) : ready ? (
              <span className="text-green-400">Ready</span>
            ) : (
              <span className="text-yellow-400">Loading...</span>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Wallet</p>
          <p className="mt-1 text-lg font-medium font-mono truncate">
            {address ? (
              <span className="text-white">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            ) : (
              <span className="text-zinc-600">Not connected</span>
            )}
          </p>
          {chainId && (
            <p className="mt-0.5 text-xs text-zinc-600">
              Chain ID: {chainId.toString()}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Shielded Notes</p>
          <p className="mt-1 text-lg font-medium text-white">
            {unspent.length} unspent
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/deposit"
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-500/50 transition-colors"
          >
            <p className="font-medium text-white">Deposit</p>
            <p className="mt-1 text-sm text-zinc-500">
              Lock ERC20 tokens into the shielded pool
            </p>
          </Link>
          <Link
            href="/transfer"
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-500/50 transition-colors"
          >
            <p className="font-medium text-white">Transfer</p>
            <p className="mt-1 text-sm text-zinc-500">
              Send tokens privately within the pool
            </p>
          </Link>
          <Link
            href="/withdraw"
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-500/50 transition-colors"
          >
            <p className="font-medium text-white">Withdraw</p>
            <p className="mt-1 text-sm text-zinc-500">
              Exit tokens from the pool to any address
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
