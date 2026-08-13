import { AlarmClock, CalendarRange } from 'lucide-react';
import { DateTime } from 'luxon';
import type { NextSchoolDay, SchoolDayPreview, SourceMode } from '../types';
import { ZONE } from '../lib/time';

function dateLabel(date: string, today: string) {
  const value = DateTime.fromISO(date, { zone: ZONE });
  const base = DateTime.fromISO(today, { zone: ZONE });
  if (value.diff(base, 'days').days === 1) return 'Tomorrow';
  return value.toFormat('cccc, LLL d');
}

function Preview({ item, today, label, bellMode }: { item: SchoolDayPreview; today: string; label?: string; bellMode: SourceMode }) {
  const title = !item.schoolDay ? 'NO SCHOOL' : item.specialSchedule ? 'SPECIAL SCHEDULE' : item.dayType === 'unknown' ? 'DAY TYPE UNVERIFIED' : `${item.dayType.toUpperCase()} DAY`;
  return <div className="next-preview">
    <div><span className="next-date">{label || dateLabel(item.date, today)}</span><strong>{title}</strong>{item.reason && <p>{item.reason}</p>}{item.scheduleName && <p>{item.scheduleName}</p>}{item.specialSchedule && <p>Exact bell times not published</p>}</div>
    {item.firstBell && <div className="first-bell"><AlarmClock/><span>First bell<b>{item.firstBell}</b>{bellMode === 'fallback' && <small>fallback</small>}</span></div>}
  </div>;
}

export function NextSchoolDayCard({ value, today, bellMode }: { value?: NextSchoolDay; today: string; bellMode: SourceMode }) {
  return <section className="card next-school-card">
    <div className="section-head"><div><p className="kicker">Plan ahead</p><h2>Next School Day</h2></div><CalendarRange/></div>
    {!value ? <div className="empty">The official calendar is unavailable, so the next school day cannot be verified.</div> : <>
      <Preview item={value.tomorrow} today={today} bellMode={bellMode}/>
      {!value.tomorrow.schoolDay && value.nextClasses && <Preview item={value.nextClasses} today={today} label="Next classes" bellMode={bellMode}/>} 
    </>}
  </section>;
}
