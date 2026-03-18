import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../src/storage/memory';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns null for missing keys', async () => {
    expect(await storage.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    await storage.set('foo', 'bar');
    expect(await storage.get('foo')).toBe('bar');
  });

  it('overwrites an existing value', async () => {
    await storage.set('key', 'v1');
    await storage.set('key', 'v2');
    expect(await storage.get('key')).toBe('v2');
  });

  it('deletes a key', async () => {
    await storage.set('del', 'value');
    await storage.delete('del');
    expect(await storage.get('del')).toBeNull();
  });

  it('no-ops when deleting a non-existent key', async () => {
    await expect(storage.delete('ghost')).resolves.toBeUndefined();
  });

  it('lists keys by prefix', async () => {
    await storage.set('note:wallet1:token1:0', 'a');
    await storage.set('note:wallet1:token1:1', 'b');
    await storage.set('note:wallet1:token2:0', 'c');
    await storage.set('other:key', 'd');

    const keys = await storage.keys('note:wallet1:token1:');
    expect(keys.sort()).toEqual(['note:wallet1:token1:0', 'note:wallet1:token1:1']);
  });

  it('returns empty array when no keys match prefix', async () => {
    await storage.set('abc', '1');
    expect(await storage.keys('xyz:')).toEqual([]);
  });

  it('tracks size correctly', async () => {
    expect(storage.size).toBe(0);
    await storage.set('a', '1');
    await storage.set('b', '2');
    expect(storage.size).toBe(2);
    storage.clear();
    expect(storage.size).toBe(0);
  });

  it('clear() removes all entries', async () => {
    await storage.set('x', '1');
    await storage.set('y', '2');
    storage.clear();
    expect(await storage.get('x')).toBeNull();
    expect(await storage.get('y')).toBeNull();
  });
});
