import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBellSchedules } from '../server/parsers/bellParser.js';

const html = `<h2>Regular Bell Schedule (Monday/Wednesday)</h2><table><tr><th>Description / Period</th><th>Start Time</th><th>End Time</th></tr><tr><td>Period 1/2 (BIC)</td><td>8:30 AM</td><td>10:09 AM</td></tr></table><h2>Regular Bell Schedule (Thursday/Friday)</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>10:01 AM</td></tr></table><h2>Minimum Day Schedule</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:38 AM</td></tr></table><h2>Professional Development Tuesdays</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:54 AM</td></tr></table>`;

describe('bell parser', () => {
  it('parses exactly the current official schedule sections from a realistic fixture', () => {
    const fixture = readFileSync(new URL('./fixtures/lincoln-bell-schedules.html', import.meta.url), 'utf8');
    const parsed = parseBellSchedules(fixture, 'https://www.lincolnhs.org/apps/bell_schedules/');
    expect(parsed.map(schedule => schedule.id)).toEqual([
      'regular-mon-wed', 'regular-thu-fri', 'minimum-day', 'professional-development-tuesday'
    ]);
    expect(parsed.every(schedule => schedule.periods.length >= 5)).toBe(true);
  });

  it('finds current schedule families', () => {
    const parsed = parseBellSchedules(html, 'https://www.lincolnhs.org/apps/bell_schedules/');
    expect(parsed.map(schedule => schedule.id)).toEqual(expect.arrayContaining(['regular-mon-wed', 'regular-thu-fri', 'minimum-day', 'professional-development-tuesday']));
    expect(parsed[0].periods[0].durationMinutes).toBe(99);
  });


  it('does not turn the printer-friendly page heading into a bell schedule', () => {
    const printerLike = `<h1>Lincoln High School — Bell Schedules</h1>
      <div>
        <p>Professional Development Tuesdays</p>
        <table>
          <tr><td>Period 1/2 (BIC)</td><td>8:30 AM</td><td>9:54 AM</td></tr>
          <tr><td>Period 3/4</td><td>9:59 AM</td><td>11:14 AM</td></tr>
          <tr><td>Period 5/6</td><td>11:19 AM</td><td>12:34 PM</td></tr>
          <tr><td>Lunch</td><td>12:34 PM</td><td>1:04 PM</td></tr>
          <tr><td>Period 7/8</td><td>1:09 PM</td><td>2:24 PM</td></tr>
        </table>
      </div>`;
    const parsed = parseBellSchedules(printerLike, 'https://www.lincolnhs.org/apps/bell_schedules/');
    expect(parsed.some(schedule => /Lincoln High School.*Bell Schedules/i.test(schedule.name))).toBe(false);
    expect(parsed.filter(schedule => schedule.id === 'professional-development-tuesday')).toHaveLength(1);
  });

  it('does not accept backwards or malformed period times', () => {
    const malformed = `<h2>Minimum Day Schedule</h2><table><tr><td>Period 1/2</td><td>10:30 AM</td><td>9:30 AM</td></tr></table>`;
    expect(parseBellSchedules(malformed, 'https://www.lincolnhs.org/apps/bell_schedules/')).toEqual([]);
  });

  it('rejects a schedule whose rows move backward in time', () => {
    const malformed = `<h2>Minimum Day Schedule</h2><table>
      <tr><td>Period 1/2</td><td>8:30 AM</td><td>9:38 AM</td></tr>
      <tr><td>Period 3/4</td><td>9:30 AM</td><td>10:41 AM</td></tr>
    </table>`;
    expect(parseBellSchedules(malformed, 'https://www.lincolnhs.org/apps/bell_schedules/')).toEqual([]);
  });

  it('dynamically discovers a newly published schedule family', () => {
    const future = `<section><h2>Testing Schedule</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:30 AM</td></tr><tr><td>Period 3/4</td><td>9:35 AM</td><td>10:35 AM</td></tr></table></section>`;
    expect(parseBellSchedules(future, 'https://www.lincolnhs.org/apps/bell_schedules/')).toMatchObject([{ id: 'testing-schedule', name: 'Testing Schedule' }]);
  });

  it('deduplicates repeated wrapper copies of a schedule', () => {
    const duplicate = `<h2>Assembly Schedule</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:30 AM</td></tr></table><h2>Assembly Schedule</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:30 AM</td></tr></table>`;
    expect(parseBellSchedules(duplicate, 'https://www.lincolnhs.org/apps/bell_schedules/')).toHaveLength(1);
  });
});
