# Lincoln Bell Live

Lincoln Bell Live is an independent, mobile-first schedule utility for Lincoln High School in Los Angeles. It turns Lincoln’s official bell schedules and calendar into a glanceable current-period experience without inventing information the school has not published.

Production: <https://lincoln-bell-live.onrender.com>

## What it does

- Shows the official Odd/Even day, current period, live countdown, passing period, next period, lunch, dismissal, and schedule progress.
- Handles weekends, explicit closures, Minimum Days, Professional Development Tuesdays, and unusual calendar-driven schedules.
- Presents a dedicated `SPECIAL SCHEDULE` state when the calendar confirms a schedule change but matching official bell times are absent.
- Finds the next school day across weekends, holidays, pupil-free days, closures, and special schedules.
- Parses Lincoln’s bell schedules dynamically rather than assuming a fixed number of published schedules.
- Uses the official ICS calendar first, with the official HTML calendar as a server-side fallback.
- Provides month and agenda calendar views, local search, accessible event details, copy, and individual `.ics` export.
- Supports dark, light, and system themes, installable PWA behavior, mobile bottom navigation, and offline device-cached data.
- Reports whether data is live, cached, fallback, unavailable, or loaded from the device cache.

## Architecture

```text
Browser (React + Vite)
  ├─ Today / Bells / Calendar / About
  ├─ second-level countdown isolated to the live hero
  ├─ local device cache for last-loaded API responses
  └─ service worker for the static app shell (never /api/*)

Express server
  ├─ fixed-origin Lincoln fetcher with timeout and size limits
  ├─ bell HTML parser
  ├─ ICS-first calendar parser with HTML fallback
  ├─ shared in-memory caches and request de-duplication
  ├─ deterministic school-day / next-school-day resolver
  └─ Vite production asset hosting and SPA fallback
```

The deployment is one stateless Node service. It requires no database, Redis instance, persistent disk, login, or paid API.

## Official data sources

- Bell schedules: <https://www.lincolnhs.org/apps/bell_schedules/printerfriendly.jsp>
- Bell schedule page: <https://www.lincolnhs.org/apps/bell_schedules/>
- Calendar ICS: <https://www.lincolnhs.org/apps/events/ical/?id=0>
- Calendar page / HTML fallback: <https://www.lincolnhs.org/apps/events/>

The browser never requests Lincoln directly. Server configuration accepts only HTTPS URLs on `www.lincolnhs.org`; there is no arbitrary proxy route.

## Correctness rules

Every school calculation uses `America/Los_Angeles`, including the school date, weekday, period boundaries, DST, event dates, and next-school-day lookahead.

Calendar priority is conservative:

1. Weekend
2. Explicit no-school event
3. Published matching special schedule, such as Minimum Day
4. Unusual schedule marker
5. Tuesday schedule
6. Monday/Wednesday schedule
7. Thursday/Friday schedule

If an unusual event such as `ADVISORY 1ST: ODD DAY` has no matching schedule on Lincoln’s official bell page, the app retains the known day type and calendar evidence but withholds all exact times.

## Local setup

Requirements: Node.js 22, 23, or 24 and npm.

```bash
npm ci
npm run dev
```

Vite runs at `http://localhost:5173` and proxies `/api` and `/health` to Express at `http://localhost:3000`.

## Scripts

```bash
npm run dev       # Express and Vite watch mode
npm run lint      # ESLint
npm run typecheck # browser, server, and test TypeScript projects
npm test          # Vitest
npm run build     # dist/client + dist/server
npm start         # production Express server
```

Production locally:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Open <http://localhost:3000>. Express serves both the API and the Vite production build.

## Environment variables

All variables have safe defaults. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express port; Render supplies this |
| `SCHOOL_TIMEZONE` | `America/Los_Angeles` | Other values are rejected |
| `BELL_SCHEDULE_URL` | official printer page | Allowlisted bell source |
| `BELL_SOURCE_PAGE_URL` | official bell page | Public source link |
| `EVENTS_ICS_URL` | official ICS feed | Preferred calendar source |
| `EVENTS_PAGE_URL` | official calendar | HTML fallback and source link |
| `BELL_CACHE_MINUTES` | `20` | Shared bell cache TTL |
| `EVENT_CACHE_MINUTES` | `10` | Shared calendar cache TTL |
| `SOURCE_TIMEOUT_MS` | `10000` | Per-attempt upstream timeout |
| `MANUAL_REFRESH_COOLDOWN_SECONDS` | `60` | Shared manual-refresh cooldown |

## API

| Route | Description |
|---|---|
| `GET /health` | Cheap process health; never contacts Lincoln |
| `GET /api/status` | Sanitized availability, parser, freshness, and cache diagnostics |
| `GET /api/bell-schedules` | Normalized schedules and source metadata |
| `GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD` | Events overlapping a half-open `[start, end)` range; max 370 days and 2,000 rows |
| `GET /api/today` | Current LA school date, resolved schedule, periods, source state, and next school day |
| `GET /api/today?date=YYYY-MM-DD` | Deterministic date inspection |
| `POST /api/refresh` | Rate-limited shared refresh of both official sources |

Unknown `/api/*` routes return JSON 404. Unknown frontend paths render an accessible Not Found screen while direct refreshes of `/bells`, `/calendar`, and `/about` work through the SPA fallback.

## Cache and source states

The server keeps one shared in-memory cache per source. Simultaneous requests share a single upstream fetch. Failed refreshes preserve last-known-good data and use a retry backoff so an outage does not cause every visitor to contact Lincoln.

- **Verified live**: the latest source request succeeded.
- **Cached**: the last successful official data is retained while the current source is unavailable.
- **Fallback**: bundled bell schedules are being used on a cold-start bell failure and may be stale.
- **Unavailable**: the calendar is unreachable and no last-known-good server cache exists.
- **Device cache**: the browser is offline or cannot reach the app server and is showing its last loaded response.

Render restarts lose in-memory cache by design. The server refetches on demand, uses only the labeled bell fallback if necessary, and never fabricates calendar events.

## PWA and offline behavior

The web manifest includes 192 px and 512 px icons plus Today, Calendar, and Bell Schedules shortcuts. The Install App control appears only after a browser exposes its install prompt and hides after installation or dismissal.

The service worker:

- discovers and caches Vite’s hashed JS/CSS plus the core shell;
- uses network-first navigation and static requests;
- never intercepts or permanently caches `/api/*` or `/health`;
- falls back to the cached app shell offline.

Loaded Today, Bells, and Calendar responses are also stored in browser storage. Offline copies are explicitly labeled and never presented as live.

## Security and privacy

- Helmet with a same-origin production CSP
- API rate limiting and bounded JSON input
- strict query validation and safe production errors
- fixed official hostname, HTTPS-only outbound fetching, redirects blocked
- 10-second default timeout and 5 MB source-response cap
- no `dangerouslySetInnerHTML`, source script execution, arbitrary fetch route, or exposed stack trace
- no accounts, credentials, student IDs, location tracking, behavioral profiling, or analytics

## Tests and CI

The test suite covers the realistic Lincoln HTML/ICS fixtures, dynamic bell discovery, invalid and duplicate schedules, Odd/Even transformation, closures and special schedules, countdown boundaries, next-school-day lookahead, recurrence and calendar boundaries, event export, LA/DST behavior, cache failures, and API validation.

`.github/workflows/ci.yml` runs on every push and pull request using Node 22:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Render deployment

`render.yaml` defines the single Free web service, Node 22, `npm ci --include=dev`, production build, dependency pruning, `npm start`, and `/health` health check. Express listens on `process.env.PORT` and `0.0.0.0`.

To deploy:

1. Commit all source changes, `.github/workflows/ci.yml`, and `package-lock.json`.
2. Push the branch connected to the Render service.
3. Let Render build from `render.yaml`.
4. Verify `/health`, `/api/status`, `/api/bell-schedules`, `/api/events`, and `/api/today` on the production hostname.

No filesystem data generated at runtime needs to be preserved.

## UptimeRobot

Create an HTTPS monitor for:

```text
https://lincoln-bell-live.onrender.com/health
```

Expect HTTP 200 and optionally alert when the JSON body no longer contains `"ok":true`. Monitor only `/health`; it is intentionally cheap and never triggers a Lincoln source request. Choose the interval according to the Render plan and desired cold-start behavior.

## Troubleshooting

- **Bell endpoint says fallback:** open `/api/status`, check the last attempt, then compare the official printer page. A parser regression should be reproduced by updating the minimal fixture, not bypassed with hardcoded data.
- **Calendar unavailable:** confirm the ICS URL first. The server automatically attempts the official HTML page if ICS parsing fails.
- **Manual refresh returns 429:** wait for the shared cooldown. Ordinary visitors continue using the shared cache.
- **A special day has no times:** this is intentional unless Lincoln publishes a matching schedule. Check the official calendar and bell page links shown in the app.
- **Offline page has no schedule:** load the route successfully once while online so the shell and device cache exist.
- **Theme flash:** ensure `/theme-init.js` remains in the document head before the React entry script.

## Disclaimer

Schedule and event information is sourced from the official Lincoln High School website. Lincoln Bell Live is an independent utility and is not an official Lincoln High School or LAUSD website.
