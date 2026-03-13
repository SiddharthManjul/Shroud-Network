import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Shroud Network — Privacy redefined",
  description:
    "Zero-knowledge shielded token transfers on Avalanche. Shield your assets, transfer privately, and maintain full self-custody.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CBTYRZLX3N"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CBTYRZLX3N');
          `}
        </Script>
      </head>
      <body className={`${spaceGrotesk.variable} font-space antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
