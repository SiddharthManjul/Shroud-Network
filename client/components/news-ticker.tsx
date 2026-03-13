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
  "Docs coming soon - join our Telegram for updates",
  "Shroud Network is now live on X. Follow us @ShroudNetwork for the latest news and updates",
  "Shroud is now enabled with multi-token gas payment support"
];

const SEPARATOR = "  \u00A0\u00A0\u2022\u00A0\u00A0  "; // bullet with wide spacing

export function NewsTicker() {
  if (headlines.length === 0) return null;

  const text = headlines.join(SEPARATOR) + SEPARATOR;

  return (
    <div className="w-full overflow-hidden bg-[#acf901] select-none">
      <div className="flex whitespace-nowrap animate-ticker">
        <span className="inline-block px-4 pt-3.5 pb-3.5 text-lg font-medium text-black leading-none">
          {text}
        </span>
        <span className="inline-block px-4 pt-3.5 pb-3.5 text-lg font-medium text-black leading-none">
          {text}
        </span>
      </div>
    </div>
  );
}
