import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import type { TodayResponse } from '../types';
import { computeLiveState, computeSchoolMetrics, formatCountdown, formatDuration, ZONE } from '../lib/time';
import { useLiveClock } from '../hooks/useLiveClock';

function scheduleLabel(name: string) {
  return name.replace(/Regular Bell Schedule/i, '').replace(/[()]/g, '').replace(/Schedule$/i, '').trim();
}

function Badges({ today, special = false }: { today: TodayResponse; special?: boolean }) {
  return <span className="badges">
    <b className={today.dayType === 'unknown' ? 'neutral' : ''}>{today.dayType === 'unknown' ? 'DAY TYPE UNVERIFIED' : `${today.dayType.toUpperCase()} DAY`}</b>
    {special ? <b className="warning-badge">SPECIAL SCHEDULE</b> : today.scheduleName && <b>{scheduleLabel(today.scheduleName)}</b>}
    {today.sourceState.bell === 'fallback' && <b className="warning-badge">FALLBACK TIMES</b>}
  </span>;
}

function StaticHero({ today }: { today: TodayResponse }) {
  const displayDate = DateTime.fromISO(today.date, { zone: ZONE });
  const special = today.schoolDay && !today.schedule && today.specialEvents.length > 0;
  const primarySpecial = today.specialEvents.find(event => /schedule|advisory|assembly|testing|finals|odd day|even day/i.test(event.title)) || today.specialEvents[0];

  if (special) {
    return <section className="hero-card special-hero">
      <div className="eyebrow"><span>{displayDate.toFormat('cccc, LLLL d')}</span><Badges today={today} special/></div>
      <div className="special-content">
        <div className="special-icon" aria-hidden="true"><AlertTriangle/></div>
        <div><p className="kicker">Special schedule confirmed</p><h1>{primarySpecial?.title || 'Special Schedule'}</h1>
          <p>Lincoln’s official calendar indicates a different schedule today. Lincoln has not published matching bell times, so exact period times cannot be verified.</p></div>
      </div>
      {today.allEvents.length > 0 && <div className="official-evidence"><strong>Official events</strong><ul>{today.allEvents.map(event => <li key={event.id}>{event.title}</li>)}</ul></div>}
      <div className="hero-actions"><a className="primary-button" href="https://www.lincolnhs.org/apps/events/" target="_blank" rel="noreferrer">View official calendar <ArrowUpRight size={16}/></a><a className="secondary-button" href="https://www.lincolnhs.org/apps/bell_schedules/" target="_blank" rel="noreferrer">Published bell schedules</a></div>
      <details className="explanation"><summary>Why aren’t times shown?</summary><p>The calendar confirms that a different schedule is in effect, but Lincoln’s official bell-schedule page does not provide matching times. Lincoln Bell Live does not guess unpublished bell times.</p></details>
    </section>;
  }

  const title = today.status === 'weekend' ? 'No School This Weekend' : today.status === 'no-school' ? 'No School Today' : 'Schedule Unverified';
  return <section className="hero-card static-hero">
    <div className="eyebrow"><span>{displayDate.toFormat('cccc, LLLL d')}</span><Badges today={today}/></div>
    <div className="static-state"><CalendarClock/><div><p className="kicker">{today.status === 'unknown' ? 'Official information incomplete' : 'School day status'}</p><h1>{title}</h1>{today.reason && <p className="reason">{today.reason}</p>}</div></div>
  </section>;
}

function LiveScheduleHero({ today }: { today: TodayResponse }) {
  const now = useLiveClock();
  const live = computeLiveState(now, today.date, today.periods, today.schoolDay);
  const metrics = computeSchoolMetrics(now, today.date, today.periods);
  const displayDate = DateTime.fromISO(today.date, { zone: ZONE });
  const announcement = live.status === 'passing' && live.next
    ? `Passing period. ${live.next.name} begins next.`
    : live.current ? `${live.current.name} is now in progress.` : live.label;
  const [announced, setAnnounced] = useState('');

  useEffect(() => setAnnounced(announcement), [announcement]);

  const heading = live.status === 'passing' ? 'Passing Period' : live.current?.name || live.label;
  const kicker = live.status === 'passing' ? `${live.next?.name || 'Next class'} begins in` : live.status === 'before-school' ? 'School begins in' : live.status === 'after-school' ? 'Today’s classes are complete' : live.status.replace('-', ' ');

  return <section className="hero-card">
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announced}</p>
    <div className="eyebrow"><span>{displayDate.toFormat('cccc, LLLL d')}</span><Badges today={today}/></div>
    <div className="hero-main">
      <div><p className="kicker">{kicker}</p><h1>{heading}</h1>{live.current && <p className="period-time">{live.current.startTime} – {live.current.endTime}</p>}</div>
      {live.secondsRemaining !== undefined && live.status !== 'after-school' && <div className="countdown"><strong>{formatCountdown(live.secondsRemaining)}</strong><span>{live.status === 'passing' || live.status === 'before-school' ? 'until start' : 'remaining'}</span></div>}
    </div>
    {live.progress !== undefined && <div className="progress" role="progressbar" aria-label={`Progress through ${live.current?.name || 'current period'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(live.progress * 100)}><span style={{ width: `${live.progress * 100}%` }}/></div>}
    {live.next && <p className="next-line"><span>NEXT</span>{live.next.name}<b>{live.next.startTime}</b></p>}
    <div className="school-metrics">
      <span><CheckCircle2/>{metrics.completed} of {metrics.total} periods completed</span>
      {metrics.secondsUntilLunch !== undefined && <span>Lunch in <b>{formatDuration(metrics.secondsUntilLunch)}</b></span>}
      {metrics.secondsUntilDismissal !== undefined && <span>School ends in <b>{formatDuration(metrics.secondsUntilDismissal)}</b></span>}
    </div>
  </section>;
}

export function CurrentPeriodCard({ today }: { today: TodayResponse }) {
  return today.schoolDay && today.periods.length ? <LiveScheduleHero today={today}/> : <StaticHero today={today}/>;
}
