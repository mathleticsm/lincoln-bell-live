# Lincoln Bell Live Verification

Verified locally on August 12, 2026 in `America/Los_Angeles`.

## Environment

- Node.js: `v24.18.0`
- npm: `12.0.1`
- Production command: `node dist/server/index.js`
- Production bind: `0.0.0.0:3000`
- Browser: Codex in-app Chromium browser

## Clean install and security

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities |
| Lockfile generated and reproducible | PASS |

The compatible `esbuild` override removes the development-server advisory inherited through the build toolchain. The full command suite passes with the override.

## Automated QA

| Command | Result |
|---|---|
| `npm run lint` | PASS — no warnings or errors |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 9 files, 84 tests |
| `npm run build` | PASS |

Test coverage includes:

- realistic current Lincoln bell HTML and ICS fixtures;
- dynamic schedule discovery and wrapper-heading exclusion;
- invalid time, backwards-row, overlap, and duplicate-schedule rejection;
- all Odd/Even period-pair transformations;
- weekday selection, weekends, closures, Minimum Day, and unpublished special schedules;
- next-school-day lookahead across weekends, holidays, and pupil-free days;
- countdown start/end/passing/lunch/advisory/nutrition boundaries;
- all-day exclusive `DTEND`, multi-day, overnight, and midnight event coverage;
- recurrence, `EXDATE`, parameterized text, duplicate handling, and HTML fallback;
- individual calendar export escaping and UTC conversion;
- LA date selection and spring/fall DST offsets;
- cache last-known-good behavior and failure backoff;
- `/health`, JSON API 404s, and invalid event-range rejection.

## Production server and API smoke test

The production Vite build was served by Express after `npm start` semantics, not by the Vite dev server.

| Route | Status | Content type | Result |
|---|---:|---|---|
| `/health` | 200 | `application/json` | PASS |
| `/api/status` | 200 | `application/json` | PASS |
| `/api/bell-schedules` | 200 | `application/json` | PASS — live, 4 official schedules |
| `/api/events` | 200 | `application/json` | PASS — live ICS, 22 current-range events |
| `/api/today` | 200 | `application/json` | PASS — Odd special schedule, zero invented periods |
| unknown `/api/*` | 404 | `application/json` | PASS |
| `/` | 200 | `text/html` | PASS |
| `/bells` | 200 | `text/html` | PASS |
| `/calendar` | 200 | `text/html` | PASS |
| `/about` | 200 | `text/html` | PASS |
| unknown frontend path | 200 shell + React 404 | `text/html` | PASS |

Live diagnostics after source loading reported:

- Bell schedules: `live`, parser `Official HTML`
- Calendar: `live`, parser `Official ICS`
- Current official special event: `ADVISORY 1ST: ODD DAY`
- Current exact periods: `0` because Lincoln has not published a matching schedule

## Browser QA

### Responsive layout

Tested Today at widths `360`, `375`, `390`, `412`, and `430` px. Every width passed without horizontal overflow. At phone widths:

- top navigation is hidden;
- fixed icon-and-label bottom navigation is visible;
- safe-area bottom padding is applied;
- the special-day hero remains readable;
- the month calendar uses 44 px date buttons and event dots;
- selected-day event titles remain full-size below the grid.

Desktop was verified at 1280 px with centered content, top navigation, hidden bottom navigation, and no horizontal overflow.

### Routes and controls

- Today, Bells, Calendar, and About navigation: PASS
- Direct browser refresh on `/bells`, `/calendar`, and `/about`: PASS
- React Not Found screen and return-to-Today link: PASS
- Data-source drawer with live timestamps, parsers, and official links: PASS
- Special-schedule explanation disclosure: PASS
- Event dialog focusable/closable with Copy details: PASS
- Clipboard success status: PASS
- Bell dismissal comparison: PASS
- Calendar month/agenda toggle: PASS
- Calendar local search: PASS
- Manual source refresh: PASS — `Live sources refreshed.` only after both sources returned live
- Browser console: PASS — no warnings or errors

### Theme and offline behavior

- Light: PASS
- Dark: PASS
- System: PASS; current system preference resolved to dark
- Static theme bootstrap before React: PASS
- Offline shell: PASS after stopping only the local production server
- Offline Today device cache: PASS with `Offline · device cache` and explicit warning
- Live recovery after server restart: PASS

## Bugs found during this pass

1. Server TypeScript widened the live/cached `dataMode` string and failed strict typecheck.
2. The live bell parser did not read Lincoln’s current table `<caption>` titles and fell back despite a reachable official page.
3. Prose such as “All SLCs share the same bell schedule” could be selected as a schedule name.
4. An all-day event without `DTEND` was treated as continuing forever, breaking next-school-day lookup.
5. The event API used inclusive end-date semantics instead of a clear half-open range.
6. Source diagnostics exposed internal cache shape rather than a sanitized public status model.
7. The existing frontend contained partial UX and lacked working search, export, copy, next-day context, mobile bottom navigation, source details, and install gating.

All listed bugs are corrected and covered where practical by regression tests.

## Remaining manual/environment-specific checks

- The browser install prompt appears only on a supported installable browser; the test browser did not emit `beforeinstallprompt`, so no fake Install App button was shown.
- Browser notification reminders were intentionally not added because they were optional and reliable background delivery was outside this stateless deployment.
- A production Lighthouse run and physical iOS Safari/Android Chrome device pass remain useful after deployment, though responsive Chromium and offline PWA behavior passed locally.
