# Lincoln Bell Live

Lincoln Bell Live is an independent, mobile-first schedule utility for Lincoln High School in Los Angeles. It retrieves official bell schedules and school calendar data on the server, normalizes them into JSON, determines the school-day schedule, and calculates the current period/countdown locally in the browser using `America/Los_Angeles`.

## Features

- Live bell schedules parsed from Lincoln's official printer-friendly page
- ICS-first school calendar with HTML fallback
- Shared in-memory caching, request de-duplication, and short outage retry backoff
- Last-known-good runtime data plus clearly labeled bundled bell fallback
- Odd/Even day detection and user-facing pair transformation
- Minimum-day, weekday schedule, no-school, weekend, and unknown-special-schedule handling
- One-second drift-resistant browser countdown and passing-period state
- Month + agenda calendar, event details, dark/light/system themes, PWA manifest, responsive UI
- Express security headers, rate limits, bounded date queries, fixed outbound source allowlist
- `/health`, `/api/status`, `/api/today`, `/api/events`, `/api/bell-schedules`, manual refresh endpoint

## Official data sources

- Bell schedules: `https://www.lincolnhs.org/apps/bell_schedules/printerfriendly.jsp`
- Bell schedule source page: `https://www.lincolnhs.org/apps/bell_schedules/`
- Calendar ICS: `https://www.lincolnhs.org/apps/events/ical/?id=0`
- Calendar HTML fallback: `https://www.lincolnhs.org/apps/events/`

No Lincoln or LAUSD logo is bundled. The app does not iframe the school site and does not expose an arbitrary proxy endpoint.

## Local development

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies API requests to Express on port 3000.

## Production build

On the first install from this delivered ZIP (which intentionally has no fabricated lockfile), run:

```bash
npm install
npm run typecheck
npm test
npm run build
npm start
```

Then open `http://localhost:3000`. The first `npm install` creates `package-lock.json`; commit it, and use `npm ci` on subsequent clean CI/deployment installs if you prefer reproducible lockfile-only installs.

## Environment variables

All variables have safe defaults. Copy `.env.example` only if you want overrides.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express port; Render supplies this automatically |
| `BELL_SCHEDULE_URL` | official printer page | Bell source |
| `BELL_SOURCE_PAGE_URL` | official bell page | Attribution link |
| `EVENTS_ICS_URL` | official ICS feed | Preferred calendar source |
| `EVENTS_PAGE_URL` | official calendar page | HTML fallback / attribution |
| `SCHOOL_TIMEZONE` | `America/Los_Angeles` | Must remain `America/Los_Angeles`; other values are ignored for safety |
| `BELL_CACHE_MINUTES` | `20` | Bell TTL |
| `EVENT_CACHE_MINUTES` | `10` | Calendar TTL |
| `SOURCE_TIMEOUT_MS` | `10000` | Source fetch timeout |
| `MANUAL_REFRESH_COOLDOWN_SECONDS` | `60` | Shared refresh cooldown |

## API

- `GET /health` — cheap process-alive check; never fetches Lincoln
- `GET /api/bell-schedules` — normalized official schedules + cache/fallback metadata
- `GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD` — normalized events, max 370-day range
- `GET /api/today` — resolved current school day and transformed periods
- `GET /api/today?date=YYYY-MM-DD` — inspect another date
- `GET /api/status` — cache/parser/source diagnostics without secrets
- `POST /api/refresh` — responsibly force a shared source refresh; rate-limited and cooldown-protected

## Render deployment (Free web service)

The included `render.yaml` defines one Node web service with `plan: free`, an explicit build-dependency install (`npm install --include=dev && npm run build && npm prune --omit=dev`), `npm start`, and `/health` as the health check. The explicit `--include=dev` is important because the Render service sets `NODE_ENV=production` while Vite and tsup are build-time dev dependencies.

Current Render documentation should always be rechecked before deployment. As verified August 11, 2026, Free web services spin down after 15 minutes without inbound traffic, spin back up on the next request, use an ephemeral filesystem, and a workspace receives 750 Free instance hours per calendar month. Render explicitly describes Free instances as suitable for hobby/testing rather than production workloads. This project therefore stores no required state on disk and recovers its live cache after restart/cold start.

Manual dashboard flow:

1. Push this repository to GitHub.
2. In Render, choose **New → Web Service**.
3. Connect GitHub and select the repository.
4. Runtime: **Node**.
5. Instance type: **Free**.
6. Build command: `npm install --include=dev && npm run build && npm prune --omit=dev`.
7. Start command: `npm start`.
8. Health check path: `/health`.
9. Deploy. Render supplies `PORT`; do not hardcode a production port.

You can also create a Blueprint from the included `render.yaml`.

## UptimeRobot Free monitoring

As verified August 11, 2026, UptimeRobot's Free plan lists 50 monitors and a 5-minute monitoring interval. Create an HTTP(s) monitor with:

- Friendly name: `Lincoln Bell Live`
- URL: `https://YOUR-SERVICE.onrender.com/health`
- Interval: **5 minutes** (fastest currently listed for Free)
- Alerts: attach the email/mobile integration(s) available on your account

Health checks are legitimate availability monitoring, but they are still inbound traffic. On Render Free, that traffic can affect whether the service becomes idle, and a running Free instance consumes the workspace's monthly Free instance hours. UptimeRobot does not bypass Render limits or guarantee permanent 24/7 free hosting.

## GitHub

```bash
git init
git add .
git commit -m "Build Lincoln Bell Live"
git branch -M main
git remote add origin https://github.com/YOUR-USER/lincoln-bell-live.git
git push -u origin main
```

A permissive license such as MIT is a reasonable choice for this independent utility if that matches your intentions; no license file is imposed automatically because license selection is a project-owner decision.

## Troubleshooting

- **Live bell source down:** `/api/bell-schedules` serves last-known-good cache, then the bundled fallback only if no successful runtime fetch exists. The UI labels fallback data as potentially stale.
- **Calendar feed down:** the service tries the official HTML calendar. If both fail, server last-known-good data is served when available. With no server cache, `/api/events` returns 503 so the browser can preserve its own last-known-good month; `/api/today` withholds an unverified weekday schedule rather than guessing.
- **Special schedule without published bell times:** exact times are withheld rather than guessed.
- **Render cold start:** the first request can be delayed while the Free service spins up; source caches repopulate after process start.
- **Lincoln outage:** failed refreshes use a short in-memory retry backoff, preventing ordinary visitor traffic from repeatedly retrying the official site while it is down.
- **Offline PWA:** static shell assets are pre-cached on service-worker installation, but live API responses are intentionally never stored by the service worker; browser last-known-good UI caches provide the offline schedule/calendar fallback.
- **Wrong time:** verify `SCHOOL_TIMEZONE=America/Los_Angeles`; server machine timezone is intentionally irrelevant.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
NODE_ENV=production npm start
```

Then check `/health`, `/api/status`, `/api/bell-schedules`, `/api/events`, and `/api/today`.
