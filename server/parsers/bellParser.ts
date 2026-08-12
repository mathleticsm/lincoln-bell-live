import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { BellPeriod, BellSchedule } from '../../src/types/index.js';

const TIME_RE = /\b(1[0-2]|0?\d):[0-5]\d\s*(AM|PM)\b/i;

function slug(name: string) {
  const normalized = name.toLowerCase();
  if (/monday.*wednesday/.test(normalized)) return 'regular-mon-wed';
  if (/thursday.*friday/.test(normalized)) return 'regular-thu-fri';
  if (/minimum/.test(normalized)) return 'minimum-day';
  if (/professional development/.test(normalized)) return 'professional-development-tuesday';
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function kind(name: string): BellPeriod['kind'] {
  if (/lunch/i.test(name)) return 'lunch';
  if (/advisory/i.test(name)) return 'advisory';
  if (/nutrition/i.test(name)) return 'nutrition';
  if (/period|\d+\/\d+/i.test(name)) return 'class';
  return 'other';
}

function duration(startTime: string, endTime: string) {
  const start = DateTime.fromFormat(startTime.trim().toUpperCase(), 'h:mm a', { locale: 'en-US' });
  const end = DateTime.fromFormat(endTime.trim().toUpperCase(), 'h:mm a', { locale: 'en-US' });
  if (!start.isValid || !end.isValid) return undefined;
  const minutes = Math.round(end.diff(start, 'minutes').minutes);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : undefined;
}

function normalizedTime(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function clockMinutes(value: string) {
  const parsed = DateTime.fromFormat(value.trim().toUpperCase(), 'h:mm a', { locale: 'en-US' });
  return parsed.isValid ? parsed.hour * 60 + parsed.minute : undefined;
}

function isChronological(periods: BellPeriod[]) {
  let previousEnd = -1;
  for (const period of periods) {
    const start = clockMinutes(period.startTime);
    const end = clockMinutes(period.endTime);
    if (start === undefined || end === undefined || end <= start || start < previousEnd) return false;
    previousEnd = end;
  }
  return true;
}

export function parseBellSchedules(html: string, sourceUrl: string, fetchedAt = new Date().toISOString()): BellSchedule[] {
  const $ = cheerio.load(html);
  const schedules: BellSchedule[] = [];

  $('table').each((_, table) => {
    const periods: BellPeriod[] = [];
    $(table).find('tr').each((__, row) => {
      const cells = $(row).find('th,td').map((___, element) => $(element).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length < 3) return;
      const start = cells.find((cell, index) => index > 0 && TIME_RE.test(cell));
      const startIndex = start ? cells.indexOf(start) : -1;
      const end = startIndex >= 0 ? cells.slice(startIndex + 1).find(cell => TIME_RE.test(cell)) : undefined;
      if (!start || !end) return;
      const durationMinutes = duration(start, end);
      if (durationMinutes === undefined) return;
      const rawName = cells[0];
      if (!rawName) return;
      periods.push({
        name: rawName,
        rawName,
        startTime: normalizedTime(start),
        endTime: normalizedTime(end),
        durationMinutes,
        kind: kind(rawName)
      });
    });
    if (!periods.length || !isChronological(periods)) return;

    const titleCandidates = $(table).prevAll('h1,h2,h3,h4,h5,strong,b,a').slice(0, 6)
      .map((__, element) => $(element).text().replace(/\s+/g, ' ').trim()).get();
    let name = titleCandidates.find(title => /schedule|tuesday/i.test(title));
    if (!name) {
      const parentText = $(table).parent().text().replace(/\s+/g, ' ').trim();
      name = parentText.match(/(Regular Bell Schedule \([^)]*\)|Minimum Day Schedule|Professional Development Tuesdays?)/i)?.[1];
    }
    if (!name) return;

    const previous = $(table).prev();
    const previousText = previous.text().replace(/\s+/g, ' ').trim();
    const description = previous.length && previousText && !/schedule/i.test(previousText) ? previousText : undefined;
    schedules.push({ id: slug(name), name, description, periods, sourceUrl, fetchedAt, dataMode: 'live' });
  });

  {
    // Text fallback supplements any known schedule family missed by table parsing.
    const text = $.root().text().replace(/\s+/g, ' ');
    const names = [
      'Regular Bell Schedule (Monday/Wednesday)',
      'Regular Bell Schedule (Thursday/Friday)',
      'Minimum Day Schedule',
      'Professional Development Tuesdays'
    ];
    for (let index = 0; index < names.length; index += 1) {
      if (schedules.some(schedule => schedule.id === slug(names[index]))) continue;
      const startAt = text.toLowerCase().indexOf(names[index].toLowerCase());
      if (startAt < 0) continue;
      const nextName = names[index + 1];
      const endAt = nextName ? text.toLowerCase().indexOf(nextName.toLowerCase(), startAt + 1) : text.length;
      const chunk = text.slice(startAt, endAt > startAt ? endAt : text.length);
      const pattern = /(Period\s+[1-8]\/[1-8](?:\s*\(BIC\))?|Lunch|Advisory|Nutrition)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)/gi;
      const periods: BellPeriod[] = [];
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(chunk))) {
        const durationMinutes = duration(match[2], match[3]);
        if (durationMinutes === undefined) continue;
        periods.push({
          name: match[1],
          rawName: match[1],
          startTime: normalizedTime(match[2]),
          endTime: normalizedTime(match[3]),
          durationMinutes,
          kind: kind(match[1])
        });
      }
      if (periods.length && isChronological(periods)) schedules.push({ id: slug(names[index]), name: names[index], periods, sourceUrl, fetchedAt, dataMode: 'live' });
    }
  }

  const unique = new Map(schedules.map(schedule => [schedule.id, schedule]));
  return [...unique.values()];
}
