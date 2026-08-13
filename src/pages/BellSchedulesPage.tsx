import { useEffect, useState } from 'react';
import { ArrowUpRight, Columns3 } from 'lucide-react';
import type { BellSchedule } from '../types';
import { api } from '../lib/api';

const CACHE_KEY = 'lincoln-bell-live:bells';
type CachedBellResponse = { data: BellSchedule[]; meta?: Record<string, unknown> };

function modeLabel(mode: BellSchedule['dataMode']) {
  if (mode === 'live') return 'Verified live';
  if (mode === 'cached') return 'Cached';
  return 'Fallback · may be stale';
}

export function BellSchedulesPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const [schedules, setSchedules] = useState<BellSchedule[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [offline, setOffline] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    api.schedules().then(response => {
      if (!active) return;
      setSchedules(response.data);
      setMeta(response.meta || {});
      setOffline(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(response)); } catch { /* Browser storage is optional. */ }
    }).catch(errorValue => {
      if (!active) return;
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedBellResponse;
          if (Array.isArray(parsed.data) && parsed.data.length) {
            setSchedules(parsed.data); setMeta(parsed.meta || {}); setOffline(true); return;
          }
        }
      } catch { /* Ignore corrupt or unavailable browser storage. */ }
      setSchedules([]); setMeta({}); setOffline(false);
      setError(errorValue instanceof Error ? errorValue.message : 'Could not load bell schedules.');
    });
    return () => { active = false; };
  }, [refreshToken]);

  return <main>
    <div className="page-title page-title-actions"><div><p className="kicker">Official bell times</p><h1>Bell Schedules</h1><p>Automatically parsed from Lincoln High School’s published schedule page.</p></div>{schedules.length > 1 && <button className="secondary-button" aria-expanded={showComparison} onClick={() => setShowComparison(value => !value)}><Columns3 size={17}/>{showComparison ? 'Hide comparison' : 'Compare dismissal'}</button>}</div>
    {error && <div className="error-card">Couldn’t load bell schedules. {error}</div>}
    {offline && <div className="warning">You’re offline. Showing the most recently loaded bell schedules from this device.</div>}
    {Boolean(meta.fallback) && <div className="warning">Lincoln’s live bell source is unavailable. These are bundled fallback times and may be stale.</div>}
    {meta.sourceAvailable === false && !meta.fallback && <div className="warning">Lincoln’s live bell source is temporarily unavailable. Showing the latest successful update.</div>}
    {showComparison && <section className="card comparison-card"><div className="section-head"><div><p className="kicker">At a glance</p><h2>Dismissal comparison</h2></div></div><div className="comparison-grid">{schedules.map(schedule => <div key={schedule.id}><strong>{schedule.name}</strong><span>{schedule.periods.at(-1)?.endTime || 'Not published'}</span></div>)}</div></section>}
    <div className="schedule-grid">{schedules.map(schedule => <article className="card schedule-card" key={schedule.id}>
      <div className="section-head"><div><h2>{schedule.name}</h2>{schedule.description && <p>{schedule.description}</p>}</div><span className={`mode ${schedule.dataMode}`}>{modeLabel(schedule.dataMode)}</span></div>
      <div className="schedule-table" role="table" aria-label={schedule.name}>{schedule.periods.map(period => <div role="row" className="schedule-row" key={`${period.rawName}-${period.startTime}`}><strong role="cell">{period.rawName}</strong><span role="cell">{period.startTime} – {period.endTime}</span><small role="cell">{period.durationMinutes} min</small></div>)}</div>
      <a className="source-link" href={schedule.sourceUrl} target="_blank" rel="noreferrer">View official source <ArrowUpRight size={15}/></a>
    </article>)}</div>
  </main>;
}
