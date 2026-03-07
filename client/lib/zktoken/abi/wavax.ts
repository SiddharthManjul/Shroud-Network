export const WAVAX_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address guy, uint256 wad) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

/** WAVAX address on Fuji testnet */
export const WAVAX_FUJI = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c";

/** WAVAX address on Avalanche C-Chain mainnet */
export const WAVAX_MAINNET = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";

/** Returns the WAVAX address for the current chain. */
export function getWavaxAddress(): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "43113";
  return chainId === "43114" ? WAVAX_MAINNET : WAVAX_FUJI;
}
