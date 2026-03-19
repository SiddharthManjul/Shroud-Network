"use client";

import { motion } from "framer-motion";

const sdkMethods = [
  {
    method: "createWallet()",
    description: "Generate or restore a Baby Jubjub keypair for shielded operations",
    returns: "ShroudWallet",
  },
  {
    method: "deposit({ token, amount, signer })",
    description: "Lock ERC20 tokens into the shielded pool and receive a private commitment",
    returns: "TransactionResult",
  },
  {
    method: "transfer({ to, amount })",
    description: "Move value privately inside the pool — amounts, sender, and recipient are hidden",
    returns: "TransactionResult",
  },
  {
    method: "withdraw({ amount, recipient })",
    description: "Exit the shielded pool and receive ERC20 tokens at any address",
    returns: "TransactionResult",
  },
  {
    method: "getBalance(wallet)",
    description: "Sum unspent notes for a token to get the total shielded balance",
    returns: "ShieldedBalance",
  },
  {
    method: "sync(wallet)",
    description: "Scan chain events and trial-decrypt memos to discover incoming notes",
    returns: "void",
  },
];

export function SDKSection() {
  return (
    <div className="container mx-auto px-6">
      <div className="flex flex-col lg:flex-row gap-16 items-start">
        {/* Left — text */}
        <div className="flex-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-3 py-1">
              SDK
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-[#acf901]"
          >
            @shroud/sdk
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg text-[#888888] leading-relaxed max-w-xl"
          >
            A standalone TypeScript package for browser and Node.js. Wraps all
            ZK cryptography, proof generation, Merkle tree management, and
            encrypted memo handling into a clean, developer-friendly facade.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="flex flex-wrap gap-3"
          >
            {[
              "TypeScript",
              "Browser + Node.js",
              "Groth16 WASM",
              "ethers.js v6",
              "Zero Dependencies*",
            ].map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium text-[#acf901]/70 border border-[#acf901]/20 rounded-full px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right — method list */}
        <div className="flex-1 w-full">
          <div className="space-y-2">
            {sdkMethods.map((item, i) => (
              <motion.div
                key={item.method}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className="group rounded border border-[#2a2a2a] bg-[#0d0d0d] px-5 py-3.5 hover:border-[#acf901]/30 transition-colors duration-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <code className="text-sm font-mono text-[#acf901]">
                    {item.method}
                  </code>
                  <span className="text-xs font-mono text-[#444444] shrink-0">
                    → {item.returns}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#666666] leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
