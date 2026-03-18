import { describe, it, expect } from 'vitest';
import {
  ShroudError,
  InsufficientBalanceError,
  InvalidKeyError,
  NetworkError,
  ProofGenerationError,
  RelayError,
  ApiKeyError,
  UnsupportedTokenError,
} from '../src/errors';

describe('ShroudError', () => {
  it('is an instance of Error', () => {
    const err = new ShroudError('test', 'TEST_CODE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ShroudError);
  });

  it('carries a code', () => {
    const err = new ShroudError('msg', 'MY_CODE');
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('msg');
    expect(err.name).toBe('ShroudError');
  });
});

describe('InsufficientBalanceError', () => {
  it('carries required and available bigints', () => {
    const err = new InsufficientBalanceError(100n, 50n, 'USDC');
    expect(err).toBeInstanceOf(ShroudError);
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(err.required).toBe(100n);
    expect(err.available).toBe(50n);
    expect(err.message).toContain('USDC');
    expect(err.message).toContain('100');
    expect(err.message).toContain('50');
  });

  it('works without token label', () => {
    const err = new InsufficientBalanceError(1n, 0n);
    expect(err.message).not.toContain('undefined');
  });
});

describe('InvalidKeyError', () => {
  it('has correct code', () => {
    const err = new InvalidKeyError('too short');
    expect(err.code).toBe('INVALID_KEY');
    expect(err.message).toContain('too short');
    expect(err.name).toBe('InvalidKeyError');
  });

  it('works with no detail', () => {
    const err = new InvalidKeyError();
    expect(err.message).toBeTruthy();
  });
});

describe('NetworkError', () => {
  it('stores status code', () => {
    const err = new NetworkError('connection refused', 503);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('works without status code', () => {
    const err = new NetworkError('timeout');
    expect(err.statusCode).toBeUndefined();
  });
});

describe('ProofGenerationError', () => {
  it('stores cause', () => {
    const cause = new Error('witness gen failed');
    const err = new ProofGenerationError('proof failed', cause);
    expect(err.cause).toBe(cause);
    expect(err.code).toBe('PROOF_GENERATION_ERROR');
  });
});

describe('RelayError', () => {
  it('stores relay code', () => {
    const err = new RelayError('nonce too low', 'NONCE_ERROR');
    expect(err.relayCode).toBe('NONCE_ERROR');
    expect(err.code).toBe('RELAY_ERROR');
  });
});

describe('ApiKeyError', () => {
  it('mentions the operation', () => {
    const err = new ApiKeyError('relayTransfer');
    expect(err.message).toContain('relayTransfer');
    expect(err.code).toBe('API_KEY_REQUIRED');
  });
});

describe('UnsupportedTokenError', () => {
  it('stores the token', () => {
    const err = new UnsupportedTokenError('FAKE');
    expect(err.token).toBe('FAKE');
    expect(err.message).toContain('FAKE');
    expect(err.code).toBe('UNSUPPORTED_TOKEN');
  });
});

describe('Error instanceof chain', () => {
  it('all subclasses are instanceof ShroudError', () => {
    const errors = [
      new InsufficientBalanceError(1n, 0n),
      new InvalidKeyError(),
      new NetworkError('x'),
      new ProofGenerationError('x'),
      new RelayError('x'),
      new ApiKeyError(),
      new UnsupportedTokenError('x'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ShroudError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
