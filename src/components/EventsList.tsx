import { CalendarDays, ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';
import type { SchoolEvent } from '../types';
import { ZONE } from '../lib/time';

function eventTimeLabel(event: SchoolEvent, date: string) {
  if (event.allDay) return 'All day';
  const start = DateTime.fromISO(event.start, { zone: ZONE });
  const end = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;
  if (start.isValid && start.toISODate() === date) return start.toFormat('h:mm a');
  if (end?.isValid && end.toISODate() === date) return `Until ${end.toFormat('h:mm a')}`;
  return 'Ongoing';
}

export function EventsList({ events, date, onSelect }: { events: SchoolEvent[]; date: string; onSelect: (event: SchoolEvent) => void }) {
  return <section className="card events-card">
    <div className="section-head"><div><p className="kicker">Official calendar</p><h2>Today’s events</h2></div><CalendarDays size={19}/></div>
    {events.length ? <div className="event-list">{events.map(event => <button key={event.id} className="event-row" onClick={() => onSelect(event)}>
      <div><strong>{event.title}</strong><span>{eventTimeLabel(event, date)}{event.location ? ` · ${event.location}` : ''}</span></div><ChevronRight size={18} aria-hidden="true"/>
    </button>)}</div> : <div className="empty">No official calendar events are listed today.</div>}
  </section>;
}
