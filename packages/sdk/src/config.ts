import type { ShroudConfig } from './types';

// ─── Network configuration ────────────────────────────────────────────────────

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  /** ZkTokenFactory registry contract — set after deployment */
  poolRegistryAddress: string;
  /** Default relayer endpoint */
  relayerUrl: string;
  /** Indexer API base URL for event scanning */
  indexerUrl: string;
  /** Base URL for fetching circuit WASM + zkey files */
  circuitBaseUrl: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  avalanche: {
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    poolRegistryAddress: '', // populated after mainnet deployment
    relayerUrl: 'https://relay.shroud.dev',
    indexerUrl: 'https://indexer.shroud.dev',
    circuitBaseUrl: 'https://circuits.shroud.dev',
  },
  fuji: {
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    poolRegistryAddress: '', // populated after Fuji deployment
    relayerUrl: 'https://relay-testnet.shroud.dev',
    indexerUrl: 'https://indexer-testnet.shroud.dev',
    circuitBaseUrl: 'https://circuits-testnet.shroud.dev',
  },
};

export interface ResolvedConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  apiUrl: string;
  poolRegistryAddress: string;
  relayerUrl: string;
  indexerUrl: string;
  circuitBaseUrl: string;
  proofMode: 'client' | 'server';
  apiKey: string | undefined;
}

/**
 * Merge the user-provided ShroudConfig with the built-in network defaults.
 * Custom overrides always win.
 */
export function resolveConfig(config: ShroudConfig): ResolvedConfig {
  const base: NetworkConfig =
    config.network === 'custom'
      ? {
          chainId: 0,
          rpcUrl: config.rpcUrl ?? '',
          poolRegistryAddress: '',
          relayerUrl: config.apiUrl ?? '',
          indexerUrl: config.apiUrl ?? '',
          circuitBaseUrl: config.circuitBaseUrl ?? '',
        }
      : (NETWORKS[config.network] ?? NETWORKS['fuji']!);

  return {
    network: config.network,
    chainId: base.chainId,
    rpcUrl: config.rpcUrl ?? base.rpcUrl,
    apiUrl: config.apiUrl ?? base.indexerUrl,
    poolRegistryAddress: base.poolRegistryAddress,
    relayerUrl: base.relayerUrl,
    indexerUrl: config.apiUrl ?? base.indexerUrl,
    circuitBaseUrl: config.circuitBaseUrl ?? base.circuitBaseUrl,
    proofMode: config.proofMode ?? 'client',
    apiKey: config.apiKey,
  };
}
