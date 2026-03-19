"use client";

import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-[#2a2a2a] bg-black py-12 px-6 mt-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
          <div className="max-w-xs text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Image
                src="/schrodingerlabs.png"
                alt="Shroud Network"
                width={32}
                height={32}
                className="rounded-sm"
              />
              <p className="text-xl font-bold text-[#acf901] uppercase tracking-wide">
                Shroud Network
              </p>
            </div>
            <p className="mt-2 text-sm text-[#888888]">
              Privacy infrastructure for the next generation of on-chain applications.
            </p>
          </div>

          <div className="flex gap-10 text-sm text-[#888888]">
            <div className="space-y-2">
              <p className="font-semibold text-[#acf901]/70 uppercase tracking-wider text-xs mb-3">
                Developers
              </p>
              <a
                href="https://docs.shroudnetwork.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                Documentation
              </a>
              <a
                href="#sdk"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                SDK Reference
              </a>
              <a
                href="#api"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                API Reference
              </a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-[#acf901]/70 uppercase tracking-wider text-xs mb-3">
                Community
              </p>
              <a
                href="https://x.com/shroudnetwork"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                Twitter
              </a>
              <a
                href="https://t.me/+CQMq831HnFo2ZDRl"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                Telegram
              </a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-[#acf901]/70 uppercase tracking-wider text-xs mb-3">
                Platform
              </p>
              <a
                href="https://shroudnetwork.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                Launch App
              </a>
              <a
                href="https://testnet.snowtrace.io"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[#acf901] transition-colors duration-200"
              >
                Explorer
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-[#2a2a2a] pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-[#444444]">
            &copy; 2026 Shroud Network. All rights reserved.
          </p>
          <p className="text-xs text-[#444444]">
            Built on{" "}
            <span className="text-[#acf901]/60">Avalanche</span> &middot;
            Powered by ZK-SNARKs
          </p>
        </div>
      </div>
    </footer>
  );
}
