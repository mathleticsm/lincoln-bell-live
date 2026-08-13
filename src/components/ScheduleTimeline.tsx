import { Check, Circle, Clock3 } from 'lucide-react';
import type { BellPeriod } from '../types';
import { parseSchoolTime } from '../lib/time';
import { useLiveClock } from '../hooks/useLiveClock';

export function ScheduleTimeline({ date, periods }: { date: string; periods: BellPeriod[] }) {
  const now = useLiveClock(30_000);
  return <section className="card timeline-card">
    <div className="section-head"><div><p className="kicker">Verified bell times</p><h2>Today’s timeline</h2></div></div>
    {periods.length ? <ol className="timeline">{periods.map(period => {
      const start = parseSchoolTime(date, period.startTime);
      const end = parseSchoolTime(date, period.endTime);
      const nowMilliseconds = now.toMillis();
      const state = nowMilliseconds >= end.toMillis() ? 'done' : nowMilliseconds >= start.toMillis() && nowMilliseconds < end.toMillis() ? 'current' : 'upcoming';
      const StateIcon = state === 'done' ? Check : state === 'current' ? Clock3 : Circle;
      return <li key={`${period.rawName}-${period.startTime}`} className={state}>
        <time>{period.startTime.replace(' AM', '').replace(' PM', '')}</time>
        <div><strong>{period.name}</strong><span>{period.startTime} – {period.endTime} · {period.durationMinutes} min</span></div>
        <em><StateIcon size={14}/><span className="sr-only">{state === 'current' ? 'Current' : state === 'done' ? 'Completed' : 'Upcoming'}</span>{state === 'current' && <span aria-hidden="true">NOW</span>}</em>
      </li>;
    })}</ol> : <div className="unverified-timeline"><Clock3/><div><strong>Today’s exact timeline isn’t published.</strong><p>Lincoln has not provided verified bell times for this schedule. Official calendar evidence remains visible above.</p></div></div>}
  </section>;
}
