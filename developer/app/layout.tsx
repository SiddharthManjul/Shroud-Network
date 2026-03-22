import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Shroud Developers — Build with Privacy",
  description:
    "Integrate shielded pool privacy tokens into your app with the Shroud SDK & API. Zero-knowledge transfers on Avalanche, no cryptography expertise required.",
  openGraph: {
    title: "Shroud Developers — Build with Privacy",
    description:
      "Integrate shielded pool privacy tokens into your app with the Shroud SDK & API.",
    siteName: "Shroud Network",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} font-space antialiased overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
