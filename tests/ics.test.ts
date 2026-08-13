import { describe, expect, it } from 'vitest';
import { buildEventIcs } from '../src/lib/ics';
import type { SchoolEvent } from '../src/types';

const base: SchoolEvent = { id: 'event-1', title: 'Lincoln Event', start: '2026-08-12', allDay: true };

describe('individual event calendar export', () => {
  it('writes an exclusive next-day DTEND for a one-day all-day event', () => {
    const output = buildEventIcs(base);
    expect(output).toContain('DTSTART;VALUE=DATE:20260812\r\n');
    expect(output).toContain('DTEND;VALUE=DATE:20260813\r\n');
  });

  it('converts Los Angeles timed events to unambiguous UTC', () => {
    const output = buildEventIcs({ ...base, allDay: false, start: '2026-08-21T19:00:00-07:00', end: '2026-08-21T21:00:00-07:00' });
    expect(output).toContain('DTSTART:20260822T020000Z');
    expect(output).toContain('DTEND:20260822T040000Z');
  });

  it('escapes calendar text fields', () => {
    const output = buildEventIcs({ ...base, title: 'Meet, greet; repeat', description: 'Line 1\nLine 2', location: 'Room 1; Main' });
    expect(output).toContain('SUMMARY:Meet\\, greet\\; repeat');
    expect(output).toContain('DESCRIPTION:Line 1\\nLine 2');
    expect(output).toContain('LOCATION:Room 1\\; Main');
  });
});
