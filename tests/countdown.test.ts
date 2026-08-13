import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { computeLiveState, computeSchoolMetrics, formatDuration } from '../src/lib/time';
import { seedSchedules } from '../server/services/seedSchedules.js';

const periods = seedSchedules[0].periods;
const date = '2026-08-17';
const at = (time: string) => DateTime.fromISO(`${date}T${time}`, { zone: 'America/Los_Angeles' });

describe('countdown state', () => {
  it('before school', () => expect(computeLiveState(at('08:00:00'), date, periods, true).status).toBe('before-school'));
  it('one second before school reports one second remaining', () => expect(computeLiveState(at('08:29:59'), date, periods, true).secondsRemaining).toBe(1));
  it('exact period start is active', () => expect(computeLiveState(at('08:30:00'), date, periods, true).status).toBe('in-session'));
  it('active period', () => expect(computeLiveState(at('09:00:00'), date, periods, true).current?.rawName).toContain('1/2'));
  it('passing', () => expect(computeLiveState(at('10:10:00'), date, periods, true).status).toBe('passing'));
  it('lunch', () => expect(computeLiveState(at('11:50:00'), date, periods, true).status).toBe('lunch'));
  it('after school', () => expect(computeLiveState(at('15:30:00'), date, periods, true).status).toBe('after-school'));
  it('exact period boundary transitions instead of showing a negative/zero class timer', () => expect(computeLiveState(at('10:09:00'), date, periods, true).status).toBe('passing'));
  it('exact next-period start leaves passing state', () => expect(computeLiveState(at('10:14:00'), date, periods, true).current?.rawName).toBe('Period 3/4'));
  it('rounds remaining fractional seconds up so the countdown does not lose a second', () => {
    const state = computeLiveState(at('10:08:59.250'), date, periods, true);
    expect(state.secondsRemaining).toBe(1);
  });
  it('preserves weekend state when school is closed for a weekend', () => {
    expect(computeLiveState(at('10:00:00'), date, [], false, 'weekend')).toMatchObject({ status: 'weekend', label: 'No School This Weekend' });
  });
  it('identifies advisory and nutrition blocks', () => {
    expect(computeLiveState(at('11:40:00'), date, seedSchedules[1].periods, true).status).toBe('advisory');
    expect(computeLiveState(at('10:50:00'), date, seedSchedules[2].periods, true).status).toBe('nutrition');
  });
  it('derives progress context only from schedule boundaries', () => {
    expect(computeSchoolMetrics(at('12:15:00'), date, periods)).toMatchObject({ completed: 3, total: 5, secondsUntilDismissal: 11_340 });
    expect(formatDuration(11_340)).toBe('3h 9m');
  });
});
