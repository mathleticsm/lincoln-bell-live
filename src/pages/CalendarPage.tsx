import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, List, Calendar as CalIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import type { SchoolEvent } from '../types';
import { api } from '../lib/api';
import { ZONE } from '../lib/time';
import { EventModal } from '../components/EventModal';
import { monthGridStart } from '../lib/calendar';
import { useSchoolDate } from '../hooks/useSchoolDate';

export function CalendarPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const [month, setMonth] = useState(() => DateTime.now().setZone(ZONE).startOf('month'));
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [selected, setSelected] = useState<SchoolEvent>();
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [offline, setOffline] = useState(false);
  const [sourceWarning, setSourceWarning] = useState('');
  const [error, setError] = useState('');
  const today = useSchoolDate();

  const gridStart = useMemo(() => monthGridStart(month), [month]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, index) => gridStart.plus({ days: index })), [gridStart]);

  useEffect(() => {
    let active = true;
    const start = gridStart;
    const end = gridStart.plus({ days: 41 });
    const key = `lincoln-bell-live:calendar:${month.toFormat('yyyy-MM')}`;
    setEvents([]);
    setOffline(false);
    setSourceWarning('');
    setError('');

    api.events(start.toISODate()!, end.toISODate()!).then(response => {
      if (!active) return;
      setEvents(response.data);
      if (response.meta?.sourceAvailable === false) {
        setSourceWarning('Lincoln’s live calendar source is temporarily unavailable. Showing the latest server-cached events.');
      }
      try { localStorage.setItem(key, JSON.stringify(response.data)); } catch { /* Browser storage is optional. */ }
    }).catch(errorValue => {
      if (!active) return;
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached) as SchoolEvent[];
          if (Array.isArray(parsed)) {
            setEvents(parsed);
            setOffline(true);
            return;
          }
        }
      } catch { /* Ignore corrupt/unavailable browser cache. */ }
      setEvents([]);
      setError(errorValue instanceof Error ? errorValue.message : 'Could not load calendar events.');
    });

    return () => { active = false; };
  }, [month, refreshToken, gridStart]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, SchoolEvent[]>();
    for (const event of events) {
      const startDay = DateTime.fromISO(event.start, { zone: ZONE }).startOf('day');
      if (!startDay.isValid) continue;
      const parsedEnd = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;
      let endDay = startDay;
      if (parsedEnd?.isValid && parsedEnd.toMillis() > startDay.toMillis()) {
        endDay = parsedEnd.minus({ milliseconds: 1 }).startOf('day');
      }
      const gridEnd = gridStart.plus({ days: 41 }).endOf('day');
      let cursor = startDay.toMillis() < gridStart.toMillis() ? gridStart : startDay;
      if (endDay.toMillis() > gridEnd.toMillis()) endDay = gridEnd.startOf('day');
      let guard = 0;
      while (cursor.toMillis() <= endDay.toMillis() && guard < 42) {
        const key = cursor.toISODate()!;
        grouped.set(key, [...(grouped.get(key) || []), event]);
        cursor = cursor.plus({ days: 1 });
        guard += 1;
      }
    }
    for (const list of grouped.values()) list.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    return grouped;
  }, [events, gridStart]);

  const agendaEntries = [...byDate.entries()]
    .filter(([date]) => date.startsWith(month.toFormat('yyyy-MM')))
    .sort(([a], [b]) => a.localeCompare(b));

  return <main>
    <div className="calendar-toolbar">
      <div><p className="kicker">Live official calendar</p><h1>{month.toFormat('LLLL yyyy')}</h1></div>
      <div className="toolbar-actions">
        <button onClick={() => setMonth(DateTime.now().setZone(ZONE).startOf('month'))}>Today</button>
        <button className="icon-btn" onClick={() => setMonth(current => current.minus({ months: 1 }))} aria-label="Previous month"><ChevronLeft /></button>
        <button className="icon-btn" onClick={() => setMonth(current => current.plus({ months: 1 }))} aria-label="Next month"><ChevronRight /></button>
        <button className="icon-btn" onClick={() => setView(current => current === 'month' ? 'agenda' : 'month')} aria-label={`Switch to ${view === 'month' ? 'agenda' : 'month'} view`}>{view === 'month' ? <List /> : <CalIcon />}</button>
      </div>
    </div>
    {offline && <div className="warning">You’re offline. Showing the most recently loaded events for this month.</div>}
    {sourceWarning && <div className="warning">{sourceWarning}</div>}
    {error && <div className="error-card">Couldn’t load this month’s calendar. {error}</div>}
    {view === 'month'
      ? <section className="month-card card" aria-label={`${month.toFormat('LLLL yyyy')} calendar`}>
          <div className="weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="month-grid">{cells.map(day => {
            const key = day.toISODate()!;
            const list = byDate.get(key) || [];
            return <div className={`day ${day.month !== month.month ? 'muted' : ''} ${key === today ? 'today' : ''}`} key={key}>
              <span className="day-num" aria-label={day.toFormat('cccc, LLLL d')}>{day.day}</span>
              <div className="day-events">{list.slice(0, 3).map(event => <button key={event.id} onClick={() => setSelected(event)} title={event.title} aria-label={`${event.title}, ${day.toFormat('LLLL d')}`}>{event.title}</button>)}{list.length > 3 && <button className="more-events" onClick={() => setView('agenda')} title="Open agenda view" aria-label={`Open agenda view to see ${list.length - 3} more events on ${day.toFormat('LLLL d')}`}>+{list.length - 3} more</button>}</div>
            </div>;
          })}</div>
        </section>
      : <section className="agenda card">{agendaEntries.length ? agendaEntries.map(([date, list]) => <div className="agenda-day" key={date}><time dateTime={date}>{DateTime.fromISO(date, { zone: ZONE }).toFormat('LLL d')}</time><div>{list.map(event => <button className="event-row" key={event.id} onClick={() => setSelected(event)}><div><strong>{event.title}</strong><span>{event.allDay ? 'All day' : (() => { const eventStart = DateTime.fromISO(event.start, { zone: ZONE }); const eventEnd = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined; return eventStart.toISODate() === date ? eventStart.toFormat('h:mm a') : eventEnd?.isValid && eventEnd.toISODate() === date ? `Until ${eventEnd.toFormat('h:mm a')}` : 'Ongoing'; })()}</span></div></button>)}</div></div>) : <div className="empty">No official calendar events are listed for this month.</div>}</section>}
    {selected && <EventModal event={selected} onClose={() => setSelected(undefined)} />}
  </main>;
}
