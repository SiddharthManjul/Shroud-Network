"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FuturisticButton } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#sdk", label: "SDK" },
  { href: "#api", label: "API" },
  { href: "#features", label: "Features" },
  {
    href: "https://docs.shroudnetwork.xyz",
    label: "Docs",
    external: true,
  },
];

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-base sm:text-xl font-bold text-[#acf901] tracking-wide uppercase whitespace-nowrap shrink-0"
          >
            <Image
              src="/schrodingerlabs.png"
              alt="Shroud Network"
              width={24}
              height={24}
              className="rounded-sm sm:w-7 sm:h-7"
            />
            Developer Portal
          </Link>
          <nav className="hidden md:flex gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://shroudnetwork.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block"
          >
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
            className="text-[#acf901] text-xs font-semibold tracking-wider uppercase hidden sm:inline-flex"
          >
            Join Waitlist
          </FuturisticButton>

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#888888] hover:text-[#acf901] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1a1a1a] bg-black/95 backdrop-blur-md px-4 pb-4 pt-2">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://shroudnetwork.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-2.5 text-sm font-medium text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5 transition-colors duration-200"
            >
              Platform
            </a>
          </nav>
          <div className="mt-3 px-3">
            <FuturisticButton
              variant="outline"
              size="sm"
              onClick={() => {
                setMobileOpen(false);
                document
                  .getElementById("waitlist")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              borderColor="rgba(172,249,1,0.8)"
              borderWidth={1.5}
              className="text-[#acf901] text-xs font-semibold tracking-wider uppercase w-full"
            >
              Join Waitlist
            </FuturisticButton>
          </div>
        </div>
      )}
    </header>
  );
}
