import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { config } from './config.js';
import { getBellSchedules, bellStatus } from './services/bellScheduleService.js';
import { getEvents, calendarStatus } from './services/calendarService.js';
import { resolveSchoolDay } from './services/schoolDayService.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '32kb' }));

function parseDateOnly(value: unknown, fallback: DateTime) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return DateTime.invalid('Expected YYYY-MM-DD');
  return DateTime.fromISO(value, { zone: config.timezone });
}

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'lincoln-bell-live' });
});

app.get('/api/bell-schedules', async (_req, res) => {
  const result = await getBellSchedules(false);
  res.json({
    data: result.schedules,
    meta: {
      sourceAvailable: result.sourceAvailable,
      stale: result.stale,
      fallback: result.fallback,
      fetchedAt: result.schedules[0]?.fetchedAt
    }
  });
});

app.get('/api/events', async (req, res) => {
  const defaultStart = DateTime.now().setZone(config.timezone).startOf('month');
  const parsedStart = parseDateOnly(req.query.start, defaultStart);
  const parsedEnd = parseDateOnly(req.query.end, parsedStart.isValid ? parsedStart.endOf('month') : defaultStart.endOf('month'));
  const spanDays = parsedStart.isValid && parsedEnd.isValid
    ? Math.floor(parsedEnd.startOf('day').diff(parsedStart.startOf('day'), 'days').days) + 1
    : Number.POSITIVE_INFINITY;
  if (!parsedStart.isValid || !parsedEnd.isValid || parsedEnd.toMillis() < parsedStart.toMillis() || spanDays > 370) {
    return res.status(400).json({ error: 'Invalid date range; use YYYY-MM-DD and a maximum span of 370 calendar days.' });
  }

  const result = await getEvents(false);
  if (!result.sourceAvailable && result.events.length === 0) {
    return res.status(503).json({ error: 'Lincoln calendar source is unavailable and no server-cached calendar data is available.' });
  }
  const rangeStart = parsedStart.startOf('day');
  const rangeEnd = parsedEnd.startOf('day').plus({ days: 1 });
  const matchingEvents = result.events.filter(event => {
    const start = DateTime.fromISO(event.start, { zone: config.timezone });
    if (!start.isValid) return false;
    const end = event.end ? DateTime.fromISO(event.end, { zone: config.timezone }) : undefined;
    if (end && !end.isValid) return false;
    if (!end) return start.toMillis() >= rangeStart.toMillis() && start.toMillis() < rangeEnd.toMillis();
    return start.toMillis() < rangeEnd.toMillis() && end.toMillis() > rangeStart.toMillis();
  });
  const events = matchingEvents.slice(0, 2000);

  res.json({
    data: events,
    meta: {
      sourceAvailable: result.sourceAvailable,
      stale: result.stale,
      parserMode: result.parserMode,
      fetchedAt: calendarStatus().fetchedAt,
      truncated: matchingEvents.length > events.length,
      returned: events.length
    }
  });
});

app.get('/api/today', async (req, res) => {
  const now = DateTime.now().setZone(config.timezone);
  const date = parseDateOnly(req.query.date, now);
  if (!date.isValid) return res.status(400).json({ error: 'Invalid date; use YYYY-MM-DD.' });

  const [bells, calendar] = await Promise.all([getBellSchedules(false), getEvents(false)]);
  const calendarState = calendar.sourceAvailable
    ? (calendar.stale ? 'cached-live' : 'live')
    : (calendar.events.length ? 'cached-live' : 'unavailable');
  const bellState = bells.fallback ? 'seed-fallback' : bells.stale ? 'cached-live' : 'live';

  const resolutionTime = date.toISODate() === now.toISODate() ? now : date.startOf('day');
  const result = resolveSchoolDay(resolutionTime, calendar.events, bells.schedules, { bell: bellState, calendar: calendarState });
  if (!calendar.sourceAvailable && calendar.events.length === 0) {
    if (result.status === 'weekend') {
      result.warnings.push("Lincoln's live calendar source is unavailable, so official weekend events may be missing.");
    } else {
      result.schedule = undefined;
      result.scheduleType = undefined;
      result.scheduleName = undefined;
      result.periods = [];
      result.status = 'unknown';
      result.warnings.push("Lincoln's live calendar source is unavailable and no last-known-good calendar is available. Today's exact bell schedule cannot be verified.");
    }
  } else if (!calendar.sourceAvailable) {
    result.warnings.push("Lincoln's live calendar source is temporarily unavailable. Showing last-known-good calendar data.");
  }

  if (!bells.sourceAvailable) {
    result.warnings.push(bells.fallback
      ? "Lincoln's live bell source is unavailable. Showing bundled fallback times that may be stale."
      : "Lincoln's live bell source is temporarily unavailable. Showing the latest successfully retrieved schedule.");
  }

  const successfulSourceTimes = [bellStatus().fetchedAt, calendarStatus().fetchedAt]
    .filter((value): value is string => Boolean(value))
    .sort();
  // Report the older successful source timestamp so the combined freshness label never overstates recency.
  result.sourceUpdatedAt = successfulSourceTimes.at(0);

  res.json({ data: result });
});

let lastManualRefresh = 0;
app.post('/api/refresh', rateLimit({ windowMs: 60_000, limit: 4, standardHeaders: true, legacyHeaders: false }), async (_req, res) => {
  const now = Date.now();
  if (now - lastManualRefresh < config.refreshCooldownMs) {
    return res.status(429).json({ error: 'Live-source refresh is cooling down. Please try again shortly.' });
  }
  lastManualRefresh = now;
  const [bells, calendar] = await Promise.all([getBellSchedules(true), getEvents(true)]);
  res.json({
    ok: true,
    bell: { sourceAvailable: bells.sourceAvailable, stale: bells.stale },
    calendar: { sourceAvailable: calendar.sourceAvailable, stale: calendar.stale }
  });
});

app.get('/api/status', (_req, res) => res.json({
  ok: true,
  service: 'lincoln-bell-live',
  version: process.env.npm_package_version || '1.0.0',
  timezone: config.timezone,
  uptimeSeconds: Math.floor(process.uptime()),
  bell: { ...bellStatus(), parserMode: 'html' },
  calendar: calendarStatus(),
  now: new Date().toISOString()
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, '../client');
app.use(express.static(clientDir, {
  setHeaders(res, file) {
    const normalized = file.split(path.sep).join('/');
    if (normalized.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled request error:', error instanceof Error ? error.message : 'Unknown error');
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Internal server error.' });
  return res.status(500).type('text/plain').send('Internal server error.');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', () => console.log(`Lincoln Bell Live listening on ${config.port}`));
}

export { app };
