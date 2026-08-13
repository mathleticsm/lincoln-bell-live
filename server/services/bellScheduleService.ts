import type { BellSchedule, SourceMode } from '../../src/types/index.js';
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
    const mode: BellSchedule['dataMode'] = result.stale ? 'cached' : 'live';
    return { schedules: result.value.map(s => ({ ...s, dataMode: mode })), sourceAvailable: result.sourceAvailable, stale: result.stale, fallback: false };
  } catch (error) {
    return { schedules: seedSchedules, sourceAvailable: false, stale: true, fallback: true, error: error instanceof Error ? error.message : String(error) };
  }
}
export function bellStatus() { return cache.snapshot(); }
export function bellSourceMode(result: { sourceAvailable: boolean; stale: boolean; fallback: boolean }): Exclude<SourceMode, 'browser-cache'> {
  if (result.fallback) return 'fallback';
  if (!result.sourceAvailable || result.stale) return 'cached';
  return 'live';
}
