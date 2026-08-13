import { useEffect, useState } from 'react';
import type { SchoolEvent, TodayResponse } from '../types';
import { api } from '../lib/api';
import { useSchoolDate } from '../hooks/useSchoolDate';
import { CurrentPeriodCard } from '../components/CurrentPeriodCard';
import { DataStatus } from '../components/DataStatus';
import { EventModal } from '../components/EventModal';
import { EventsList } from '../components/EventsList';
import { NextSchoolDayCard } from '../components/NextSchoolDayCard';
import { ScheduleTimeline } from '../components/ScheduleTimeline';

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
      try { localStorage.setItem(cacheKey, JSON.stringify(response.data)); } catch { /* Storage can be unavailable. */ }
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
      } catch { /* Ignore corrupt or unavailable browser storage. */ }
      setToday(undefined);
      setOfflineFallback(false);
      setError(message);
    });
    return () => { active = false; };
  }, [refreshToken, dateTicker]);

  if (error) return <main><div className="error-card">You’re offline and no schedule has been loaded yet. <span>{error}</span></div></main>;
  if (!today) return <main><div className="skeleton hero-card">Loading today’s official schedule…</div></main>;

  const statusBell = offlineFallback ? 'browser-cache' : today.sourceState.bell;
  const statusCalendar = offlineFallback ? 'browser-cache' : today.sourceState.calendar;
  const visibleWarnings = today.warnings.filter(warning => !(today.specialEvents.length && warning.includes('exact period times cannot be verified')));

  return <main>
    {offlineFallback && <div className="warning" role="status">You’re offline or the app server is unreachable. Showing the most recently loaded schedule for today from this device.</div>}
    <div className="status-row"><DataStatus bell={statusBell} calendar={statusCalendar} updatedAt={today.sourceUpdatedAt}/></div>
    {visibleWarnings.map(warning => <div className="warning" role="alert" key={warning}>{warning}</div>)}
    <CurrentPeriodCard today={today}/>
    <div className="today-grid"><ScheduleTimeline date={today.date} periods={today.periods}/><div className="today-side"><EventsList events={today.allEvents} date={today.date} onSelect={setSelected}/><NextSchoolDayCard value={today.nextSchoolDay} today={today.date} bellMode={statusBell}/></div></div>
    {selected && <EventModal event={selected} onClose={() => setSelected(undefined)}/>} 
  </main>;
}
