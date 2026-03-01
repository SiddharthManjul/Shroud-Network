"use client";

import { useState } from "react";
import { Interface, parseUnits } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import { TEST_TOKEN_ABI } from "@/lib/zktoken/abi/test-token";

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";

export function FaucetForm() {
  const { address, signer } = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !address) return;

    setPending(true);
    setStatus("Sending transaction...");
    try {
      const iface = new Interface(TEST_TOKEN_ABI);
      const data = amount.trim()
        ? iface.encodeFunctionData("faucet(uint256)", [parseUnits(amount, 18)])
        : iface.encodeFunctionData("faucet()");

      const tx = await signer.sendTransaction({
        to: TOKEN_ADDRESS,
        data,
      });
      setStatus(`Tx submitted: ${tx.hash}`);
      await tx.wait();
      setStatus(`Confirmed: ${tx.hash}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(false);
    }
  };

  const addToWallet = async () => {
    try {
      await (window as any).ethereum?.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: TOKEN_ADDRESS,
            symbol: "SRD",
            decimals: 18,
          },
        },
      });
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleClaim} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Amount (SRD)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1,000 (default)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!address || pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {!address ? "Connect wallet first" : pending ? "Claiming..." : "Claim Tokens"}
        </button>
        {status && (
          <p className="text-sm text-zinc-400 break-all">{status}</p>
        )}
      </form>

      <hr className="border-zinc-800" />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Add SRD to Wallet</h2>
        <button
          type="button"
          onClick={addToWallet}
          className="w-full rounded-lg bg-zinc-800 px-4 py-2.5 font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Add to MetaMask
        </button>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Token Address</span>
            <span className="text-white font-mono break-all text-right ml-4">
              {TOKEN_ADDRESS || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Symbol</span>
            <span className="text-white">SRD</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Decimals</span>
            <span className="text-white">18</span>
          </div>
        </div>
      </div>
    </div>
  );
}
