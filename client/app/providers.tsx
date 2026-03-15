"use client";

import { ZkTokenProvider } from "@/providers/zktoken-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { PrivyProvider } from "@/providers/privy-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ShieldedKeyProvider } from "@/providers/shielded-key-provider";
import { TokenProvider } from "@/providers/token-provider";
import { Nav } from "@/components/nav";
import { NewsTicker } from "@/components/news-ticker";
import { VaultGate } from "@/components/vault-gate";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

const LANDING = "/";
const APP_PATHS = ["/dashboard", "/deposit", "/transfer", "/withdraw", "/notes", "/pools", "/faucet", "/migrate"];

/** Watches auth state and handles redirects between landing / app */
function AuthRedirect() {
  const { authenticated, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (authenticated && pathname === LANDING) {
      router.push("/dashboard");
    } else if (!authenticated && APP_PATHS.some((p) => pathname.startsWith(p))) {
      router.push(LANDING);
    }
  }, [authenticated, ready, pathname, router]);

  return null;
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === LANDING;

  return (
    <>
      <AuthRedirect />
      {/* Only show the authenticated nav on app pages */}
      {!isLanding && (
        <>
          <Nav />
          <NewsTicker />
        </>
      )}
      {isLanding ? (
        <>{children}</>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-8 overflow-x-hidden">
          <VaultGate>{children}</VaultGate>
        </main>
      )}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <AuthProvider>
        <WalletProvider>
          <ShieldedKeyProvider>
            <TokenProvider>
              <ZkTokenProvider>
                <AppShell>{children}</AppShell>
              </ZkTokenProvider>
            </TokenProvider>
          </ShieldedKeyProvider>
        </WalletProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}
