import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { readFileSync } from 'node:fs';
import { parseEventsHtml, parseIcsEvents } from '../server/parsers/calendarParser.js';

const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:odd-1\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818\nSUMMARY:EVEN DAY\nEND:VEVENT\nBEGIN:VEVENT\nUID:timed-1\nDTSTART;TZID=America/Los_Angeles:20260821T190000\nDTEND;TZID=America/Los_Angeles:20260821T210000\nSUMMARY:Football Game\nLOCATION:Stadium\nEND:VEVENT\nEND:VCALENDAR`;


const parameterizedIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:param-1
DTSTART;TZID=America/Los_Angeles:20260824T090000
DTEND;TZID=America/Los_Angeles:20260824T100000
SUMMARY;LANGUAGE=en:Parameterized Title
DESCRIPTION;LANGUAGE=en:Parameterized Description
LOCATION;LANGUAGE=en:Room 101
END:VEVENT
END:VCALENDAR`;

const recurringIcs = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:recurring-1\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE;VALUE=DATE:20260818\nSUMMARY:Recurring Test\nEND:VEVENT\nEND:VCALENDAR`;

describe('calendar parser', () => {
  it('parses a minimal fixture matching Lincoln’s current ICS structure', () => {
    const fixture = readFileSync(new URL('./fixtures/lincoln-events.ics', import.meta.url), 'utf8');
    const events = parseIcsEvents(fixture, 'https://www.lincolnhs.org/apps/events/');
    expect(events.map(event => event.title)).toEqual(['ADVISORY 1ST: ODD DAY', 'Fall 2026: 1st day of school', 'Football vs. University']);
  });

  it('normalizes all-day and timed ICS events', () => {
    const events = parseIcsEvents(ics, 'https://www.lincolnhs.org/apps/events/');
    expect(events.find(event => event.title === 'EVEN DAY')).toMatchObject({ allDay: true, start: '2026-08-17' });
    const game = events.find(event => event.title === 'Football Game');
    expect(game?.allDay).toBe(false);
    expect(game?.location).toBe('Stadium');
    expect(game?.start).toContain('2026-08-21');
  });


  it('preserves ICS text properties that include parameters', () => {
    const [event] = parseIcsEvents(parameterizedIcs, 'https://www.lincolnhs.org/apps/events/');
    expect(event.title).toBe('Parameterized Title');
    expect(event.description).toBe('Parameterized Description');
    expect(event.location).toBe('Room 101');
  });

  it('expands recurrence and respects EXDATE', () => {
    const events = parseIcsEvents(recurringIcs, 'https://www.lincolnhs.org/apps/events/', DateTime.fromISO('2026-08-11', { zone: 'America/Los_Angeles' })).filter(event => event.title === 'Recurring Test');
    expect(events.map(event => event.start)).toEqual(['2026-08-17', '2026-08-19']);
  });


  it('keeps same-title events with different locations distinct', () => {
    const distinct = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a
DTSTART;TZID=America/Los_Angeles:20260824T090000
DTEND;TZID=America/Los_Angeles:20260824T100000
SUMMARY:Meeting
LOCATION:Room A
END:VEVENT
BEGIN:VEVENT
UID:b
DTSTART;TZID=America/Los_Angeles:20260824T090000
DTEND;TZID=America/Los_Angeles:20260824T100000
SUMMARY:Meeting
LOCATION:Room B
END:VEVENT
END:VCALENDAR`;
    expect(parseIcsEvents(distinct, 'https://www.lincolnhs.org/apps/events/')).toHaveLength(2);
  });

  it('rolls HTML fallback end times into the next day for overnight events', () => {
    const html = `<body><h1>Events</h1><div>August 2026</div><ul><li>Aug 21 Fri <a href="/apps/events/night/">Night Event</a> 11 PM – 1 AM</li></ul><div>Events in August 2026</div></body>`;
    const [night] = parseEventsHtml(html, 'https://www.lincolnhs.org/apps/events/');
    expect(night.start).toContain('2026-08-21T23:00:00');
    expect(night.end).toContain('2026-08-22T01:00:00');
  });


  it('gives same-title HTML events at different times unique IDs', () => {
    const html = `<body><h1>Events</h1><div>August 2026</div><ul><li>Aug 21 Fri <a href="/apps/events/a/">Meeting</a> 9 AM – 10 AM</li><li>Aug 21 Fri <a href="/apps/events/b/">Meeting</a> 11 AM – 12 PM</li></ul><div>Events in August 2026</div></body>`;
    const events = parseEventsHtml(html, 'https://www.lincolnhs.org/apps/events/');
    expect(events).toHaveLength(2);
    expect(new Set(events.map(event => event.id)).size).toBe(2);
  });

  it('parses semantic HTML fallback without treating footer links as events', () => {
    const html = `<body><h1>Events</h1><div>August 2026</div><ul><li>Aug 11 Tue <a href="/apps/events/123/">Pupil Free Day</a></li><li>Aug 21 Fri <a href="/apps/events/456/">Football vs. University</a> 7 PM – 9 PM</li></ul><div>Events in August 2026</div><footer><a href="/parent">Parent Portal</a></footer></body>`;
    const events = parseEventsHtml(html, 'https://www.lincolnhs.org/apps/events/');
    expect(events.map(event => event.title)).toEqual(['Pupil Free Day', 'Football vs. University']);
    expect(events[1].allDay).toBe(false);
    expect(events[1].start).toContain('T19:00:00');
  });
  it('rejects high-frequency recurrence rules so the service can fall back to HTML safely', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:rapid
DTSTART:20260817T090000
DTEND:20260817T091000
RRULE:FREQ=MINUTELY;COUNT=10000
SUMMARY:Rapid event
END:VEVENT
END:VCALENDAR`;
    expect(() => parseIcsEvents(ics, 'https://www.lincolnhs.org/apps/events/', DateTime.fromISO('2026-08-11', { zone: 'America/Los_Angeles' }))).toThrow(/high-frequency recurrence/i);
  });

  it('keeps an all-day multi-day event DTEND exclusive', () => {
    const multi = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:break\nDTSTART;VALUE=DATE:20260812\nDTEND;VALUE=DATE:20260815\nSUMMARY:School Break\nEND:VEVENT\nEND:VCALENDAR`;
    expect(parseIcsEvents(multi, 'https://www.lincolnhs.org/apps/events/')[0]).toMatchObject({ start: '2026-08-12', end: '2026-08-15', allDay: true });
  });

  it('preserves a timed event ending exactly at midnight', () => {
    const midnight = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:midnight\nDTSTART;TZID=America/Los_Angeles:20260812T200000\nDTEND;TZID=America/Los_Angeles:20260813T000000\nSUMMARY:Evening Event\nEND:VEVENT\nEND:VCALENDAR`;
    const event = parseIcsEvents(midnight, 'https://www.lincolnhs.org/apps/events/')[0];
    expect(event.start).toContain('2026-08-12T20:00:00');
    expect(event.end).toContain('2026-08-13T00:00:00');
  });

});
