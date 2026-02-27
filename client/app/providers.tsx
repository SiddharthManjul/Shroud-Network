"use client";

import { ZkTokenProvider } from "@/providers/zktoken-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { Nav } from "@/components/nav";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <ZkTokenProvider>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </ZkTokenProvider>
    </WalletProvider>
  );
}
