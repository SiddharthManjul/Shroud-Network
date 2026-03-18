// ─── Custom error hierarchy ───────────────────────────────────────────────────

/**
 * Base error class for all Shroud SDK errors.
 * Always carries a machine-readable `code` alongside the human message.
 */
export class ShroudError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ShroudError';
    this.code = code;
    // Maintains proper prototype chain in transpiled ES5 targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The wallet has no unspent note with a value large enough to cover
 * the requested transfer or withdrawal amount.
 */
export class InsufficientBalanceError extends ShroudError {
  readonly required: bigint;
  readonly available: bigint;

  constructor(required: bigint, available: bigint, token?: string) {
    const tokenLabel = token ? ` of ${token}` : '';
    super(
      `Insufficient shielded balance${tokenLabel}: need ${required}, have ${available}`,
      'INSUFFICIENT_BALANCE',
    );
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
  }
}

/**
 * The provided private key or seed is not a valid Baby Jubjub scalar.
 */
export class InvalidKeyError extends ShroudError {
  constructor(detail?: string) {
    super(
      detail ? `Invalid key: ${detail}` : 'Invalid Baby Jubjub private key',
      'INVALID_KEY',
    );
    this.name = 'InvalidKeyError';
  }
}

/**
 * An on-chain or RPC request failed.
 */
export class NetworkError extends ShroudError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

/**
 * Groth16 witness generation or proof generation failed.
 */
export class ProofGenerationError extends ShroudError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, 'PROOF_GENERATION_ERROR');
    this.name = 'ProofGenerationError';
    this.cause = cause;
  }
}

/**
 * The relay server rejected or failed to submit the transaction.
 */
export class RelayError extends ShroudError {
  readonly relayCode?: string;

  constructor(message: string, relayCode?: string) {
    super(message, 'RELAY_ERROR');
    this.name = 'RelayError';
    this.relayCode = relayCode;
  }
}

/**
 * A valid API key is required for the requested operation but was not provided.
 */
export class ApiKeyError extends ShroudError {
  constructor(operation?: string) {
    super(
      operation
        ? `API key required for: ${operation}`
        : 'API key required — pass apiKey in ShroudConfig',
      'API_KEY_REQUIRED',
    );
    this.name = 'ApiKeyError';
  }
}

/**
 * The requested token is not supported by the Shroud deployment.
 */
export class UnsupportedTokenError extends ShroudError {
  readonly token: string;

  constructor(token: string) {
    super(`Token not supported by Shroud pool: ${token}`, 'UNSUPPORTED_TOKEN');
    this.name = 'UnsupportedTokenError';
    this.token = token;
  }
}
