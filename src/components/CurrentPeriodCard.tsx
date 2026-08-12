import { DateTime } from 'luxon';
import type { TodayResponse } from '../types';
import { computeLiveState, formatCountdown, ZONE } from '../lib/time';
import { useLiveClock } from '../hooks/useLiveClock';

export function CurrentPeriodCard({ today }: { today: TodayResponse }) {
  const now = useLiveClock();
  const closedStatus = today.status === 'weekend' ? 'weekend' : 'no-school';
  const live = computeLiveState(now, today.date, today.periods, today.schoolDay, closedStatus);
  const displayDate = DateTime.fromISO(today.date, { zone: ZONE });
  const hero = live.current?.name || live.label;
  const specialSchedule = today.schoolDay && today.status === 'unknown' && today.specialEvents.length > 0;

  return <section className="hero-card">
    <div className="eyebrow">
      <span>{displayDate.isValid ? displayDate.toFormat('cccc, LLLL d') : now.toFormat('cccc, LLLL d')}</span>
      <span className="badges">
        <b>{today.dayType === 'unknown' ? 'DAY TYPE UNKNOWN' : `${today.dayType.toUpperCase()} DAY`}</b>
        {today.scheduleName && <b>{today.scheduleName.replace(/Regular Bell Schedule|\(|\)/g, '').trim()}</b>}
        {!today.scheduleName && specialSchedule && <b>SPECIAL SCHEDULE</b>}
      </span>
    </div>
    <div className="hero-main">
      <div>
        <p className="kicker">{specialSchedule ? 'Special schedule' : live.status === 'passing' ? 'Between classes' : live.status.replace('-', ' ')}</p>
        <h1>{hero}</h1>
        {live.current && <p className="period-time">{live.current.startTime} — {live.current.endTime}</p>}
      </div>
      {live.secondsRemaining !== undefined && live.status !== 'after-school'
        ? <div className="countdown"><strong>{formatCountdown(live.secondsRemaining)}</strong><span>{live.status === 'passing' ? 'until next period' : live.status === 'before-school' ? 'until school' : 'remaining'}</span></div>
        : null}
    </div>
    {live.progress !== undefined && <div className="progress" role="progressbar" aria-label={`Progress through ${live.current?.name || 'current period'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(live.progress * 100)}><span style={{ width: `${live.progress * 100}%` }} /></div>}
    {live.next && <p className="next-line"><span>NEXT</span> {live.next.name} <b>{live.next.startTime}</b></p>}
    {today.reason && <p className="reason">{today.reason}</p>}
  </section>;
}
