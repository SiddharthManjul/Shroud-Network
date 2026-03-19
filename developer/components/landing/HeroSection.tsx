"use client";

import { motion } from "framer-motion";
import { FuturisticButton } from "@/components/ui/button";
import { ArrowRight, Code2 } from "lucide-react";

export function HeroSection() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(rgba(172,249,1,0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(172,249,1,0.2) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(172,249,1,0.06),transparent)]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-4 py-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Private Beta
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          <span className="text-[#888888]">Add </span>
          <span className="text-[#acf901]">Privacy</span>
          <span className="text-[#888888]"> to</span>
          <br />
          <span className="text-[#888888]">Your App in </span>
          <span className="text-[#acf901]">5 Lines</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-6 text-lg md:text-xl text-[#888888] max-w-2xl mx-auto leading-relaxed"
        >
          Integrate shielded token transfers on Avalanche with the Shroud SDK.
          No ZK expertise required. No cryptography headaches. Just import and build.
        </motion.p>

        {/* Code preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 mx-auto max-w-2xl text-left"
        >
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2a2a2a]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff4444]/60" />
                <div className="w-3 h-3 rounded-full bg-[#ffaa00]/60" />
                <div className="w-3 h-3 rounded-full bg-[#acf901]/60" />
              </div>
              <span className="text-xs text-[#444444] ml-2 font-mono">
                app.ts
              </span>
            </div>
            <pre className="p-5 text-sm font-mono leading-7 overflow-x-auto">
              <code>
                <span className="text-[#acf901]/70">import</span>
                <span className="text-[#888888]">{" { "}</span>
                <span className="text-[#acf901]">ShroudClient</span>
                <span className="text-[#888888]">{" } "}</span>
                <span className="text-[#acf901]/70">from</span>
                <span className="text-[#ff8080]"> &apos;@shroud/sdk&apos;</span>
                <span className="text-[#888888]">;</span>
                {"\n\n"}
                <span className="text-[#acf901]/70">const</span>
                <span className="text-[#b0b0b0]"> shroud</span>
                <span className="text-[#888888]"> = </span>
                <span className="text-[#acf901]/70">new</span>
                <span className="text-[#acf901]"> ShroudClient</span>
                <span className="text-[#888888]">{"({ "}</span>
                {"\n"}
                <span className="text-[#b0b0b0]">{"  apiKey"}</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#ff8080]">&apos;sk_live_...&apos;</span>
                <span className="text-[#888888]">,</span>
                {"\n"}
                <span className="text-[#b0b0b0]">{"  network"}</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#ff8080]">&apos;avalanche&apos;</span>
                {"\n"}
                <span className="text-[#888888]">{"});"}</span>
                {"\n\n"}
                <span className="text-[#444444]">
                  {"// Deposit, transfer, withdraw — all private"}
                </span>
                {"\n"}
                <span className="text-[#acf901]/70">await</span>
                <span className="text-[#b0b0b0]"> shroud</span>
                <span className="text-[#888888]">.</span>
                <span className="text-[#acf901]">deposit</span>
                <span className="text-[#888888]">{"({ "}</span>
                <span className="text-[#b0b0b0]">token</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#ff8080]">&apos;USDC&apos;</span>
                <span className="text-[#888888]">, </span>
                <span className="text-[#b0b0b0]">amount</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#acf901]">1000</span>
                <span className="text-[#888888]">{" });"}</span>
                {"\n"}
                <span className="text-[#acf901]/70">await</span>
                <span className="text-[#b0b0b0]"> shroud</span>
                <span className="text-[#888888]">.</span>
                <span className="text-[#acf901]">transfer</span>
                <span className="text-[#888888]">{"({ "}</span>
                <span className="text-[#b0b0b0]">to</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#b0b0b0]">recipientPubKey</span>
                <span className="text-[#888888]">, </span>
                <span className="text-[#b0b0b0]">amount</span>
                <span className="text-[#888888]">: </span>
                <span className="text-[#acf901]">500</span>
                <span className="text-[#888888]">{" });"}</span>
              </code>
            </pre>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <FuturisticButton
            size="xl"
            variant="default"
            onClick={() =>
              document
                .getElementById("waitlist")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            borderColor="rgba(172,249,1,1)"
            borderWidth={2}
            className="text-black font-semibold"
          >
            Join Private Beta
            <ArrowRight className="ml-1 h-4 w-4" />
          </FuturisticButton>
          <FuturisticButton
            size="xl"
            variant="outline"
            onClick={() =>
              document
                .getElementById("sdk")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            borderColor="rgba(172,249,1,0.4)"
            borderWidth={1.5}
            className="backdrop-blur-sm bg-black/30 text-[#888888]"
          >
            Explore SDK
          </FuturisticButton>
        </motion.div>
      </div>
    </div>
  );
}
