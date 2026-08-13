import { DateTime } from 'luxon';
import type { SchoolEvent } from '../types';
import { ZONE } from './time';

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function fold(line: string) {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > 73) {
    parts.push(remaining.slice(0, 73));
    remaining = ` ${remaining.slice(73)}`;
  }
  parts.push(remaining);
  return parts.join('\r\n');
}

function utcStamp(iso: string) {
  const value = DateTime.fromISO(iso, { zone: ZONE }).toUTC();
  return value.isValid ? value.toFormat("yyyyLLdd'T'HHmmss'Z'") : undefined;
}

export function buildEventIcs(event: SchoolEvent) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lincoln Bell Live//Event Export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT'];
  lines.push(`UID:${escapeText(event.id)}@lincoln-bell-live`);
  lines.push(`DTSTAMP:${DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'")}`);
  lines.push(`SUMMARY:${escapeText(event.title)}`);

  if (event.allDay) {
    const start = DateTime.fromISO(event.start, { zone: ZONE });
    if (!start.isValid) throw new Error('Event start date is invalid.');
    const parsedEnd = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : start.plus({ days: 1 });
    const end = parsedEnd.isValid && parsedEnd.toMillis() > start.toMillis() ? parsedEnd : start.plus({ days: 1 });
    lines.push(`DTSTART;VALUE=DATE:${start.toFormat('yyyyLLdd')}`);
    lines.push(`DTEND;VALUE=DATE:${end.toFormat('yyyyLLdd')}`);
  } else {
    const start = utcStamp(event.start);
    if (!start) throw new Error('Event start time is invalid.');
    lines.push(`DTSTART:${start}`);
    if (event.end) {
      const end = utcStamp(event.end);
      if (end) lines.push(`DTEND:${end}`);
    }
  }

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.sourceUrl) lines.push(`URL:${event.sourceUrl}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function eventDetailsText(event: SchoolEvent) {
  const start = DateTime.fromISO(event.start, { zone: ZONE });
  const end = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;
  const when = event.allDay
    ? `${start.toFormat('cccc, LLLL d, yyyy')} (all day)`
    : `${start.toFormat('cccc, LLLL d, yyyy · h:mm a')}${end?.isValid ? ` – ${end.toFormat(end.toISODate() === start.toISODate() ? 'h:mm a' : 'LLL d, h:mm a')}` : ''}`;
  return [event.title, when, event.location, event.description, event.sourceUrl].filter(Boolean).join('\n');
}

export function downloadEventIcs(event: SchoolEvent) {
  const blob = new Blob([buildEventIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lincoln-event'}.ics`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
