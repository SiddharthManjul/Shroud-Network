import type { StorageAdapter } from '../types';

/**
 * In-memory storage adapter. Data is lost when the process exits.
 * Safe to use in Node.js and browser environments; ideal for testing.
 */
export class MemoryStorage implements StorageAdapter {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    const result: string[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        result.push(k);
      }
    }
    return result;
  }

  /** Wipe all stored data — useful in tests */
  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
