import { CalendarDays } from 'lucide-react';
import type { SchoolEvent } from '../types';
import { DateTime } from 'luxon';
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
  return <section className="card">
    <div className="section-head"><h2>Today’s events</h2><CalendarDays size={19} /></div>
    {events.length
      ? <div className="event-list">{events.map(event => <button key={event.id} className="event-row" onClick={() => onSelect(event)}><div><strong>{event.title}</strong><span>{eventTimeLabel(event, date)}{event.location ? ` • ${event.location}` : ''}</span></div><span aria-hidden="true">›</span></button>)}</div>
      : <div className="empty">No official calendar events listed today.</div>}
  </section>;
}
