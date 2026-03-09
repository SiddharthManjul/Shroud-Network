/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Interface, parseUnits } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import { useToken } from "@/providers/token-provider";
import { TEST_TOKEN_ABI } from "@/lib/zktoken/abi/test-token";

const inputClass =
  "w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors duration-200";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

export function FaucetForm() {
  const { address, signer } = useWallet();
  const { activeToken } = useToken();

  const TOKEN_ADDRESS = activeToken?.token ?? "";
  const tokenSymbol = activeToken?.symbol ?? "Token";
  const tokenDecimals = activeToken?.decimals ?? 18;
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
        ? iface.encodeFunctionData("faucet(uint256)", [parseUnits(amount, tokenDecimals)])
        : iface.encodeFunctionData("faucet()");

      const tx = await signer.sendTransaction({ to: TOKEN_ADDRESS, data });
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
            symbol: tokenSymbol,
            decimals: tokenDecimals,
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
          <label className="block text-sm font-medium text-[#888888] mb-1">
            Amount ({tokenSymbol})
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1,000 (default)"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={!address || pending}
          className={btnPrimary}
        >
          {!address ? "Connect wallet first" : pending ? "Claiming..." : "Claim Tokens"}
        </button>
        {status && (
          <p className="text-sm text-[#888888] break-all">{status}</p>
        )}
      </form>

      <hr className="border-[#2a2a2a]" />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#acf901]">Add {tokenSymbol} to Wallet</h2>
        <button type="button" onClick={addToWallet} className={btnSecondary}>
          Add to MetaMask
        </button>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#888888]">Token Address</span>
            <span className="text-[#acf901] font-mono break-all text-right ml-4">
              {TOKEN_ADDRESS || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Symbol</span>
            <span className="text-[#acf901]">{tokenSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Decimals</span>
            <span className="text-[#acf901]">{tokenDecimals}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
