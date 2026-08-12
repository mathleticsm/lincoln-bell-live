import { useEffect, useState } from 'react';
import type { SchoolEvent, TodayResponse } from '../types';
import { api } from '../lib/api';
import { useSchoolDate } from '../hooks/useSchoolDate';
import { CurrentPeriodCard } from '../components/CurrentPeriodCard';
import { ScheduleTimeline } from '../components/ScheduleTimeline';
import { EventsList } from '../components/EventsList';
import { EventModal } from '../components/EventModal';
import { DataStatus } from '../components/DataStatus';

const CACHE_PREFIX = 'lincoln-bell-live:today:';

export function TodayPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const [today, setToday] = useState<TodayResponse>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SchoolEvent>();
  const [offlineFallback, setOfflineFallback] = useState(false);
  const dateTicker = useSchoolDate();

  useEffect(() => {
    let active = true;
    const cacheKey = `${CACHE_PREFIX}${dateTicker}`;
    setError('');

    api.today(dateTicker).then(response => {
      if (!active) return;
      setToday(response.data);
      setOfflineFallback(false);
      try { localStorage.setItem(cacheKey, JSON.stringify(response.data)); } catch { /* Storage can be unavailable in privacy modes. */ }
    }).catch(errorValue => {
      if (!active) return;
      const message = errorValue instanceof Error ? errorValue.message : 'Request failed.';
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as TodayResponse;
          if (parsed.date === dateTicker) {
            setToday(parsed);
            setOfflineFallback(true);
            setError('');
            return;
          }
        }
      } catch { /* Ignore corrupt/unavailable browser cache. */ }
      setToday(undefined);
      setOfflineFallback(false);
      setError(message);
    });

    return () => { active = false; };
  }, [refreshToken, dateTicker]);

  if (error) return <main><div className="error-card">Couldn’t load the live schedule. {error}</div></main>;
  if (!today) return <main><div className="skeleton hero-card">Loading today’s official schedule…</div></main>;

  return <main>
    {offlineFallback && <div className="warning">You’re offline or the app server is unreachable. Showing the most recently loaded schedule for today from this device.</div>}
    <div className="status-row"><DataStatus bell={offlineFallback ? 'browser-cache' : today.sourceState.bell} calendar={offlineFallback ? 'browser-cache' : today.sourceState.calendar} updatedAt={today.sourceUpdatedAt} /></div>
    {today.warnings.map(warning => <div className="warning" key={warning}>{warning}</div>)}
    <CurrentPeriodCard today={today} />
    <div className="two-col"><ScheduleTimeline date={today.date} periods={today.periods} /><EventsList events={today.allEvents} date={today.date} onSelect={setSelected} /></div>
    {selected && <EventModal event={selected} onClose={() => setSelected(undefined)} />}
  </main>;
}
