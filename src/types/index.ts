export interface BellPeriod {
  name: string;
  rawName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  kind: 'class' | 'lunch' | 'advisory' | 'nutrition' | 'other';
}

export interface BellSchedule {
  id: string;
  name: string;
  description?: string;
  periods: BellPeriod[];
  sourceUrl: string;
  fetchedAt: string;
  dataMode: 'live' | 'cached' | 'fallback';
}

export interface SchoolEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end?: string;
  allDay: boolean;
  sourceUrl?: string;
  category?: string;
}

export type DayType = 'odd' | 'even' | 'unknown';
export type SchoolStatus = 'before-school' | 'in-session' | 'passing' | 'lunch' | 'advisory' | 'nutrition' | 'after-school' | 'no-school' | 'weekend' | 'unknown';
export type SourceMode = 'live' | 'cached' | 'fallback' | 'unavailable' | 'browser-cache';

export interface SchoolDayPreview {
  date: string;
  schoolDay: boolean;
  dayType: DayType;
  status: SchoolStatus;
  reason?: string;
  scheduleName?: string;
  firstBell?: string;
  exactTimesVerified: boolean;
  specialSchedule: boolean;
}

export interface NextSchoolDay {
  tomorrow: SchoolDayPreview;
  nextClasses?: SchoolDayPreview;
}

export interface TodayResponse {
  date: string;
  timezone: string;
  schoolDay: boolean;
  dayType: DayType;
  status: SchoolStatus;
  scheduleType?: string;
  scheduleName?: string;
  schedule?: BellSchedule;
  periods: BellPeriod[];
  specialEvents: SchoolEvent[];
  allEvents: SchoolEvent[];
  sourceUpdatedAt?: string;
  warnings: string[];
  reason?: string;
  sourceState: { bell: SourceMode; calendar: SourceMode };
  nextSchoolDay?: NextSchoolDay;
}

export interface SourceDiagnostics {
  state: Exclude<SourceMode, 'browser-cache'>;
  label: string;
  parserMode: string;
  sourceUrl: string;
  fetchedAt?: string;
  lastAttemptAt?: string;
  cacheAgeSeconds?: number;
  hasData: boolean;
}

export interface StatusResponse {
  ok: true;
  service: string;
  version: string;
  timezone: string;
  uptimeSeconds: number;
  now: string;
  bell: SourceDiagnostics;
  calendar: SourceDiagnostics;
}

export interface RefreshResponse {
  ok: boolean;
  bell: { state: Exclude<SourceMode, 'browser-cache'>; sourceAvailable: boolean; stale: boolean; fallback: boolean };
  calendar: { state: Exclude<SourceMode, 'browser-cache'>; sourceAvailable: boolean; stale: boolean };
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}
