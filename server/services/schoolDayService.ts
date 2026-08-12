import { DateTime } from 'luxon';
import type { BellPeriod, BellSchedule, DayType, SchoolEvent, TodayResponse } from '../../src/types/index.js';
import { config } from '../config.js';

export function normalizeTitle(title: string) {
  return title.toUpperCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function detectDayType(events: SchoolEvent[]): DayType {
  const titles = events.map(e => normalizeTitle(e.title));
  const hasOdd = titles.some(t => /(?:^|\s)ODD DAY(?:$|\s)/.test(t));
  const hasEven = titles.some(t => /(?:^|\s)EVEN DAY(?:$|\s)/.test(t));
  if (hasOdd === hasEven) return 'unknown';
  return hasOdd ? 'odd' : 'even';
}

export function transformPeriodName(rawName: string, dayType: DayType) {
  if (dayType === 'unknown') return rawName;
  return rawName.replace(/\bPeriod\s+(\d)\/(\d)\b/i, (_, odd, even) => `Period ${dayType === 'odd' ? odd : even}`);
}

function eventTouchesDate(event: SchoolEvent, date: DateTime) {
  const target = date.toISODate();
  if (!target) return false;
  if (event.allDay) {
    const start = event.start.slice(0, 10);
    const end = event.end?.slice(0, 10);
    // RFC 5545 all-day DTEND is exclusive.
    return start <= target && (!end || target < end);
  }
  const start = DateTime.fromISO(event.start, { zone: config.timezone });
  const end = event.end ? DateTime.fromISO(event.end, { zone: config.timezone }) : undefined;
  if (!start.isValid || (end && !end.isValid)) return false;
  const dayStart = date.startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  if (!end) return start.toMillis() >= dayStart.toMillis() && start.toMillis() < dayEnd.toMillis();
  return start.toMillis() < dayEnd.toMillis() && end.toMillis() > dayStart.toMillis();
}

function findSchedule(schedules: BellSchedule[], id: string, rx: RegExp) {
  return schedules.find(s => s.id === id) || schedules.find(s => rx.test(s.name));
}

const EXACT_CLOSURES = new Set([
  'HOLIDAY',
  'UNASSIGNED DAY',
  'LABOR DAY',
  'VETERANS DAY',
  'THANKSGIVING DAY',
  'THANKSGIVING BREAK',
  'WINTER BREAK',
  'SPRING BREAK',
  'MEMORIAL DAY',
  'MARTIN LUTHER KING DAY',
  'MARTIN LUTHER KING JR DAY',
  'PRESIDENTS DAY',
  'PRESIDENT S DAY',
  'CESAR CHAVEZ DAY'
]);

function isNoSchool(title: string) {
  const n = normalizeTitle(title);
  if (/\b(PUPIL FREE DAY|NO SCHOOL|SCHOOL CLOSED)\b/.test(n)) return true;
  if (EXACT_CLOSURES.has(n)) return true;
  // Date-suffixed official recess/break labels are closures, but names such as
  // "Winter Break Concert" must not be treated as no-school days.
  if (/^(?:WINTER|SPRING|THANKSGIVING) (?:BREAK|RECESS)(?:\s+\d.*)?$/.test(n)) return true;
  if (/^UNASSIGNED DAY(?:\s+\d.*)?$/.test(n)) return true;
  // Official calendars commonly suffix explicit closure names with "Holiday".
  return /^(?:LABOR DAY|VETERANS DAY|THANKSGIVING|MEMORIAL DAY|MARTIN LUTHER KING(?: JR)? DAY|PRESIDENTS DAY|PRESIDENT S DAY|CESAR CHAVEZ DAY) HOLIDAY$/.test(n);
}

function findUnknownSpecial(events: SchoolEvent[]) {
  return events.find(e => {
    const n = normalizeTitle(e.title);
    if (/\bMINIMUM DAY\b/.test(n)) return false;
    if (/\bADVISORY 1ST\b/.test(n) && /\b(ODD|EVEN) DAY\b/.test(n)) return true;
    return /\b(SPECIAL SCHEDULE|BELL SCHEDULE|LATE START|EARLY RELEASE|EARLY DISMISSAL|FINALS? SCHEDULE)\b/.test(n);
  });
}

function isSpecialCalendarEvent(event: SchoolEvent) {
  const n = normalizeTitle(event.title);
  return isNoSchool(event.title)
    || /(?:^|\s)(?:ODD|EVEN) DAY(?:$|\s)/.test(n)
    || /\bMINIMUM DAY\b/.test(n)
    || (/\bADVISORY 1ST\b/.test(n) && /\b(?:ODD|EVEN) DAY\b/.test(n))
    || /\b(SPECIAL SCHEDULE|BELL SCHEDULE|LATE START|EARLY RELEASE|EARLY DISMISSAL|FINALS? SCHEDULE)\b/.test(n);
}

function findPublishedSpecialSchedule(schedules: BellSchedule[], event: SchoolEvent) {
  const title = normalizeTitle(event.title)
    .replace(/\b(?:ODD|EVEN) DAY\b/g, '')
    .replace(/\bBELL SCHEDULE\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.length < 5) return undefined;
  return schedules.find(schedule => {
    const name = normalizeTitle(schedule.name).replace(/\bBELL SCHEDULE\b/g, '').replace(/\s+/g, ' ').trim();
    return name.includes(title) || title.includes(name);
  });
}

function timeToMinutes(time: string) {
  const parsed = DateTime.fromFormat(time.toUpperCase(), 'h:mm a', { locale: 'en-US' });
  return parsed.isValid ? parsed.hour * 60 + parsed.minute : Number.NaN;
}

function statusAt(date: DateTime, periods: BellPeriod[], schoolDay: boolean) {
  if (!schoolDay) return 'no-school' as const;
  if (!periods.length) return 'unknown' as const;
  const minute = date.hour * 60 + date.minute + date.second / 60;
  const firstStart = timeToMinutes(periods[0].startTime);
  const lastEnd = timeToMinutes(periods[periods.length - 1].endTime);
  if (!Number.isFinite(firstStart) || !Number.isFinite(lastEnd)) return 'unknown' as const;
  if (minute < firstStart) return 'before-school' as const;
  for (const period of periods) {
    const start = timeToMinutes(period.startTime);
    const end = timeToMinutes(period.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (minute >= start && minute < end) {
      if (period.kind === 'lunch') return 'lunch' as const;
      if (period.kind === 'advisory') return 'advisory' as const;
      if (period.kind === 'nutrition') return 'nutrition' as const;
      return 'in-session' as const;
    }
  }
  if (minute >= lastEnd) return 'after-school' as const;
  return 'passing' as const;
}

export function resolveSchoolDay(
  date: DateTime,
  events: SchoolEvent[],
  schedules: BellSchedule[],
  sourceState = { bell: 'live', calendar: 'live' }
): TodayResponse {
  const local = date.setZone(config.timezone);
  const todaysEvents = events.filter(e => eventTouchesDate(e, local));
  const dayType = detectDayType(todaysEvents);
  const specialEvents = todaysEvents.filter(isSpecialCalendarEvent);
  const warnings: string[] = [];
  if (dayType === 'unknown') {
    const normalized = todaysEvents.map(e => normalizeTitle(e.title));
    const hasOdd = normalized.some(t => /(?:^|\s)ODD DAY(?:$|\s)/.test(t));
    const hasEven = normalized.some(t => /(?:^|\s)EVEN DAY(?:$|\s)/.test(t));
    if (hasOdd && hasEven) warnings.push('The official calendar contains both ODD DAY and EVEN DAY markers for this date, so the day type cannot be verified.');
  }

  const base = {
    date: local.toISODate()!,
    timezone: config.timezone,
    dayType,
    allEvents: todaysEvents,
    specialEvents,
    warnings,
    sourceState
  };

  if (local.weekday >= 6) return { ...base, schoolDay: false, status: 'weekend', periods: [], reason: 'Weekend' };

  const noSchool = todaysEvents.find(e => isNoSchool(e.title));
  if (noSchool) return { ...base, schoolDay: false, status: 'no-school', periods: [], reason: noSchool.title };

  const minimum = todaysEvents.some(e => /\bMINIMUM DAY\b/.test(normalizeTitle(e.title)));
  const specialEvent = findUnknownSpecial(todaysEvents);
  let schedule: BellSchedule | undefined;

  if (minimum) {
    schedule = findSchedule(schedules, 'minimum-day', /minimum/i);
  } else if (specialEvent) {
    schedule = findPublishedSpecialSchedule(schedules, specialEvent);
    if (!schedule) {
      warnings.push(`Special schedule noted on today's official calendar: “${specialEvent.title}.” Lincoln's published bell-schedule page does not currently provide a matching schedule, so exact period times cannot be verified.`);
    }
  } else if (local.weekday === 2) {
    schedule = findSchedule(schedules, 'professional-development-tuesday', /professional development/i);
  } else if ([1, 3].includes(local.weekday)) {
    schedule = findSchedule(schedules, 'regular-mon-wed', /monday.*wednesday/i);
  } else if ([4, 5].includes(local.weekday)) {
    schedule = findSchedule(schedules, 'regular-thu-fri', /thursday.*friday/i);
  }

  if (!schedule && !warnings.some(w => w.includes('exact period times cannot be verified'))) {
    warnings.push("Today's exact bell schedule could not be verified. Check the official Lincoln calendar before relying on these times.");
  }

  const periods = schedule ? schedule.periods.map(p => ({ ...p, name: transformPeriodName(p.rawName, dayType) })) : [];
  return {
    ...base,
    schoolDay: true,
    status: statusAt(local, periods, true),
    scheduleType: schedule?.id,
    scheduleName: schedule?.name,
    schedule,
    periods,
    sourceUpdatedAt: schedule?.fetchedAt
  };
}
