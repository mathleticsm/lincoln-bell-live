const LINCOLN_HOST = 'www.lincolnhs.org';

function envNumber(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function lincolnUrl(name: string, fallback: string) {
  const raw = process.env[name] || fallback;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.hostname === LINCOLN_HOST && !url.username && !url.password) return url.toString();
  } catch {
    // Invalid overrides fall back to the known official source.
  }
  return fallback;
}

export const config = {
  port: envNumber('PORT', 3000, 1, 65_535),
  bellUrl: lincolnUrl('BELL_SCHEDULE_URL', 'https://www.lincolnhs.org/apps/bell_schedules/printerfriendly.jsp'),
  bellPageUrl: lincolnUrl('BELL_SOURCE_PAGE_URL', 'https://www.lincolnhs.org/apps/bell_schedules/'),
  eventsIcsUrl: lincolnUrl('EVENTS_ICS_URL', 'https://www.lincolnhs.org/apps/events/ical/?id=0'),
  eventsPageUrl: lincolnUrl('EVENTS_PAGE_URL', 'https://www.lincolnhs.org/apps/events/'),
  timezone: process.env.SCHOOL_TIMEZONE === 'America/Los_Angeles' ? process.env.SCHOOL_TIMEZONE : 'America/Los_Angeles',
  bellCacheMs: envNumber('BELL_CACHE_MINUTES', 20, 1, 24 * 60) * 60_000,
  eventCacheMs: envNumber('EVENT_CACHE_MINUTES', 10, 1, 24 * 60) * 60_000,
  timeoutMs: envNumber('SOURCE_TIMEOUT_MS', 10_000, 1_000, 60_000),
  refreshCooldownMs: envNumber('MANUAL_REFRESH_COOLDOWN_SECONDS', 60, 10, 3600) * 1000,
  userAgent: 'LincolnBellLive/1.0 (+independent student schedule utility; source lincolnhs.org)'
};
