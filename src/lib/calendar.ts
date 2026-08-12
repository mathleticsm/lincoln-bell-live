import { DateTime } from 'luxon';

export function monthGridStart(month: DateTime) {
  const first = month.startOf('month');
  // Luxon weekdays are Monday=1 ... Sunday=7. `% 7` makes Sunday offset zero.
  return first.minus({ days: first.weekday % 7 }).startOf('day');
}
