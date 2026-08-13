import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <main className="not-found"><div className="card"><p className="kicker">404 · Not found</p><h1>This page isn’t on today’s schedule.</h1><p>The link may be outdated, but the live schedule is still available.</p><Link className="primary-button" to="/">Go to Today</Link></div></main>;
}
