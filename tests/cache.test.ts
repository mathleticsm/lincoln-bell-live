import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../server/cache/memoryCache.js';

describe('MemoryCache diagnostics', () => {
  it('marks a fresh last-known-good value stale after a forced source failure', async () => {
    const cache = new MemoryCache<string>(60_000);
    await cache.getOrRefresh(async () => 'live');
    const result = await cache.getOrRefresh(async () => { throw new Error('source down'); }, true);
    expect(result).toEqual({ value: 'live', stale: true, sourceAvailable: false });
    expect(cache.snapshot()).toMatchObject({ stale: true, sourceAvailable: false, hasData: true, lastError: 'source down' });
  });

  it('backs off sequential retries after a cold-start source failure', async () => {
    const cache = new MemoryCache<string>(60_000, 60_000);
    let calls = 0;
    const loader = async () => { calls += 1; throw new Error('source down'); };
    await expect(cache.getOrRefresh(loader)).rejects.toThrow('source down');
    await expect(cache.getOrRefresh(loader)).rejects.toThrow('source down');
    expect(calls).toBe(1);
  });

});
