"use client";

const headlines: string[] = [
  "Shroud SDK private beta — Join the waitlist for early access",
  "Build privacy-first dApps with zero ZK expertise",
  "@shroud/sdk supports client-side proof generation via WASM",
  "Gasless relay API — your users don't need gas tokens",
];

const SEPARATOR = "  \u00A0\u00A0\u2022\u00A0\u00A0  ";

export function NewsTicker() {
  if (headlines.length === 0) return null;

  const text = headlines.join(SEPARATOR) + SEPARATOR;

  return (
    <div className="w-full overflow-hidden bg-[#acf901] select-none">
      <div className="flex whitespace-nowrap animate-ticker">
        <span className="inline-block px-4 pt-3 pb-3 text-sm font-medium text-black leading-none">
          {text}
        </span>
        <span className="inline-block px-4 pt-3 pb-3 text-sm font-medium text-black leading-none">
          {text}
        </span>
      </div>
    </div>
  );
}
