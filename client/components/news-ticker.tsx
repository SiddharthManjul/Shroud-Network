"use client";

/**
 * NewsTicker — scrolling headline banner.
 *
 * Edit the `headlines` array below to update the news.
 * The ticker renders two copies of the list side-by-side so the
 * scroll loops seamlessly via a CSS animation.
 */

const headlines: string[] = [
  "Shroud Network testnet is live on Avalanche Fuji",
  "Shielded transfers powered by Groth16 ZK proofs",
  "Gas-free relayed transactions via Paymaster",
  "Create a shielded pool for any ERC20 token",
  "Privacy is a right, not a feature",
];

const SEPARATOR = " \u2022 "; // bullet between items

export function NewsTicker() {
  if (headlines.length === 0) return null;

  const text = headlines.join(SEPARATOR) + SEPARATOR;

  return (
    <div className="w-full overflow-hidden bg-[#acf901] select-none">
      <div className="flex whitespace-nowrap animate-ticker">
        <span className="inline-block px-4 py-3 text-lg font-medium text-black">
          {text}
        </span>
        <span className="inline-block px-4 py-3 text-lg font-medium text-black">
          {text}
        </span>
      </div>
    </div>
  );
}
