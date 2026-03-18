import type { StorageAdapter } from '../types';

const DB_NAME = 'shroud-sdk';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

/**
 * IndexedDB-backed storage adapter for browser environments.
 * Falls back gracefully — callers should only instantiate this in environments
 * where `indexedDB` is available.
 *
 * The database is opened lazily on the first operation.
 */
export class IndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;

  constructor(dbName = DB_NAME) {
    this.dbName = dbName;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private openDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(
          new Error(
            `IndexedDB open failed: ${(event.target as IDBOpenDBRequest).error?.message ?? 'unknown'}`,
          ),
        );
      };
    });
  }

  private async transaction(
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore> {
    const db = await this.openDB();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private idbRequest<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── StorageAdapter implementation ─────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const store = await this.transaction('readonly');
    const value = await this.idbRequest<string | undefined>(store.get(key));
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const store = await this.transaction('readwrite');
    await this.idbRequest(store.put(value, key));
  }

  async delete(key: string): Promise<void> {
    const store = await this.transaction('readwrite');
    await this.idbRequest(store.delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const store = await this.transaction('readonly');
    const allKeys = await this.idbRequest<IDBValidKey[]>(store.getAllKeys());
    return allKeys
      .filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
  }

  /**
   * Close the underlying IDBDatabase connection.
   * Subsequent operations will re-open it automatically.
   */
  close(): void {
    this.db?.close();
    this.db = null;
  }
}
