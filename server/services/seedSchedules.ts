import type { BellSchedule } from '../../src/types/index.js';
import { DateTime } from 'luxon';
import { config } from '../config.js';

function period(rawName: string, startTime: string, endTime: string) {
  const start = DateTime.fromFormat(startTime, 'h:mm a');
  const end = DateTime.fromFormat(endTime, 'h:mm a');
  const kind = /lunch/i.test(rawName) ? 'lunch' : /advisory/i.test(rawName) ? 'advisory' : /nutrition/i.test(rawName) ? 'nutrition' : /period/i.test(rawName) ? 'class' : 'other';
  return { name: rawName, rawName, startTime, endTime, durationMinutes: Math.round(end.diff(start, 'minutes').minutes), kind } as const;
}

const seededAt = 'bundled-fallback';
export const seedSchedules: BellSchedule[] = [
  { id: 'regular-mon-wed', name: 'Regular Bell Schedule (Monday/Wednesday)', description: 'All SLCs share the same bell schedule.', sourceUrl: config.bellPageUrl, fetchedAt: seededAt, dataMode: 'seed-fallback', periods: [period('Period 1/2 (BIC)','8:30 AM','10:09 AM'),period('Period 3/4','10:14 AM','11:44 AM'),period('Lunch','11:44 AM','12:14 PM'),period('Period 5/6','12:19 PM','1:49 PM'),period('Period 7/8','1:54 PM','3:24 PM')] },
  { id: 'regular-thu-fri', name: 'Regular Bell Schedule (Thursday/Friday)', sourceUrl: config.bellPageUrl, fetchedAt: seededAt, dataMode: 'seed-fallback', periods: [period('Period 1/2 (BIC)','8:30 AM','10:01 AM'),period('Period 3/4','10:06 AM','11:27 AM'),period('Advisory','11:32 AM','12:02 PM'),period('Lunch','12:02 PM','12:32 PM'),period('Period 5/6','12:37 PM','1:58 PM'),period('Period 7/8','2:03 PM','3:24 PM')] },
  { id: 'minimum-day', name: 'Minimum Day Schedule', description: 'Minimum Day', sourceUrl: config.bellPageUrl, fetchedAt: seededAt, dataMode: 'seed-fallback', periods: [period('Period 1/2','8:30 AM','9:38 AM'),period('Period 3/4','9:43 AM','10:41 AM'),period('Nutrition','10:41 AM','11:11 AM'),period('Period 5/6','11:16 AM','12:14 PM'),period('Period 7/8','12:19 PM','1:17 PM')] },
  { id: 'professional-development-tuesday', name: 'Professional Development Tuesdays', sourceUrl: config.bellPageUrl, fetchedAt: seededAt, dataMode: 'seed-fallback', periods: [period('Period 1/2 (BIC)','8:30 AM','9:54 AM'),period('Period 3/4','9:59 AM','11:14 AM'),period('Period 5/6','11:19 AM','12:34 PM'),period('Lunch','12:34 PM','1:04 PM'),period('Period 7/8','1:09 PM','2:24 PM')] }
];
