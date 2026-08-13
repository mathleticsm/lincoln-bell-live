import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, List, Search, X } from 'lucide-react';
import { DateTime } from 'luxon';
import type { SchoolEvent } from '../types';
import { api } from '../lib/api';
import { ZONE } from '../lib/time';
import { EventModal } from '../components/EventModal';
import { eventDateKeys, monthGridStart } from '../lib/calendar';
import { useSchoolDate } from '../hooks/useSchoolDate';

function normalized(value = '') {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function eventTimeOnDate(event: SchoolEvent, date: string) {
  if (event.allDay) return 'All day';
  const start = DateTime.fromISO(event.start, { zone: ZONE });
  const end = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;
  if (start.toISODate() === date) return start.toFormat('h:mm a');
  if (end?.isValid && end.toISODate() === date) return `Until ${end.toFormat('h:mm a')}`;
  return 'Ongoing';
}

function dayMarker(events: SchoolEvent[]) {
  const markers = events.map(event => event.title.toUpperCase());
  const odd = markers.some(title => /\bODD DAY\b/.test(title));
  const even = markers.some(title => /\bEVEN DAY\b/.test(title));
  if (odd === even) return undefined;
  return odd ? 'ODD DAY' : 'EVEN DAY';
}

export function CalendarPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const now = DateTime.now().setZone(ZONE);
  const [month, setMonth] = useState(() => now.startOf('month'));
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [selected, setSelected] = useState<SchoolEvent>();
  const [selectedDate, setSelectedDate] = useState(() => now.toISODate()!);
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [query, setQuery] = useState('');
  const [offline, setOffline] = useState(false);
  const [sourceWarning, setSourceWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const today = useSchoolDate();

  const gridStart = useMemo(() => monthGridStart(month), [month]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, index) => gridStart.plus({ days: index })), [gridStart]);

  useEffect(() => {
    let active = true;
    const endExclusive = gridStart.plus({ days: 42 });
    const key = `lincoln-bell-live:calendar:${month.toFormat('yyyy-MM')}`;
    setOffline(false); setSourceWarning(''); setError(''); setLoading(true);
    api.events(gridStart.toISODate()!, endExclusive.toISODate()!).then(response => {
      if (!active) return;
      setEvents(response.data);
      if (response.meta?.sourceAvailable === false) setSourceWarning('Lincoln’s live calendar is temporarily unavailable. Showing the latest server-cached events.');
      try { localStorage.setItem(key, JSON.stringify(response.data)); } catch { /* Browser storage is optional. */ }
    }).catch(errorValue => {
      if (!active) return;
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached) as SchoolEvent[];
          if (Array.isArray(parsed)) { setEvents(parsed); setOffline(true); return; }
        }
      } catch { /* Ignore corrupt or unavailable browser storage. */ }
      setEvents([]);
      setError(errorValue instanceof Error ? errorValue.message : 'Could not load calendar events.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, refreshToken, gridStart]);

  const filteredEvents = useMemo(() => {
    const search = normalized(query);
    if (!search) return events;
    return events.filter(event => normalized([event.title, event.location, event.description].filter(Boolean).join(' ')).includes(search));
  }, [events, query]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, SchoolEvent[]>();
    const gridEnd = gridStart.plus({ days: 42 });
    for (const event of filteredEvents) {
      for (const key of eventDateKeys(event, gridStart, gridEnd)) {
        grouped.set(key, [...(grouped.get(key) || []), event]);
      }
    }
    for (const list of grouped.values()) list.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    return grouped;
  }, [filteredEvents, gridStart]);

  const agendaEntries = [...byDate.entries()].filter(([date]) => date.startsWith(month.toFormat('yyyy-MM'))).sort(([a], [b]) => a.localeCompare(b));
  const selectedEvents = byDate.get(selectedDate) || [];

  const moveMonth = (amount: number) => {
    const next = month.plus({ months: amount }).startOf('month');
    setMonth(next); setSelectedDate(next.toISODate()!);
  };
  const goToday = () => { const current = DateTime.now().setZone(ZONE); setMonth(current.startOf('month')); setSelectedDate(current.toISODate()!); };

  return <main>
    <div className="calendar-toolbar">
      <div><p className="kicker">Official calendar</p><h1>{month.toFormat('LLLL yyyy')}</h1></div>
      <div className="toolbar-actions"><button onClick={goToday}>Today</button><button className="icon-btn" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft/></button><button className="icon-btn" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight/></button></div>
    </div>
    <div className="calendar-controls">
      <label className="calendar-search"><Search size={18}/><span className="sr-only">Search calendar</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, location, or details"/>{query && <button onClick={() => setQuery('')} aria-label="Clear calendar search"><X size={16}/></button>}</label>
      <div className="view-toggle" aria-label="Calendar view"><button className={view === 'month' ? 'active' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}><CalIcon size={17}/>Month</button><button className={view === 'agenda' ? 'active' : ''} aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><List size={17}/>Agenda</button></div>
    </div>
    {offline && <div className="warning">You’re offline. Showing the most recently loaded events for this month.</div>}
    {sourceWarning && <div className="warning">{sourceWarning}</div>}
    {error && <div className="error-card">Couldn’t load this month’s calendar. {error}</div>}
    {loading && <div className="calendar-loading" role="status">Loading official events…</div>}
    {view === 'month' ? <>
      <section className="month-card card" aria-label={`${month.toFormat('LLLL yyyy')} calendar`}>
        <div className="weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">{cells.map(day => {
          const key = day.toISODate()!; const list = byDate.get(key) || []; const selectedDay = key === selectedDate;
          return <div className={`day ${day.month !== month.month ? 'muted' : ''} ${key === today ? 'today' : ''} ${selectedDay ? 'selected' : ''}`} key={key}>
            <button className="day-num" onClick={() => setSelectedDate(key)} aria-label={`Select ${day.toFormat('cccc, LLLL d')}`} aria-current={key === today ? 'date' : undefined}>{day.day}</button>
            <div className="event-dots" aria-hidden="true">{list.slice(0, 3).map(event => <i key={event.id}/>)}</div>
            <div className="day-events">{list.slice(0, 3).map(event => <button key={event.id} onClick={() => setSelected(event)} title={event.title}>{event.title}</button>)}{list.length > 3 && <button className="more-events" onClick={() => { setSelectedDate(key); setView('agenda'); }}>+{list.length - 3} more</button>}</div>
          </div>;
        })}</div>
      </section>
      <section className="card selected-day-events"><div className="section-head"><div><p className="kicker">Selected date</p><h2>{DateTime.fromISO(selectedDate, { zone: ZONE }).toFormat('cccc, LLLL d')}</h2></div>{dayMarker(selectedEvents) && <span className="day-type-pill">{dayMarker(selectedEvents)}</span>}</div>{selectedEvents.length ? selectedEvents.map(event => <button className="event-row" key={event.id} onClick={() => setSelected(event)}><div><strong>{event.title}</strong><span>{eventTimeOnDate(event, selectedDate)}</span></div></button>) : <div className="empty">No official events are listed for this date.</div>}</section>
    </> : <section className="agenda card">{agendaEntries.length ? agendaEntries.map(([date, list]) => <div className="agenda-day" key={date}>
      <div className="agenda-date"><time dateTime={date}>{DateTime.fromISO(date, { zone: ZONE }).toFormat('ccc LLL d')}</time>{dayMarker(list) && <span>{dayMarker(list)}</span>}</div>
      <div>{list.map(event => <button className="event-row" key={`${date}:${event.id}`} onClick={() => setSelected(event)}><div><strong>{event.title}</strong><span>{eventTimeOnDate(event, date)}{event.location ? ` · ${event.location}` : ''}</span></div></button>)}</div>
    </div>) : <div className="empty">{query ? `No events match “${query}”.` : 'No official calendar events are listed for this month.'}</div>}</section>}
    {selected && <EventModal event={selected} onClose={() => setSelected(undefined)}/>} 
  </main>;
}
