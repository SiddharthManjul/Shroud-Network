"use client";

import Image from "next/image";
import { FuturisticButton } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md">
      <div className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-xl font-bold text-[#acf901] tracking-wide uppercase">
            <Image
              src="/schrodingerlabs.png"
              alt="Shroud Network"
              width={28}
              height={28}
              className="rounded-sm"
            />
            Developer Portal
          </span>
          <nav className="hidden md:flex gap-1">
            <a
              href="#sdk"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
            >
              SDK
            </a>
            <a
              href="#api"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
            >
              API
            </a>
            <a
              href="#features"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
            >
              Features
            </a>
            <a
              href="https://docs.shroudnetwork.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
            >
              Docs
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://shroudnetwork.xyz" target="_blank" rel="noopener noreferrer">
            <FuturisticButton
              variant="ghost"
              size="sm"
              borderWidth={0}
              className="text-[#888888] text-xs font-semibold tracking-wider uppercase"
            >
              Platform
            </FuturisticButton>
          </a>
          <FuturisticButton
            variant="outline"
            size="sm"
            onClick={() =>
              document
                .getElementById("waitlist")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            borderColor="rgba(172,249,1,0.8)"
            borderWidth={1.5}
            className="text-[#acf901] text-xs font-semibold tracking-wider uppercase"
          >
            Join Waitlist
          </FuturisticButton>
        </div>
      </div>
    </header>
  );
}
