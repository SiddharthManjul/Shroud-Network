import type { PoolInfo, TokenInfo, TransactionResult } from './types';
import { NetworkError, RelayError, ApiKeyError } from './errors';

// ─── Internal API payload types ───────────────────────────────────────────────

export interface RelayPayload {
  proof: {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
  };
  publicSignals: string[];
  encryptedMemo1?: string;
  encryptedMemo2?: string;
  encryptedMemo?: string;
  recipient?: string;
  amount?: string;
  merkleRoot: string;
  nullifierHash: string;
  tokenAddress?: string;
  poolAddress?: string;
}

export interface ProofResult {
  proof: {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
  };
  publicSignals: string[];
}

export interface MerkleLeaf {
  commitment: string;
  leafIndex: number;
  blockNumber: number;
  txHash: string;
}

export interface MemoEvent {
  encryptedMemo1?: string;
  encryptedMemo2?: string;
  encryptedMemo?: string;
  nullifierHash: string;
  newCommitment1?: string;
  newCommitment2?: string;
  changeCommitment?: string;
  blockNumber: number;
  txHash: string;
  type: 'transfer' | 'withdraw';
}

// ─── API client ───────────────────────────────────────────────────────────────

/**
 * HTTP client for Shroud hosted API services.
 * All methods throw typed ShroudError subclasses on failure.
 */
export class ShroudApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(baseUrl: string, apiKey?: string) {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ─── Pool / token info ──────────────────────────────────────────────────────

  async getPoolInfo(token: string): Promise<PoolInfo> {
    const data = await this.request<{
      token: { symbol: string; address: string; poolAddress: string; decimals: number };
      totalDeposited: string;
      activeCommitments: number;
      merkleRoot: string;
    }>('GET', `/v1/pools/${encodeURIComponent(token)}`);

    return {
      token: data.token,
      totalDeposited: BigInt(data.totalDeposited),
      activeCommitments: data.activeCommitments,
      merkleRoot: data.merkleRoot,
    };
  }

  async getSupportedTokens(): Promise<TokenInfo[]> {
    return this.request<TokenInfo[]>('GET', '/v1/tokens');
  }

  async getMerkleRoot(poolAddress?: string): Promise<string> {
    const path = poolAddress
      ? `/v1/merkle/root?pool=${encodeURIComponent(poolAddress)}`
      : '/v1/merkle/root';
    const data = await this.request<{ root: string }>('GET', path);
    return data.root;
  }

  async getMerkleLeaves(afterIndex?: number, poolAddress?: string): Promise<MerkleLeaf[]> {
    const params = new URLSearchParams();
    if (afterIndex !== undefined) params.set('afterIndex', String(afterIndex));
    if (poolAddress) params.set('pool', poolAddress);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<MerkleLeaf[]>('GET', `/v1/merkle/leaves${qs}`);
  }

  async getMemoEvents(afterBlock?: number, poolAddress?: string): Promise<MemoEvent[]> {
    const params = new URLSearchParams();
    if (afterBlock !== undefined) params.set('afterBlock', String(afterBlock));
    if (poolAddress) params.set('pool', poolAddress);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<MemoEvent[]>('GET', `/v1/memos${qs}`);
  }

  // ─── Relay endpoints ────────────────────────────────────────────────────────

  async relayDeposit(payload: RelayPayload): Promise<TransactionResult> {
    this.requireApiKey('relayDeposit');
    return this.relayRequest('/v1/relay/deposit', payload);
  }

  async relayTransfer(payload: RelayPayload): Promise<TransactionResult> {
    this.requireApiKey('relayTransfer');
    return this.relayRequest('/v1/relay/transfer', payload);
  }

  async relayWithdraw(payload: RelayPayload): Promise<TransactionResult> {
    this.requireApiKey('relayWithdraw');
    return this.relayRequest('/v1/relay/withdraw', payload);
  }

  // ─── Server-side proof generation ──────────────────────────────────────────

  async generateProof(
    type: 'transfer' | 'withdraw',
    witness: Record<string, unknown>,
  ): Promise<ProofResult> {
    this.requireApiKey('generateProof');
    return this.request<ProofResult>('POST', `/v1/prove/${type}`, { witness });
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private requireApiKey(operation: string): void {
    if (!this.apiKey) {
      throw new ApiKeyError(operation);
    }
  }

  private async relayRequest(path: string, payload: RelayPayload): Promise<TransactionResult> {
    const data = await this.request<{
      txHash: string;
      blockNumber: number;
      status: 'success' | 'failed';
      type: 'deposit' | 'transfer' | 'withdraw';
      error?: string;
      code?: string;
    }>('POST', path, payload);

    if (data.status === 'failed') {
      throw new RelayError(data.error ?? 'Relay submission failed', data.code);
    }

    return {
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      status: data.status,
      type: data.type,
    };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new NetworkError(
        `Network request failed for ${method} ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json() as { message?: string; error?: string };
        errorMessage = errBody.message ?? errBody.error ?? errorMessage;
      } catch {
        // Ignore JSON parse errors — use the status message
      }
      throw new NetworkError(errorMessage, response.status);
    }

    try {
      return await response.json() as T;
    } catch (err) {
      throw new NetworkError(
        `Failed to parse response JSON from ${method} ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
