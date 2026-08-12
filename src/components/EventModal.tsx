import { useEffect, useRef } from 'react';
import { X, MapPin, ExternalLink } from 'lucide-react';
import type { SchoolEvent } from '../types';
import { DateTime } from 'luxon';
import { ZONE } from '../lib/time';

function eventDateLabel(event: SchoolEvent) {
  const start = DateTime.fromISO(event.start, { zone: ZONE });
  if (!start.isValid) return 'Date unavailable';
  const end = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;

  if (event.allDay) {
    if (!end?.isValid || end.toMillis() <= start.toMillis()) return `${start.toFormat('cccc, LLLL d')} • All day`;
    const inclusiveEnd = end.minus({ days: 1 });
    return inclusiveEnd.toISODate() === start.toISODate()
      ? `${start.toFormat('cccc, LLLL d')} • All day`
      : `${start.toFormat('LLL d')} – ${inclusiveEnd.toFormat('LLL d, yyyy')} • All day`;
  }

  if (!end?.isValid) return start.toFormat('cccc, LLLL d • h:mm a');
  if (end.toISODate() === start.toISODate()) {
    return `${start.toFormat('cccc, LLLL d')} • ${start.toFormat('h:mm a')} – ${end.toFormat('h:mm a')}`;
  }
  return `${start.toFormat('LLL d, h:mm a')} – ${end.toFormat('LLL d, h:mm a')}`;
}

export function EventModal({ event, onClose }: { event: SchoolEvent; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        onClose();
        return;
      }
      if (keyboardEvent.key === 'Tab' && root) {
        const focusable = [...root.querySelectorAll<HTMLElement>('button,a[href],[tabindex]:not([tabindex="-1"])')]
          .filter(element => !element.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (keyboardEvent.shiftKey && document.activeElement === first) {
          keyboardEvent.preventDefault();
          last.focus();
        } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
          keyboardEvent.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    root?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={mouseEvent => { if (mouseEvent.currentTarget === mouseEvent.target) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="event-title" tabIndex={-1} ref={ref}>
      <button className="icon-btn close" onClick={onClose} aria-label="Close event details"><X /></button>
      <p className="kicker">Official calendar event</p>
      <h2 id="event-title">{event.title}</h2>
      <p>{eventDateLabel(event)}</p>
      {event.location && <p className="with-icon"><MapPin size={16} />{event.location}</p>}
      {event.description && <p className="event-description">{event.description}</p>}
      {event.sourceUrl && <a className="source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">View official source <ExternalLink size={15} /></a>}
    </div>
  </div>;
}
