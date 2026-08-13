import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { parseSchoolTime } from '../src/lib/time';
import { resolveSchoolDay } from '../server/services/schoolDayService';
import { seedSchedules } from '../server/services/seedSchedules';

describe('America/Los_Angeles time handling', () => {
  it('uses the Los Angeles school date when UTC is already on the next date', () => {
    const result = resolveSchoolDay(DateTime.fromISO('2026-08-18T06:30:00Z'), [], seedSchedules);
    expect(result.date).toBe('2026-08-17');
    expect(result.scheduleType).toBe('regular-mon-wed');
  });

  it('uses daylight time after the spring transition', () => {
    expect(parseSchoolTime('2026-03-09', '8:30 AM').offset).toBe(-420);
  });

  it('uses standard time after the fall transition', () => {
    expect(parseSchoolTime('2026-11-02', '8:30 AM').offset).toBe(-480);
  });
});
