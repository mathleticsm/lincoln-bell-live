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
  dataMode: 'live' | 'cached-live' | 'seed-fallback';
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
  sourceState: { bell: string; calendar: string };
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}
