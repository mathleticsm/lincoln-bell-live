import ical from 'node-ical';
import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { SchoolEvent } from '../../src/types/index.js';
import { config } from '../config.js';

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 5000;
const MAX_LOCATION = 500;
const MAX_EXPANDED_EVENTS = 20_000;

function textValue(value: unknown, max: number) {
  const raw = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'val' in value && typeof (value as { val?: unknown }).val === 'string'
      ? (value as { val: string }).val
      : undefined;
  if (raw === undefined) return undefined;
  const normalized = raw.trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function safeEventSource(href: string, base: string) {
  try {
    const baseUrl = new URL(base);
    const url = new URL(href || base, baseUrl);
    return url.protocol === 'https:' && url.origin === baseUrl.origin ? url.toString() : baseUrl.toString();
  } catch {
    return base;
  }
}

export function parseIcsEvents(text: string, sourceUrl: string, referenceDate = DateTime.now().setZone(config.timezone)): SchoolEvent[] {
  const parsed = ical.sync.parseICS(text);
  const out: SchoolEvent[] = [];
  const reference = referenceDate.setZone(config.timezone);
  const horizonStart = reference.minus({ months: 6 }).startOf('day');
  const horizonEnd = reference.plus({ months: 18 }).endOf('day');

  for (const [key, value] of Object.entries(parsed)) {
    if (out.length >= MAX_EXPANDED_EVENTS) break;
    if (!value || value.type !== 'VEVENT' || !value.start) continue;
    if (value.rrule && /FREQ=(?:SECONDLY|MINUTELY|HOURLY)/i.test(String(value.rrule))) {
      throw new Error('Calendar contains an unsupported high-frequency recurrence');
    }

    type IcalInstance = { start: Date; end?: Date; summary?: unknown; description?: unknown; location?: unknown; isFullDay?: boolean };
    const instances: IcalInstance[] = value.rrule
      ? ical.expandRecurringEvent(value, {
          from: horizonStart.toJSDate(),
          to: horizonEnd.toJSDate(),
          includeOverrides: true,
          excludeExdates: true,
          expandOngoing: true
        }).map(instance => ({
          start: instance.start,
          end: instance.end,
          summary: instance.summary,
          description: instance.event.description,
          location: instance.event.location,
          isFullDay: instance.isFullDay
        }))
      : [{
          start: value.start,
          end: value.end,
          summary: value.summary,
          description: value.description,
          location: value.location,
          isFullDay: Boolean((value.start as Date & { dateOnly?: boolean }).dateOnly)
        }];

    for (const instance of instances.slice(0, 1000)) {
      if (out.length >= MAX_EXPANDED_EVENTS) break;
      const startDate = instance.start;
      const allDay = Boolean(instance.isFullDay || (startDate as Date & { dateOnly?: boolean }).dateOnly);
      const sourceZone = (startDate as Date & { tz?: string }).tz || (allDay ? 'UTC' : config.timezone);
      const start = DateTime.fromJSDate(startDate, { zone: sourceZone }).setZone(config.timezone, { keepLocalTime: allDay });
      if (!start.isValid) continue;

      const endDate = instance.end;
      const parsedEnd = endDate
        ? DateTime.fromJSDate(endDate, { zone: (endDate as Date & { tz?: string }).tz || sourceZone }).setZone(config.timezone, { keepLocalTime: allDay })
        : undefined;
      const end = parsedEnd?.isValid ? parsedEnd : undefined;
      const title = textValue(instance.summary, MAX_TITLE) || textValue(value.summary, MAX_TITLE) || 'Untitled event';

      out.push({
        id: `${value.uid || key}:${start.toISO()}`,
        title,
        description: textValue(instance.description, MAX_DESCRIPTION) || textValue(value.description, MAX_DESCRIPTION),
        location: textValue(instance.location, MAX_LOCATION) || textValue(value.location, MAX_LOCATION),
        start: allDay ? start.toISODate()! : start.toISO()!,
        end: end ? (allDay ? end.toISODate()! : end.toISO()!) : undefined,
        allDay,
        sourceUrl
      });
    }
  }
  return dedupe(out);
}

export function parseEventsHtml(html: string, sourceUrl: string): SchoolEvent[] {
  const $ = cheerio.load(html);
  const out: SchoolEvent[] = [];
  let currentDate: DateTime | null = null;
  let active = false;
  const bodyText = $('body').text();
  const pageYearMatch = bodyText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  const pageYear = Number(pageYearMatch?.[2]);

  $('body').find('h1,h2,h3,h4,li,a,div').each((_, element) => {
    if (out.length >= MAX_EXPANDED_EVENTS) return false;
    const ownText = $(element).clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
    if (/^Events$/i.test(ownText) && /^h[1-4]$/i.test(element.tagName)) {
      active = true;
      return;
    }
    if (active && /^Events in [A-Z][a-z]+ \d{4}$/i.test(ownText)) {
      active = false;
      return false;
    }
    if (!active) return;

    const dateMatch = ownText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat))?\b/i);
    if (dateMatch) {
      const month = DateTime.fromFormat(dateMatch[1], 'LLL', { locale: 'en-US' }).month;
      const now = DateTime.now().setZone(config.timezone);
      let year = Number.isFinite(pageYear) ? pageYear : now.year;
      if (!Number.isFinite(pageYear)) {
        if (month < now.month - 6) year += 1;
        if (month > now.month + 6) year -= 1;
      }
      const parsedDate = DateTime.fromObject({ year, month, day: Number(dateMatch[2]) }, { zone: config.timezone });
      currentDate = parsedDate.isValid ? parsedDate : null;
      return;
    }

    if (!currentDate || element.tagName !== 'a') return;
    const title = ($(element).text().replace(/\s+/g, ' ').trim()).slice(0, MAX_TITLE);
    const href = $(element).attr('href') || '';
    if (!title || /^\d+$/.test(title) || /print|calendar|today|subscribe/i.test(title)) return;

    const context = $(element).parent().text().replace(/\s+/g, ' ').trim();
    const time = context.match(/\b((?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*[AP]M)(?:\s*[–-]\s*((?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*[AP]M))?/i);
    let start: string;
    let end: string | undefined;
    let allDay = true;

    if (time) {
      const format = time[1].includes(':') ? 'h:mm a' : 'h a';
      const parsedStart = DateTime.fromFormat(time[1].toUpperCase(), format, { zone: config.timezone, locale: 'en-US' });
      if (!parsedStart.isValid) return;
      allDay = false;
      const startDateTime = currentDate.set({ hour: parsedStart.hour, minute: parsedStart.minute });
      start = startDateTime.toISO()!;

      if (time[2]) {
        const endFormat = time[2].includes(':') ? 'h:mm a' : 'h a';
        const parsedEndTime = DateTime.fromFormat(time[2].toUpperCase(), endFormat, { zone: config.timezone, locale: 'en-US' });
        if (parsedEndTime.isValid) {
          let endDateTime = currentDate.set({ hour: parsedEndTime.hour, minute: parsedEndTime.minute });
          if (endDateTime.toMillis() <= startDateTime.toMillis()) endDateTime = endDateTime.plus({ days: 1 });
          end = endDateTime.toISO()!;
        }
      }
    } else {
      start = currentDate.toISODate()!;
    }

    out.push({
      id: `html:${start}:${title}`,
      title,
      start,
      end,
      allDay,
      sourceUrl: safeEventSource(href, sourceUrl)
    });
  });
  return dedupe(out);
}

function dedupe(events: SchoolEvent[]) {
  const map = new Map<string, SchoolEvent>();
  for (const event of events) map.set(`${event.title.toLowerCase()}|${event.start}|${event.end || ''}|${(event.location || '').toLowerCase()}`, event);
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
