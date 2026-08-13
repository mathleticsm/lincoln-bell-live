import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eventDateKeys, monthGridStart } from '../src/lib/calendar';
import type { SchoolEvent } from '../src/types';

const zone = 'America/Los_Angeles';

describe('calendar month grid', () => {
  it('starts on the same day when the month begins on Sunday', () => {
    const november = DateTime.fromISO('2026-11-01', { zone });
    expect(monthGridStart(november).toISODate()).toBe('2026-11-01');
  });

  it('starts on the preceding Sunday for other weekdays', () => {
    const august = DateTime.fromISO('2026-08-01', { zone });
    expect(monthGridStart(august).toISODate()).toBe('2026-07-26');
  });
});

describe('calendar event date coverage', () => {
  const rangeStart = DateTime.fromISO('2026-08-01', { zone });
  const rangeEnd = DateTime.fromISO('2026-09-01', { zone });
  const keys = (event: Partial<SchoolEvent>) => eventDateKeys({ id: 'test', title: 'Test', start: '2026-08-12', allDay: true, ...event }, rangeStart, rangeEnd);

  it('treats all-day DTEND as exclusive', () => {
    expect(keys({ end: '2026-08-13' })).toEqual(['2026-08-12']);
  });

  it('shows a multi-day all-day event on each touched date', () => {
    expect(keys({ end: '2026-08-15' })).toEqual(['2026-08-12', '2026-08-13', '2026-08-14']);
  });

  it('does not show an event ending exactly at midnight on the next date', () => {
    expect(keys({ allDay: false, start: '2026-08-12T20:00:00-07:00', end: '2026-08-13T00:00:00-07:00' })).toEqual(['2026-08-12']);
  });

  it('shows an overnight event on both dates', () => {
    expect(keys({ allDay: false, start: '2026-08-12T23:00:00-07:00', end: '2026-08-13T01:00:00-07:00' })).toEqual(['2026-08-12', '2026-08-13']);
  });
});
