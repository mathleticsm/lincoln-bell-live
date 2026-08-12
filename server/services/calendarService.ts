import type { SchoolEvent } from '../../src/types/index.js';
import { MemoryCache } from '../cache/memoryCache.js';
import { config } from '../config.js';
import { parseEventsHtml, parseIcsEvents } from '../parsers/calendarParser.js';
import { fetchOfficial } from '../utils/fetchOfficial.js';

const cache = new MemoryCache<SchoolEvent[]>(config.eventCacheMs);
let parserMode: 'ics' | 'html' | 'unknown' = 'unknown';

async function loadLive() {
  try {
    const ics = await fetchOfficial(config.eventsIcsUrl, 'text/calendar,text/plain;q=0.9,*/*;q=0.5', 'calendar');
    const events = parseIcsEvents(ics, config.eventsPageUrl);
    if (!events.length) throw new Error('ICS parser returned no events');
    parserMode = 'ics';
    return events;
  } catch (icsError) {
    const html = await fetchOfficial(config.eventsPageUrl, 'text/html,application/xhtml+xml', 'html');
    const events = parseEventsHtml(html, config.eventsPageUrl);
    if (!events.length) throw new Error(`Calendar unavailable (ICS: ${icsError instanceof Error ? icsError.message : String(icsError)})`);
    parserMode = 'html';
    return events;
  }
}

export async function getEvents(force = false) {
  try {
    const result = await cache.getOrRefresh(loadLive, force);
    return { events: result.value, sourceAvailable: result.sourceAvailable, stale: result.stale, parserMode };
  } catch (error) {
    return { events: [] as SchoolEvent[], sourceAvailable: false, stale: true, parserMode, error: error instanceof Error ? error.message : String(error) };
  }
}
export function calendarStatus() { return { ...cache.snapshot(), parserMode }; }
