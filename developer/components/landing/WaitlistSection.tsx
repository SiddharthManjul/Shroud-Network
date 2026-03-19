"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { FuturisticButton } from "@/components/ui/button";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type WaitlistStatus = "idle" | "loading" | "success" | "error";

export function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const chamferSize = 32;
  const strokeWidth = 1.5;
  const getPath = (w: number, h: number, c: number) => {
    const o = strokeWidth / 2;
    return `M ${o} ${o} L ${w - c - o} ${o} L ${w - o} ${c + o} L ${w - o} ${h - o} L ${c + o} ${h - o} L ${o} ${h - c - o} Z`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company, useCase }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setEmail("");
      setName("");
      setCompany("");
      setUseCase("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to join waitlist"
      );
    }
  }

  return (
    <div className="container mx-auto px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#acf901]/60 border border-[#acf901]/20 rounded-full px-3 py-1 mb-4">
            Private Beta
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#acf901]">
            Get Early Access
          </h2>
          <p className="mt-3 text-[#888888] max-w-lg mx-auto">
            We&apos;re launching the Shroud SDK & API in a closed private beta very soon.
            Join the waitlist to get early access.
          </p>
        </motion.div>

        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="relative overflow-hidden"
          style={{
            clipPath: `polygon(0 0, calc(100% - ${chamferSize}px) 0, 100% ${chamferSize}px, 100% 100%, ${chamferSize}px 100%, 0 calc(100% - ${chamferSize}px))`,
          }}
        >
          <svg
            className="absolute inset-0 pointer-events-none z-20"
            width="100%"
            height="100%"
          >
            <path
              d={getPath(
                dimensions.width,
                dimensions.height,
                chamferSize
              )}
              fill="none"
              stroke="#acf901"
              strokeWidth={strokeWidth}
              strokeOpacity={0.3}
            />
          </svg>

          <div className="bg-[#0d0d0d] p-8 md:p-10 relative z-10">
            {status === "success" ? (
              <div className="text-center py-8">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#acf901]/10 text-[#acf901] mb-4">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-[#acf901] mb-2">
                  You&apos;re on the list
                </h3>
                <p className="text-[#888888]">
                  We&apos;ll reach out with your API key when your spot opens up.
                </p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                    Company / Project *
                  </label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your company or project name"
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                    What are you building? *
                  </label>
                  <textarea
                    required
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    placeholder="Tell us about your use case..."
                    rows={3}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm resize-none"
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-[#ff4444]">{errorMessage}</p>
                )}

                <FuturisticButton
                  type="submit"
                  size="lg"
                  variant="default"
                  disabled={status === "loading" || !email || !name || !company || !useCase}
                  borderColor="rgba(172,249,1,1)"
                  borderWidth={2}
                  className="w-full text-black font-semibold"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Private Beta
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </FuturisticButton>

                <p className="text-xs text-[#444444] text-center">
                  No spam. We&apos;ll only contact you about your API access.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
