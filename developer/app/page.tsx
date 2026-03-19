"use client";

import { Nav } from "@/components/landing/Nav";
import { NewsTicker } from "@/components/landing/NewsTicker";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { SDKSection } from "@/components/landing/SDKSection";
import { APISection } from "@/components/landing/APISection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

function SectionHeader({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center mb-14 px-4"
    >
      <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-3 py-1 mb-4">
        {label}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold text-[#acf901]">
        {title}
      </h2>
      <p className="mt-3 text-[#888888] max-w-xl mx-auto">{subtitle}</p>
    </motion.div>
  );
}

export default function DeveloperPortal() {
  return (
    <div className="min-h-screen bg-black relative">
      <Nav />

      {/* News Ticker */}
      <div className="fixed top-15.25 left-0 right-0 z-40">
        <NewsTicker />
      </div>

      {/* Hero */}
      <div className="pt-24">
        <HeroSection />
      </div>

      {/* Features Grid */}
      <section id="features" className="pt-24 pb-12">
        <SectionHeader
          label="Why Shroud"
          title="Everything You Need"
          subtitle="Privacy integration without the complexity. The SDK and API handle all the cryptography so you can focus on your product."
        />
        <FeatureGrid />
      </section>

      {/* SDK Section */}
      <section id="sdk" className="py-24">
        <SDKSection />
      </section>

      {/* API Section */}
      <section id="api" className="py-24">
        <APISection />
      </section>

      {/* Architecture */}
      <section className="py-24">
        <ArchitectureSection />
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-24">
        <WaitlistSection />
      </section>

      <Footer />
    </div>
  );
}
