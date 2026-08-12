import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { TodayPage } from './pages/TodayPage';
import { BellSchedulesPage } from './pages/BellSchedulesPage';
import { AboutPage } from './pages/AboutPage';
import { api } from './lib/api';
import { useTheme } from './hooks/useTheme';

const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));

export default function App() {
  const { theme, setTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(0);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3500);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.refresh();
      setToken(value => value + 1);
      if (result.bell.sourceAvailable && result.calendar.sourceAvailable) {
        showToast('Live sources refreshed.');
      } else if (!result.bell.sourceAvailable && !result.calendar.sourceAvailable) {
        showToast('Lincoln’s live sources are unavailable. Cached or fallback data was kept.');
      } else {
        showToast(`Refresh complete. ${result.bell.sourceAvailable ? 'Calendar' : 'Bell schedule'} source is unavailable; cached data may be shown.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  return <>
    <Header theme={theme} setTheme={setTheme} onRefresh={refresh} refreshing={refreshing} />
    <Routes>
      <Route path="/" element={<TodayPage refreshToken={token} />} />
      <Route path="/bells" element={<BellSchedulesPage refreshToken={token} />} />
      <Route path="/calendar" element={<Suspense fallback={<main><div className="skeleton card">Loading calendar…</div></main>}><CalendarPage refreshToken={token} /></Suspense>} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <footer>
      <p>Schedule and event information is sourced from the official Lincoln High School website.</p>
      <p>This is an independent schedule utility and is not an official Lincoln High School or LAUSD website.</p>
      <div><a href="https://www.lincolnhs.org/apps/bell_schedules/" target="_blank" rel="noreferrer">Official bell schedule</a><a href="https://www.lincolnhs.org/apps/events/" target="_blank" rel="noreferrer">Official calendar</a></div>
    </footer>
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}
