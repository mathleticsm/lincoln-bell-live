export interface CacheSnapshot {
  fetchedAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  cacheAgeSeconds?: number;
  stale: boolean;
  sourceAvailable: boolean;
  hasData: boolean;
}

export class MemoryCache<T> {
  private value?: T;
  private fetchedAt = 0;
  private lastAttemptAt = 0;
  private lastError?: string;
  private inflight?: Promise<T>;

  constructor(
    private readonly ttlMs: number,
    private readonly failureRetryMs = Math.min(ttlMs, 60_000)
  ) {}

  isFresh() { return this.value !== undefined && Date.now() - this.fetchedAt < this.ttlMs; }
  getValue() { return this.value; }

  async getOrRefresh(loader: () => Promise<T>, force = false): Promise<{ value: T; stale: boolean; sourceAvailable: boolean }> {
    if (!force && this.isFresh() && this.value !== undefined) {
      return { value: this.value, stale: Boolean(this.lastError), sourceAvailable: !this.lastError };
    }

    if (!force && this.lastError && Date.now() - this.lastAttemptAt < this.failureRetryMs) {
      if (this.value !== undefined) return { value: this.value, stale: true, sourceAvailable: false };
      throw new Error(this.lastError);
    }

    if (this.inflight) {
      try {
        return { value: await this.inflight, stale: false, sourceAvailable: true };
      } catch {
        if (this.value !== undefined) return { value: this.value, stale: true, sourceAvailable: false };
        throw new Error(this.lastError || 'Source unavailable');
      }
    }

    this.lastAttemptAt = Date.now();
    this.inflight = loader();
    try {
      const result = await this.inflight;
      this.value = result;
      this.fetchedAt = Date.now();
      this.lastError = undefined;
      return { value: result, stale: false, sourceAvailable: true };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (this.value !== undefined) return { value: this.value, stale: true, sourceAvailable: false };
      throw error;
    } finally {
      this.inflight = undefined;
    }
  }

  snapshot(): CacheSnapshot {
    const fresh = this.isFresh();
    return {
      fetchedAt: this.fetchedAt ? new Date(this.fetchedAt).toISOString() : undefined,
      lastAttemptAt: this.lastAttemptAt ? new Date(this.lastAttemptAt).toISOString() : undefined,
      lastError: this.lastError,
      cacheAgeSeconds: this.fetchedAt ? Math.max(0, Math.floor((Date.now() - this.fetchedAt) / 1000)) : undefined,
      stale: Boolean(this.lastError) || !fresh,
      sourceAvailable: this.fetchedAt > 0 && !this.lastError,
      hasData: this.value !== undefined
    };
  }
}
