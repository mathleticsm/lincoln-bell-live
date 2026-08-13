import type { ApiEnvelope, BellSchedule, RefreshResponse, SchoolEvent, StatusResponse, TodayResponse } from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  today: (date?: string) => request<ApiEnvelope<TodayResponse>>(`/api/today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  schedules: () => request<ApiEnvelope<BellSchedule[]>>('/api/bell-schedules'),
  events: (start: string, end: string) => request<ApiEnvelope<SchoolEvent[]>>(`/api/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  status: () => request<StatusResponse>('/api/status'),
  refresh: () => request<RefreshResponse>('/api/refresh', { method: 'POST' })
};
