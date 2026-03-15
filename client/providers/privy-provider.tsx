"use client";

import { PrivyProvider as PrivySDKProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function PrivyProvider({ children }: { children: ReactNode }) {
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
