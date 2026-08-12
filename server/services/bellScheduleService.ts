import type { BellSchedule } from '../../src/types/index.js';
import { MemoryCache } from '../cache/memoryCache.js';
import { config } from '../config.js';
import { parseBellSchedules } from '../parsers/bellParser.js';
import { fetchOfficial } from '../utils/fetchOfficial.js';
import { seedSchedules } from './seedSchedules.js';

const cache = new MemoryCache<BellSchedule[]>(config.bellCacheMs);

async function loadLive() {
  const html = await fetchOfficial(config.bellUrl, 'text/html,application/xhtml+xml', 'html');
  const parsed = parseBellSchedules(html, config.bellPageUrl);
  if (!parsed.length) throw new Error('Bell parser found no usable schedules');
  return parsed;
}

export async function getBellSchedules(force = false) {
  try {
    const result = await cache.getOrRefresh(loadLive, force);
    const mode = result.stale ? 'cached-live' : 'live';
    return { schedules: result.value.map(s => ({ ...s, dataMode: mode })), sourceAvailable: result.sourceAvailable, stale: result.stale, fallback: false };
  } catch (error) {
    return { schedules: seedSchedules, sourceAvailable: false, stale: true, fallback: true, error: error instanceof Error ? error.message : String(error) };
  }
}
export function bellStatus() { return cache.snapshot(); }
