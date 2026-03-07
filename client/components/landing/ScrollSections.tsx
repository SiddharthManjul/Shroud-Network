"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "Mission",
    headline: "Privacy is a Fundamental Right",
    content:
      "We believe on-chain transactions should not expose your financial life to the world. Shroud Network exists to make shielded token transfers as easy as a regular transfer — with all the privacy guarantees of ZK cryptography.",
    visual: (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {[80, 120, 160, 200].map((size, i) => (
            <div
              key={size}
              className="absolute rounded-full border border-[#ff1a1a]/20 animate-ping"
              style={{
                width: size,
                height: size,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2 + i * 0.5}s`,
              }}
            />
          ))}
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-[#ff1a1a]/60 bg-[#ff1a1a]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ff1a1a" strokeWidth="1.5" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Technology",
    headline: "ZK-SNARKs at the Core",
    content:
      "Shroud Network uses Groth16 zero-knowledge proofs to verify transaction validity without revealing any private information. The Merkle tree of commitments grows with every deposit — your note is just one leaf among thousands.",
    visual: (
      <div className="w-full h-full flex items-center justify-center font-mono text-xs">
        <div className="space-y-1 text-[#ff1a1a]/70">
          {[
            "commit(note) → leaf",
            "merkle_root ← tree[0..N]",
            "nullifier = H(sk, leaf)",
            "π := prove(witness, pk)",
            "verify(π, root, pub) → ✓",
          ].map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="rounded border border-[#ff1a1a]/20 bg-[#ff1a1a]/5 px-3 py-1"
            >
              {line}
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Vision",
    headline: "DeFi Without a Paper Trail",
    content:
      "Today's on-chain finance is fully transparent — every trade, every position, every dollar is public. Shroud Network aims to change that. We envision a future where financial privacy is the default, not the exception.",
    visual: (
      <div className="w-full h-full flex items-center justify-center">
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[
            { label: "Depositors", count: "∞" },
            { label: "Transfers", count: "🔒" },
            { label: "Recipients", count: "∞" },
            { label: "MEV", count: "0" },
            { label: "Traces", count: "0" },
            { label: "Leaks", count: "0" },
          ].map(({ label, count }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center rounded border border-[#ff1a1a]/20 bg-[#ff1a1a]/5 p-3"
            >
              <span className="text-xl font-bold text-[#ff1a1a]">{count}</span>
              <span className="text-xs text-[#888888] mt-1">{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export const ScrollSections = () => {
  return (
    <div className="relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-24 py-24">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
              className={cn(
                "flex flex-col md:flex-row items-center gap-12",
                index % 2 === 1 && "md:flex-row-reverse"
              )}
            >
              {/* Text */}
              <div className="flex-1 space-y-6 text-center md:text-left">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#ff1a1a]/60 border border-[#ff1a1a]/20 rounded-full px-3 py-1">
                  {section.title}
                </span>
                <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-[#ff1a1a] to-[#ff6b6b]">
                  {section.headline}
                </h2>
                <p className="text-xl text-[#888888] leading-relaxed max-w-2xl">
                  {section.content}
                </p>
              </div>

              {/* Visual */}
              <div className="flex-1 w-full">
                <div
                  className="aspect-video overflow-hidden border border-[#ff1a1a]/20 bg-[#0d0d0d] relative"
                  style={{
                    clipPath:
                      "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))",
                  }}
                >
                  {section.visual}
                  <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
