import { useEffect, useState } from 'react';
import { CircleAlert, Radio, WifiOff } from 'lucide-react';
import { api } from '../lib/api';
import type { SourceDiagnostics, SourceMode, StatusResponse } from '../types';

function ageLabel(iso?: string) {
  if (!iso || iso === 'bundled-fallback') return '';
  const milliseconds = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '';
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return 'updated just now';
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `updated ${hours}h ago`;
}

function summaryLabel(bell: SourceMode, calendar: SourceMode) {
  if (bell === 'browser-cache' || calendar === 'browser-cache') return 'Offline · device cache';
  if (bell === 'live' && calendar === 'live') return 'Verified live';
  if (bell === 'fallback') return 'Fallback schedule · may be stale';
  if (calendar === 'unavailable') return 'Calendar unavailable';
  return 'Cached · live source unavailable';
}

function SourceRow({ name, source }: { name: string; source: SourceDiagnostics }) {
  return <div className="source-row">
    <div><strong>{name}</strong><span className={`source-pill ${source.state}`}>{source.label}</span></div>
    <dl>
      <div><dt>Updated</dt><dd>{source.fetchedAt ? ageLabel(source.fetchedAt).replace('updated ', '') : source.state === 'fallback' ? 'Bundled copy' : 'No successful update'}</dd></div>
      <div><dt>Last attempt</dt><dd>{source.lastAttemptAt ? ageLabel(source.lastAttemptAt).replace('updated ', '') : 'Not attempted yet'}</dd></div>
      <div><dt>Parser</dt><dd>{source.parserMode}</dd></div>
    </dl>
    <a href={source.sourceUrl} target="_blank" rel="noreferrer">View official source</a>
  </div>;
}

export function DataStatus({ bell, calendar, updatedAt }: { bell: SourceMode; calendar: SourceMode; updatedAt?: string }) {
  const [, tick] = useState(0);
  const [status, setStatus] = useState<StatusResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const live = bell === 'live' && calendar === 'live';
  const offline = bell === 'browser-cache' || calendar === 'browser-cache';

  useEffect(() => {
    const id = window.setInterval(() => tick(value => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const loadStatus = () => {
    if (status || loading || offline) return;
    setLoading(true);
    api.status().then(setStatus).catch(errorValue => setError(errorValue instanceof Error ? errorValue.message : 'Status unavailable.')).finally(() => setLoading(false));
  };

  const Icon = offline ? WifiOff : live ? Radio : CircleAlert;
  return <details className={`data-status ${live ? 'live' : 'stale'}`} onToggle={event => { if (event.currentTarget.open) loadStatus(); }}>
    <summary><Icon size={14}/><span>{summaryLabel(bell, calendar)}</span>{updatedAt && <small>· {ageLabel(updatedAt)}</small>}</summary>
    <div className="status-popover">
      <div className="status-heading"><p className="kicker">Data sources</p><h2>Source status</h2></div>
      {loading && <p>Checking source details…</p>}
      {error && <p>{error}</p>}
      {offline && <p>You’re offline. The page is using the last data saved on this device.</p>}
      {status && <><SourceRow name="Bell schedules" source={status.bell}/><SourceRow name="Calendar" source={status.calendar}/><p className="status-note">School calculations use {status.timezone}. Refresh checks are shared and rate-limited to protect Lincoln’s servers.</p></>}
    </div>
  </details>;
}
