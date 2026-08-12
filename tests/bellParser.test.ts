import { describe, it, expect } from 'vitest';
import { parseBellSchedules } from '../server/parsers/bellParser.js';

const html = `<h2>Regular Bell Schedule (Monday/Wednesday)</h2><table><tr><th>Description / Period</th><th>Start Time</th><th>End Time</th></tr><tr><td>Period 1/2 (BIC)</td><td>8:30 AM</td><td>10:09 AM</td></tr></table><h2>Regular Bell Schedule (Thursday/Friday)</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>10:01 AM</td></tr></table><h2>Minimum Day Schedule</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:38 AM</td></tr></table><h2>Professional Development Tuesdays</h2><table><tr><td>Period 1/2</td><td>8:30 AM</td><td>9:54 AM</td></tr></table>`;

describe('bell parser', () => {
  it('finds current schedule families', () => {
    const parsed = parseBellSchedules(html, 'https://www.lincolnhs.org/apps/bell_schedules/');
    expect(parsed.map(schedule => schedule.id)).toEqual(expect.arrayContaining(['regular-mon-wed', 'regular-thu-fri', 'minimum-day', 'professional-development-tuesday']));
    expect(parsed[0].periods[0].durationMinutes).toBe(99);
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
});
