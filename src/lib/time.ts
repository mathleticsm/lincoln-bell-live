import { DateTime } from 'luxon';
import type { BellPeriod, SchoolStatus } from '../types';

export const ZONE = 'America/Los_Angeles';

export function parseSchoolTime(dateISO: string, time: string) {
  const parsed = DateTime.fromFormat(time.toUpperCase(), 'h:mm a', { zone: ZONE, locale: 'en-US' });
  const date = DateTime.fromISO(dateISO, { zone: ZONE });
  if (!parsed.isValid || !date.isValid) return DateTime.invalid('Invalid school date/time');
  return date.set({ hour: parsed.hour, minute: parsed.minute, second: 0, millisecond: 0 });
}

export interface LiveState {
  status: SchoolStatus;
  current?: BellPeriod;
  next?: BellPeriod;
  secondsRemaining?: number;
  progress?: number;
  label: string;
}

export interface SchoolMetrics {
  completed: number;
  total: number;
  secondsUntilLunch?: number;
  secondsUntilDismissal?: number;
}

function secondsUntil(end: DateTime, now: DateTime) {
  return Math.max(0, Math.ceil(end.diff(now, 'seconds').seconds));
}

export function computeLiveState(
  now: DateTime,
  dateISO: string,
  periods: BellPeriod[],
  schoolDay: boolean,
  closedStatus: 'no-school' | 'weekend' = 'no-school'
): LiveState {
  if (!schoolDay) {
    return { status: closedStatus, label: closedStatus === 'weekend' ? 'No School This Weekend' : 'No School Today' };
  }
  if (!periods.length) return { status: 'unknown', label: 'Exact bell times unavailable' };

  const first = parseSchoolTime(dateISO, periods[0].startTime);
  const last = parseSchoolTime(dateISO, periods.at(-1)!.endTime);
  if (!first.isValid || !last.isValid) return { status: 'unknown', label: 'Schedule status unavailable' };

  if (now.toMillis() < first.toMillis()) {
    return { status: 'before-school', next: periods[0], secondsRemaining: secondsUntil(first, now), label: 'School begins' };
  }
  if (now.toMillis() >= last.toMillis()) {
    return { status: 'after-school', secondsRemaining: 0, label: 'School is finished for today' };
  }

  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const start = parseSchoolTime(dateISO, period.startTime);
    const end = parseSchoolTime(dateISO, period.endTime);
    if (!start.isValid || !end.isValid || end.toMillis() <= start.toMillis()) continue;

    if (now.toMillis() >= start.toMillis() && now.toMillis() < end.toMillis()) {
      const total = end.diff(start, 'seconds').seconds;
      const elapsed = now.diff(start, 'seconds').seconds;
      const status = period.kind === 'lunch' ? 'lunch' : period.kind === 'advisory' ? 'advisory' : period.kind === 'nutrition' ? 'nutrition' : 'in-session';
      return {
        status,
        current: period,
        next: periods[i + 1],
        secondsRemaining: secondsUntil(end, now),
        progress: Math.min(1, Math.max(0, elapsed / total)),
        label: period.name
      };
    }

    const next = periods[i + 1];
    if (next) {
      const nextStart = parseSchoolTime(dateISO, next.startTime);
      if (nextStart.isValid && now.toMillis() >= end.toMillis() && now.toMillis() < nextStart.toMillis()) {
        return { status: 'passing', next, secondsRemaining: secondsUntil(nextStart, now), label: 'Passing Period' };
      }
    }
  }
  return { status: 'unknown', label: 'Schedule status unavailable' };
}

export function formatCountdown(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function formatClock(iso: string) {
  const date = DateTime.fromISO(iso, { zone: ZONE });
  return date.isValid ? date.toFormat('h:mm a') : '';
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export function computeSchoolMetrics(now: DateTime, dateISO: string, periods: BellPeriod[]): SchoolMetrics {
  const boundaries = periods.map(period => ({
    period,
    start: parseSchoolTime(dateISO, period.startTime),
    end: parseSchoolTime(dateISO, period.endTime)
  })).filter(item => item.start.isValid && item.end.isValid);
  const completed = boundaries.filter(item => now.toMillis() >= item.end.toMillis()).length;
  const lunch = boundaries.find(item => item.period.kind === 'lunch' && now.toMillis() < item.start.toMillis());
  const dismissal = boundaries.at(-1)?.end;

  return {
    completed,
    total: boundaries.length,
    secondsUntilLunch: lunch ? secondsUntil(lunch.start, now) : undefined,
    secondsUntilDismissal: dismissal && now.toMillis() < dismissal.toMillis() ? secondsUntil(dismissal, now) : undefined
  };
}
