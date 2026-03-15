"use client";

import { useEffect } from "react";
import { PrivyProvider as PrivySDKProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * Suppress non-fatal "walletProvider.on is not a function" errors
 * from Privy's internals when the embedded wallet provider doesn't
 * implement EIP-1193 event methods.
 */
function useSupressPrivyWalletErrors() {
  useEffect(() => {
    const isPrivyWalletError = (msg: string) =>
      msg.includes("is not a function") &&
      (msg.includes("walletProvider") || msg.includes(".on"));

    const errorHandler = (event: ErrorEvent) => {
      if (event.message && isPrivyWalletError(event.message)) {
        event.preventDefault();
      }
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason ?? "");
      if (isPrivyWalletError(msg)) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);
}

export function PrivyProvider({ children }: { children: ReactNode }) {
  useSupressPrivyWalletErrors();

  // During SSR/prerender the app ID may be empty — render children without
  // the Privy SDK so static pages (like _not-found) can build successfully.
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivySDKProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#acf901",
          logo: "/schrodingerlabs.png",
          landingHeader: "Sign in to Shroud Network",
          loginMessage: "Privacy redefined with zero-knowledge on Avalanche",
        },
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivySDKProvider>
  );
}
