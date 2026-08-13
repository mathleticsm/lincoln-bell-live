import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { ZONE } from '../lib/time';
export function useLiveClock(intervalMs = 1000){
  const [now,setNow]=useState(()=>DateTime.now().setZone(ZONE));
  useEffect(()=>{const tick=()=>setNow(DateTime.now().setZone(ZONE)); const id=window.setInterval(tick,intervalMs); const onVis=()=>{if(!document.hidden)tick();}; document.addEventListener('visibilitychange',onVis); return()=>{clearInterval(id);document.removeEventListener('visibilitychange',onVis);};},[intervalMs]);
  return now;
}
