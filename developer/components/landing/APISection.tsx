"use client";

import { motion } from "framer-motion";

const endpoints = [
  { method: "POST", path: "/v1/relay/transfer", description: "Gasless private transfer" },
  { method: "POST", path: "/v1/relay/withdraw", description: "Gasless withdrawal" },
  { method: "POST", path: "/v1/relay/deposit", description: "Gasless deposit" },
  { method: "POST", path: "/v1/proof/transfer", description: "Server-side proof generation" },
  { method: "GET", path: "/v1/pools", description: "List shielded pools" },
  { method: "GET", path: "/v1/merkle/root", description: "Current Merkle root" },
  { method: "GET", path: "/v1/events/memos", description: "Encrypted memo events" },
  { method: "WS", path: "/v1/ws", description: "Real-time note notifications" },
];

const tiers = [
  { name: "Free", requests: "60/min", relay: "10/hr", proofs: "5/hr", price: "$0" },
  { name: "Starter", requests: "300/min", relay: "100/hr", proofs: "50/hr", price: "$49" },
  { name: "Growth", requests: "1,000/min", relay: "500/hr", proofs: "200/hr", price: "$199" },
  { name: "Enterprise", requests: "Custom", relay: "Custom", proofs: "Custom", price: "Contact" },
];

export function APISection() {
  return (
    <div className="container mx-auto px-6">
      <div className="flex flex-col lg:flex-row gap-16">
        {/* Left — endpoints */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-6"
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-3 py-1">
              API
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-[#acf901] mb-4"
          >
            RESTful API
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg text-[#888888] leading-relaxed max-w-xl mb-8"
          >
            Relay transactions, generate proofs server-side, query pool state,
            and receive real-time notifications — all authenticated with your
            API key.
          </motion.p>

          <div className="space-y-1.5">
            {endpoints.map((ep, i) => (
              <motion.div
                key={ep.path}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 rounded border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 hover:border-[#acf901]/20 transition-colors duration-300"
              >
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    ep.method === "POST"
                      ? "bg-[#acf901]/10 text-[#acf901]"
                      : ep.method === "WS"
                        ? "bg-[#ff8080]/10 text-[#ff8080]"
                        : "bg-[#888888]/10 text-[#888888]"
                  }`}
                >
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-[#b0b0b0] flex-1">
                  {ep.path}
                </code>
                <span className="text-xs text-[#444444] hidden sm:block">
                  {ep.description}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right — rate limit tiers */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-bold text-white mb-6">Rate Limits</h3>
            <div className="space-y-3">
              {tiers.map((tier, i) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  viewport={{ once: true }}
                  className="rounded border border-[#2a2a2a] bg-[#0d0d0d] p-4 hover:border-[#acf901]/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-[#acf901]">
                      {tier.name}
                    </span>
                    <span className="text-sm font-medium text-[#888888]">
                      {tier.price}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[#444444] block">Requests</span>
                      <span className="text-[#b0b0b0] font-mono">
                        {tier.requests}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#444444] block">Relay</span>
                      <span className="text-[#b0b0b0] font-mono">
                        {tier.relay}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#444444] block">Proofs</span>
                      <span className="text-[#b0b0b0] font-mono">
                        {tier.proofs}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* API Key format */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true }}
            className="mt-6 rounded border border-[#2a2a2a] bg-[#0d0d0d] p-5"
          >
            <h4 className="text-sm font-bold text-white mb-3">API Key Types</h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-3">
                <span className="text-[#acf901]">sk_live_</span>
                <span className="text-[#444444]">Secret · Mainnet · Full access</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#acf901]">sk_test_</span>
                <span className="text-[#444444]">Secret · Fuji testnet · Full access</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#888888]">pk_live_</span>
                <span className="text-[#444444]">Publishable · Read-only</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
