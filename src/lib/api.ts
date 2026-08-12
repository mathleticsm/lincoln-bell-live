import type { ApiEnvelope, BellSchedule, SchoolEvent, TodayResponse } from '../types';

async function request<T>(url:string, init?:RequestInit):Promise<T>{
  const res=await fetch(url,init);
  if(!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `Request failed (${res.status})`);
  return res.json();
}
export const api={
  today:(date?:string)=>request<ApiEnvelope<TodayResponse>>(`/api/today${date?`?date=${date}`:''}`),
  schedules:()=>request<ApiEnvelope<BellSchedule[]>>('/api/bell-schedules'),
  events:(start:string,end:string)=>request<ApiEnvelope<SchoolEvent[]>>(`/api/events?start=${start}&end=${end}`),
  status:()=>request<Record<string,unknown>>('/api/status'),
  refresh:()=>request<{ok:boolean;bell:{sourceAvailable:boolean;stale:boolean};calendar:{sourceAvailable:boolean;stale:boolean}}>('/api/refresh',{method:'POST'})
};
