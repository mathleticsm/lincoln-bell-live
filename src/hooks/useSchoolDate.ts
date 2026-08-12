import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { ZONE } from '../lib/time';

function currentSchoolDate() {
  return DateTime.now().setZone(ZONE).toISODate()!;
}

export function useSchoolDate() {
  const [date, setDate] = useState(currentSchoolDate);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = DateTime.now().setZone(ZONE);
      const next = now.plus({ days: 1 }).startOf('day').plus({ seconds: 1 });
      timer = window.setTimeout(() => {
        setDate(currentSchoolDate());
        schedule();
      }, Math.max(1000, next.diff(now, 'milliseconds').milliseconds));
    };
    const onVisible = () => {
      if (!document.hidden) setDate(currentSchoolDate());
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return date;
}
