"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletButton } from "./wallet-button";
import { TokenSelector } from "./token-selector";

const links = [
  { href: "/deposit", label: "Deposit" },
  { href: "/transfer", label: "Transfer" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/notes", label: "Notes" },
  { href: "/pools", label: "Pools" },
  { href: "/faucet", label: "Faucet" },
  { href: "/guide", label: "Guide" },
];

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-[#2a2a2a] bg-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-[#acf901] tracking-wide">
            <Image src="/schrodingerlabs.png" alt="Shroud Network" width={28} height={28} className="rounded-sm" />
            <span className="hidden sm:inline">Shroud Network</span>
          </Link>
          <div className="hidden md:flex gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  pathname === href
                    ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/40"
                    : "text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <TokenSelector />
          <WalletButton />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden rounded-md p-2 text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/10 transition-colors duration-200"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#2a2a2a] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2a2a2a] flex-wrap">
            <TokenSelector />
            <WalletButton />
          </div>
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                pathname === href
                  ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/40"
                  : "text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
