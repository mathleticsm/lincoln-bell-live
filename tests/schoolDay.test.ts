import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { detectDayType, resolveSchoolDay, transformPeriodName } from '../server/services/schoolDayService.js';
import { seedSchedules } from '../server/services/seedSchedules.js';
import type { BellSchedule, SchoolEvent } from '../src/types/index.js';

const event = (date: string, title: string): SchoolEvent => ({ id: `${date}:${title}`, title, start: date, allDay: true });

describe('odd/even', () => {
  it.each([
    ['Period 1/2', 'odd', 'Period 1'],
    ['Period 1/2', 'even', 'Period 2'],
    ['Period 7/8', 'odd', 'Period 7'],
    ['Period 7/8', 'even', 'Period 8']
  ])('%s %s', (raw, day, output) => expect(transformPeriodName(raw, day as 'odd' | 'even')).toBe(output));

  it('detects advisory wording', () => {
    expect(detectDayType([event('2026-08-12', 'ADVISORY 1ST: ODD DAY')])).toBe('odd');
  });

  it('does not guess when official events conflict', () => {
    expect(detectDayType([event('2026-08-12', 'ODD DAY'), event('2026-08-12', 'EVEN DAY')])).toBe('unknown');
  });
});

describe('resolver', () => {
  const resolve = (date: string, events: SchoolEvent[] = [], schedules: BellSchedule[] = seedSchedules) =>
    resolveSchoolDay(DateTime.fromISO(`${date}T10:00`, { zone: 'America/Los_Angeles' }), events, schedules);

  it('Monday', () => expect(resolve('2026-08-17').scheduleType).toBe('regular-mon-wed'));
  it('Tuesday', () => expect(resolve('2026-08-18').scheduleType).toBe('professional-development-tuesday'));
  it('Wednesday', () => expect(resolve('2026-08-19').scheduleType).toBe('regular-mon-wed'));
  it('Thursday', () => expect(resolve('2026-08-20').scheduleType).toBe('regular-thu-fri'));
  it('Friday', () => expect(resolve('2026-08-21').scheduleType).toBe('regular-thu-fri'));
  it('Saturday', () => expect(resolve('2026-08-22').status).toBe('weekend'));
  it('Sunday', () => expect(resolve('2026-08-23').status).toBe('weekend'));
  it('minimum override', () => expect(resolve('2026-08-20', [event('2026-08-20', 'Minimum Day')]).scheduleType).toBe('minimum-day'));
  it('pupil free', () => expect(resolve('2026-08-18', [event('2026-08-18', 'Pupil Free Day')]).schoolDay).toBe(false));
  it('holiday', () => expect(resolve('2026-09-07', [event('2026-09-07', 'Labor Day Holiday')]).schoolDay).toBe(false));
  it('does not treat holiday concert as closure', () => expect(resolve('2026-12-10', [event('2026-12-10', 'Holiday Concert')]).schoolDay).toBe(true));
  it('does not treat a break-themed event as closure', () => expect(resolve('2026-12-10', [event('2026-12-10', 'Winter Break Concert')]).schoolDay).toBe(true));
  it('treats official date-suffixed winter break labels as closures', () => expect(resolve('2026-12-28', [event('2026-12-28', 'WINTER BREAK: 12/21/26 - 1/8/27')]).schoolDay).toBe(false));
  it('treats all-day DTEND as exclusive for multi-day closures', () => {
    const breakEvent: SchoolEvent = { id: 'break', title: 'Spring Break', start: '2026-08-19', end: '2026-08-20', allDay: true };
    expect(resolve('2026-08-19', [breakEvent]).schoolDay).toBe(false);
    expect(resolve('2026-08-20', [breakEvent]).schoolDay).toBe(true);
  });
  it('unknown special schedule warns instead of guessing', () => {
    const result = resolve('2026-08-12', [event('2026-08-12', 'ADVISORY 1ST: ODD DAY')]);
    expect(result.periods).toHaveLength(0);
    expect(result.warnings[0]).toContain('cannot be verified');
  });
  it('separates schedule-affecting calendar entries from ordinary events', () => {
    const result = resolve('2026-08-17', [
      event('2026-08-17', 'EVEN DAY'),
      event('2026-08-17', 'Football vs. University')
    ]);
    expect(result.allEvents).toHaveLength(2);
    expect(result.specialEvents.map(item => item.title)).toEqual(['EVEN DAY']);
  });
  it('uses a matching published special schedule if Lincoln publishes one', () => {
    const special: BellSchedule = {
      ...seedSchedules[0],
      id: 'advisory-first',
      name: 'Advisory 1st Schedule'
    };
    const result = resolve('2026-08-12', [event('2026-08-12', 'ADVISORY 1ST: ODD DAY')], [...seedSchedules, special]);
    expect(result.scheduleType).toBe('advisory-first');
    expect(result.periods.length).toBeGreaterThan(0);
  });
});
