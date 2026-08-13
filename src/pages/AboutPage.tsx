import { Clock3, DatabaseZap, ExternalLink, ShieldCheck, UserRoundX } from 'lucide-react';

export function AboutPage() {
  return <main>
    <div className="page-title"><p className="kicker">Independent student utility</p><h1>About Lincoln Bell Live</h1><p>A fast, mobile-first way to understand Lincoln High School’s official schedule and calendar.</p></div>
    <div className="about-grid">
      <article className="card"><DatabaseZap/><h2>Official data first</h2><p>The server retrieves Lincoln’s published bell schedules and event calendar, normalizes them, and shares short-lived cached data with all visitors.</p></article>
      <article className="card"><Clock3/><h2>Los Angeles time</h2><p>Every school-day decision uses America/Los_Angeles so daylight-saving changes and server location do not shift the schedule.</p></article>
      <article className="card"><ShieldCheck/><h2>Conservative by design</h2><p>If a special schedule appears without matching published bell times, the app explains the uncertainty instead of guessing.</p></article>
      <article className="card"><UserRoundX/><h2>Private by default</h2><p>Lincoln Bell Live does not require accounts, collect school credentials, track location, or use behavioral analytics.</p></article>
    </div>
    <section className="card about-details"><h2>Live, cached, and fallback data</h2><p><strong>Verified live</strong> means the server successfully reached Lincoln’s official source. <strong>Cached</strong> means a recent successful copy is shown during an upstream problem. <strong>Fallback</strong> applies only to bundled bell times and is always labeled because it may become stale. Calendar data has no fabricated fallback.</p><p>The live source indicator on Today opens detailed freshness and parser information.</p></section>
    <section className="card about-source"><h2>Official sources</h2><a className="source-link" href="https://www.lincolnhs.org/apps/bell_schedules/" target="_blank" rel="noreferrer">Lincoln bell schedules <ExternalLink size={15}/></a><a className="source-link" href="https://www.lincolnhs.org/apps/events/" target="_blank" rel="noreferrer">Lincoln events calendar <ExternalLink size={15}/></a></section>
    <p className="disclaimer">Lincoln Bell Live is an independent utility. It is not endorsed by or affiliated with Lincoln High School, LAUSD, or their administrators.</p>
  </main>;
}
