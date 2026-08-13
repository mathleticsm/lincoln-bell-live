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

function isGenericPageHeading(name: string) {
  const normalized = name.replace(/\s+/g, ' ').trim();
  return /^bell schedules?$/i.test(normalized)
    || (/lincoln high school/i.test(normalized) && /bell schedules?/i.test(normalized))
    || /^(?:print|printer friendly|description \/ period|start time|end time|length)$/i.test(normalized);
}

function looksLikeScheduleName(name: string) {
  const normalized = name.replace(/\s+/g, ' ').trim();
  return normalized.length >= 4
    && normalized.length <= 160
    && !isGenericPageHeading(normalized)
    && /\b(?:schedule|tuesdays?)\b/i.test(normalized)
    && !/^print schedules?\b/i.test(normalized)
    && !/\b(?:share|shares|same)\b/i.test(normalized);
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

    const titleCandidates = $(table).find('caption').slice(0, 1)
      .map((__, element) => $(element).text().replace(/\s+/g, ' ').trim()).get();
    titleCandidates.push(...$(table).prevAll('h1,h2,h3,h4,h5,strong,b,a,p').slice(0, 8)
      .map((__, element) => $(element).text().replace(/\s+/g, ' ').trim()).get());
    const singleTableContainer = $(table).parents().filter((__, element) => $(element).find('table').length === 1).first();
    if (singleTableContainer.length) {
      titleCandidates.push(...singleTableContainer.find('h1,h2,h3,h4,h5,strong,b,a,p')
        .filter((__, element) => $(element).closest('table').length === 0)
        .slice(0, 12)
        .map((__, element) => $(element).text().replace(/\s+/g, ' ').trim()).get());
    }
    let name = titleCandidates.find(looksLikeScheduleName);
    if (!name) {
      const parentText = $(table).parent().text().replace(/\s+/g, ' ').trim();
      name = parentText.match(/([^.!?]{0,100}\b(?:Bell Schedule(?:\s*\([^)]*\))?|Day Schedule|Development Tuesdays?|Assembly Schedule|Testing Schedule)\b)/i)?.[1]?.trim();
    }
    if (!name || !looksLikeScheduleName(name)) return;

    const officialDescription = $(table).find('.bell-schedule-description').first().text().replace(/\s+/g, ' ').trim();
    const previous = $(table).prev();
    const previousText = previous.text().replace(/\s+/g, ' ').trim();
    const description = officialDescription || (previous.length && previousText && !/schedule/i.test(previousText) ? previousText : undefined);
    schedules.push({ id: slug(name), name, description, periods, sourceUrl, fetchedAt, dataMode: 'live' });
  });

  {
    // A heading-based text fallback remains dynamic if harmless markup changes
    // remove the tables while preserving schedule headings and row text.
    const headings = $('h1,h2,h3,h4,h5').filter((__, element) => looksLikeScheduleName($(element).text()));
    headings.each((__, element) => {
      const name = $(element).text().replace(/\s+/g, ' ').trim();
      if (schedules.some(schedule => schedule.id === slug(name))) return;
      const chunk = [$(element).text(), ...$(element).nextUntil('h1,h2,h3,h4,h5').map((___, sibling) => $(sibling).text()).get()]
        .join(' ').replace(/\s+/g, ' ');
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
      if (periods.length && isChronological(periods)) schedules.push({ id: slug(name), name, periods, sourceUrl, fetchedAt, dataMode: 'live' });
    });
  }

  const unique = new Map<string, BellSchedule>();
  for (const schedule of schedules) {
    if (!looksLikeScheduleName(schedule.name) || !schedule.id || !schedule.periods.length || !isChronological(schedule.periods)) continue;
    if (!unique.has(schedule.id)) unique.set(schedule.id, schedule);
  }
  return [...unique.values()];
}
