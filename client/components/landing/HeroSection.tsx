/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { FuturisticButton } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

const ShroudAnim = dynamic(
  () => import('./ShroudAnim').then((m) => m.ShroudAnim),
  { ssr: false }
);


export const HeroSection = () => {
  const { connect, connecting } = useWallet();

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Subtle grid background */}
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_60%,rgba(172,249,1,0.06),transparent)]" />

      {/* Content layer */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between">

        {/* Top half — headline */}
        <div className="h-[45%] w-full flex flex-col">
          <div className="flex-1" />
          <div className="h-[20%] flex flex-col items-center justify-end pb-20 px-4 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl md:text-6xl text-[#888888] font-medium tracking-wide uppercase"
            >
              Privacy-first transfers on{" "}
              <span className="text-[#acf901]">Avalanche</span>
            </motion.h2>
          </div>
        </div>

        {/* Bottom half — network animation */}
        <div className="h-[50%] w-full flex flex-col justify-end items-center">
          <div className="h-[90%] w-full flex items-center justify-center">
            <ShroudAnim />
          </div>
        </div>

        {/* CTAs — centered absolutely between top and bottom */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col sm:flex-row gap-4 w-full justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <FuturisticButton
              size="lg"
              variant="outline"
              className="w-full sm:w-auto backdrop-blur-sm bg-black/50 text-[#acf901]"
              borderColor="rgba(172,249,1,1)"
              borderWidth={2}
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Launch App"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </FuturisticButton>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <FuturisticButton
              size="lg"
              variant="outline"
              className="w-full sm:w-auto backdrop-blur-sm bg-black/30 text-[#888888]"
              borderColor="rgba(172,249,1,0.4)"
              borderWidth={1.5}
              onClick={() =>
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore
            </FuturisticButton>
          </motion.div>
        </div>

      </div>
    </div>
  );
};
