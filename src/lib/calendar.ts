import { DateTime } from 'luxon';
import type { SchoolEvent } from '../types';
import { ZONE } from './time';

export function monthGridStart(month: DateTime) {
  const first = month.startOf('month');
  // Luxon weekdays are Monday=1 ... Sunday=7. `% 7` makes Sunday offset zero.
  return first.minus({ days: first.weekday % 7 }).startOf('day');
}

export function eventDateKeys(event: SchoolEvent, rangeStart: DateTime, rangeEndExclusive: DateTime) {
  const start = DateTime.fromISO(event.start, { zone: ZONE });
  if (!start.isValid) return [];
  const parsedEnd = event.end ? DateTime.fromISO(event.end, { zone: ZONE }) : undefined;
  const endExclusive = parsedEnd?.isValid && parsedEnd.toMillis() > start.toMillis()
    ? parsedEnd
    : event.allDay ? start.plus({ days: 1 }) : start.plus({ milliseconds: 1 });
  let cursor = start.startOf('day').toMillis() < rangeStart.toMillis() ? rangeStart.startOf('day') : start.startOf('day');
  const keys: string[] = [];
  let guard = 0;
  while (cursor.toMillis() < endExclusive.toMillis() && cursor.toMillis() < rangeEndExclusive.toMillis() && guard < 370) {
    keys.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
    guard += 1;
  }
  return keys;
}
