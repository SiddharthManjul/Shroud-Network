"use client";

import { motion } from "framer-motion";

const layers = [
  {
    label: "Your App",
    color: "#888888",
    items: ["React / Next.js / Node.js / Mobile"],
  },
  {
    label: "@shroud/sdk",
    color: "#acf901",
    items: [
      "ShroudClient",
      "Wallet Management",
      "Client-Side Proofs (WASM)",
      "Note Scanning & Sync",
    ],
  },
  {
    label: "Shroud API",
    color: "#acf901",
    items: [
      "API Key Auth",
      "Relay Proxy",
      "Server Proofs",
      "WebSocket Notifications",
      "Usage Analytics",
    ],
  },
  {
    label: "Avalanche C-Chain",
    color: "#ff8080",
    items: [
      "ShieldedPool Contracts",
      "Groth16 Verifier",
      "Poseidon Merkle Tree",
      "PoolRegistry",
    ],
  },
];

export function ArchitectureSection() {
  return (
    <div className="container mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-center mb-14"
      >
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-3 py-1 mb-4">
          Architecture
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-[#acf901]">
          How It Works
        </h2>
        <p className="mt-3 text-[#888888] max-w-xl mx-auto">
          Your app talks to the SDK. The SDK handles cryptography and talks to
          the API. The API relays to Avalanche. Privacy is preserved at every
          layer.
        </p>
      </motion.div>

      {/* Vertical stack */}
      <div className="max-w-2xl mx-auto space-y-3">
        {layers.map((layer, i) => (
          <motion.div
            key={layer.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
            viewport={{ once: true }}
          >
            <div
              className="rounded border bg-[#0d0d0d] p-5 relative overflow-hidden"
              style={{ borderColor: `${layer.color}33` }}
            >
              {/* Connecting arrow */}
              {i < layers.length - 1 && (
                <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10">
                  <svg
                    width="20"
                    height="14"
                    viewBox="0 0 20 14"
                    fill="none"
                  >
                    <path
                      d="M10 14L0 0H20L10 14Z"
                      fill={layer.color}
                      fillOpacity={0.3}
                    />
                  </svg>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
                <span
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: layer.color }}
                >
                  {layer.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {layer.items.map((item) => (
                  <span
                    key={item}
                    className="text-xs font-mono rounded px-2.5 py-1"
                    style={{
                      color: `${layer.color}cc`,
                      backgroundColor: `${layer.color}0d`,
                      border: `1px solid ${layer.color}1a`,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
