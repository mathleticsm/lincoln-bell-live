import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { computeLiveState } from '../src/lib/time';
import { seedSchedules } from '../server/services/seedSchedules.js';

const periods = seedSchedules[0].periods;
const date = '2026-08-17';
const at = (time: string) => DateTime.fromISO(`${date}T${time}`, { zone: 'America/Los_Angeles' });

describe('countdown state', () => {
  it('before school', () => expect(computeLiveState(at('08:00:00'), date, periods, true).status).toBe('before-school'));
  it('active period', () => expect(computeLiveState(at('09:00:00'), date, periods, true).current?.rawName).toContain('1/2'));
  it('passing', () => expect(computeLiveState(at('10:10:00'), date, periods, true).status).toBe('passing'));
  it('lunch', () => expect(computeLiveState(at('11:50:00'), date, periods, true).status).toBe('lunch'));
  it('after school', () => expect(computeLiveState(at('15:30:00'), date, periods, true).status).toBe('after-school'));
  it('exact period boundary transitions instead of showing a negative/zero class timer', () => expect(computeLiveState(at('10:09:00'), date, periods, true).status).toBe('passing'));
  it('rounds remaining fractional seconds up so the countdown does not lose a second', () => {
    const state = computeLiveState(at('10:08:59.250'), date, periods, true);
    expect(state.secondsRemaining).toBe(1);
  });
  it('preserves weekend state when school is closed for a weekend', () => {
    expect(computeLiveState(at('10:00:00'), date, [], false, 'weekend')).toMatchObject({ status: 'weekend', label: 'No School This Weekend' });
  });
});
