# Verification record

A full QA/fix pass was completed on 2026-08-11 in `America/Los_Angeles`.

## Verification status

| Check | Status | Notes |
|---|---|---|
| Repository/source audit | PASS | All application, server, PWA, test, and deployment files re-inspected. |
| TypeScript/TSX syntax | PASS | 35 `.ts`/`.tsx` files transpiled with the globally available TypeScript compiler. |
| Local imports | PASS | All relative imports resolve to repository files. |
| JSON / Render YAML | PASS | Configuration files parse successfully. |
| Public JavaScript syntax | PASS | Service worker, theme bootstrap, and ESLint config pass `node --check`. |
| CSS parse | PASS | `src/styles/main.css` parses successfully with PostCSS. |
| Unsafe / unfinished source scan | PASS | No `TODO`/`FIXME`/`HACK`, `dangerouslySetInnerHTML`, `eval`, or `javascript:` URL was found in application source. |
| PWA icon sizes | PASS | 192×192 and 512×512 PNG assets verified. |
| Current Lincoln bell source | VERIFIED | Four currently published schedule families and their times still match parser validation/seed data. |
| Current Lincoln calendar patterns | VERIFIED | Current calendar includes Pupil Free Day, ODD/EVEN markers, and Advisory-first markers handled by the resolver. |
| Dependency-backed lint/typecheck/tests/build | BLOCKED HERE | The sandbox cannot resolve `registry.npmjs.org`; dependency installation times out. |
| Production server/API smoke test | BLOCKED HERE | Requires the dependencies/build that cannot be installed in this sandbox. |

A failed `npm install --include=dev` was retried during this QA pass and timed out at the registry/network layer. The repository therefore does **not** claim that Vitest, Vite, tsup, ESLint, or the dependency-aware TypeScript checker executed successfully here.

## Correctness and reliability fixes

- Date-scoped browser caching prevents yesterday's `/api/today` response from surviving Los Angeles midnight as today's schedule.
- The calendar's today highlight also rolls over at Los Angeles midnight without requiring navigation.
- Countdown math recalculates from the real timestamp and uses ceiling semantics, preventing one-second-early displays and timer drift.
- All calendar overlap checks now use half-open intervals, so events ending exactly at midnight do not leak into the next day.
- Multi-day and overnight event labels show `Until …` / `Ongoing` correctly on continuation days, and the event dialog shows accurate end dates/times.
- All-day events with no explicit end are still labeled `All day`.
- Month-grid Sunday math is corrected, calendar request races are ignored after navigation, and old-month events are cleared before a new load.
- `/api/events` defaults to the requested current month instead of accidentally spanning almost two months.
- `/api/events` now enforces a true maximum of 370 calendar days.
- `/api/events` returns 503 when both Lincoln calendar sources are unavailable and no server last-known-good exists, allowing the browser to preserve its own last-known-good rather than overwrite it with a false empty calendar.
- Ordinary events are separated from `/api/today.specialEvents`; only schedule/day-affecting calendar entries are returned there while `allEvents` keeps the complete day agenda.
- Unknown frontend routes redirect to Today instead of rendering an empty content area.

## School-day resolver fixes

- ODD and EVEN title matching is normalized for punctuation/case and avoids substring accidents.
- Conflicting official ODD and EVEN markers return `unknown` with a warning rather than guessing.
- Pair labels transform only when day type is known (`1/2 → 1 or 2`, etc.).
- Weekend state remains distinct from calendar-derived no-school state.
- Pupil Free Day, explicit No School/School Closed, recognized holidays, and date-suffixed official break/recess labels are treated conservatively as closures.
- Event names such as `Holiday Concert` and `Winter Break Concert` are not misclassified as closures.
- Minimum Day overrides the weekday schedule.
- Advisory-first and other special-schedule markers use a matching published Lincoln schedule only if one exists; otherwise exact times are withheld with a warning.
- Calendar cold-start failure no longer allows an ordinary weekday schedule to be presented as verified.

## Parser and source-safety fixes

- Bell schedules are rejected if periods overlap, run backward, contain invalid times, or produce non-positive durations.
- The live bell service accepts any non-empty future published schedule set instead of requiring the current four families.
- Known current schedules remain available only as a clearly marked last-resort seed fallback.
- `node-ical` parameterized text properties (`SUMMARY;LANGUAGE=…`, description, location) are normalized correctly.
- Recurrence overrides read override description/location from the expanded instance's VEVENT object.
- Recurrence expansion respects EXDATE/overrides and has bounded horizons/maximum output.
- Extremely high-frequency recurrence rules are rejected so the service can fall back to the official HTML calendar instead of expanding untrusted minute/hour recurrence floods.
- HTML fallback handles overnight times and produces distinct IDs for same-title events at different times.
- Outbound configuration is clamped to HTTPS `www.lincolnhs.org` URLs only.
- Source fetches reject redirects, enforce a 5 MB response cap, validate HTML/calendar response shape, use timeouts/retry, and never expose an arbitrary proxy.

## Cache, API, security, and deployment fixes

- Shared in-memory caches deduplicate simultaneous refreshes.
- Failed refreshes preserve last-known-good data and mark it stale/source-unavailable.
- A short failure backoff prevents sequential visitor traffic from repeatedly hammering Lincoln during an outage.
- Combined freshness uses the **older** successful bell/calendar timestamp so the UI never overstates recency.
- Manual Refresh reports actual source availability rather than claiming success when only cached/fallback data remains.
- `/api/*` unknown routes return JSON 404 rather than the React shell.
- A sanitized final Express error handler prevents raw errors from reaching clients.
- CSP/Helmet, API rate limits, bounded JSON input, and fixed-origin source fetching remain enabled.
- Only hashed Vite `/assets/` receive immutable one-year HTTP caching; the shell/service worker/theme bootstrap are revalidated.
- The service worker never caches `/api/*` or `/health` and now discovers/pre-caches the built Vite JS/CSS during installation, so the app shell can boot offline after the first successful visit.
- Service-worker ESLint globals are scoped to the service-worker environment rather than ordinary browser globals.
- Render's build command explicitly installs dev dependencies before Vite/tsup even though the service uses `NODE_ENV=production`.
- Browser, server, and test TypeScript configurations are split so their module-resolution requirements do not conflict.
- Dependency floors were raised to current patched lines reviewed during this QA pass, including Vite, the Vite React plugin compatible with Vite 7, Express, Helmet, express-rate-limit, and React Router v7.

## Required full verification on a normal network

The delivered ZIP intentionally has no fabricated `package-lock.json`. On a machine that can reach npm, run:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
NODE_ENV=production npm start
```

Then verify:

```text
http://localhost:3000/
http://localhost:3000/health
http://localhost:3000/api/status
http://localhost:3000/api/bell-schedules
http://localhost:3000/api/events
http://localhost:3000/api/today
```

Commit the real `package-lock.json` generated by the first successful `npm install`; after that, clean CI/deployments can use `npm ci` if desired.
