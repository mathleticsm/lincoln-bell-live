import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { monthGridStart } from '../src/lib/calendar';

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
