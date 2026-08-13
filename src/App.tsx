import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { BottomNav, Header } from './components/Header';
import { api } from './lib/api';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useTheme } from './hooks/useTheme';
import { AboutPage } from './pages/AboutPage';
import { BellSchedulesPage } from './pages/BellSchedulesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TodayPage } from './pages/TodayPage';

const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));

export default function App() {
  const { theme, setTheme } = useTheme();
  const { canInstall, install } = useInstallPrompt();
  const online = useOnlineStatus();
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
    toastTimer.current = window.setTimeout(() => setToast(''), 4000);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const result = await api.refresh();
      setToken(value => value + 1);
      if (result.bell.state === 'live' && result.calendar.state === 'live') {
        showToast('Live sources refreshed.');
      } else if (result.bell.state !== 'live' && result.calendar.state !== 'live') {
        showToast('Lincoln’s live sources are unavailable. Cached or fallback data was kept.');
      } else if (result.bell.state === 'live') {
        showToast(`Bell schedules refreshed; calendar data is ${result.calendar.state}.`);
      } else {
        showToast(`Calendar refreshed; bell schedule data is ${result.bell.state}.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  return <>
    <Header theme={theme} setTheme={setTheme} onRefresh={refresh} refreshing={refreshing} canInstall={canInstall} onInstall={() => { void install(); }} />
    {!online && <div className="offline-banner" role="status">You’re offline. Showing the most recently loaded data where available.</div>}
    <Routes>
      <Route path="/" element={<TodayPage refreshToken={token} />} />
      <Route path="/bells" element={<BellSchedulesPage refreshToken={token} />} />
      <Route path="/calendar" element={<Suspense fallback={<main><div className="skeleton card">Loading calendar…</div></main>}><CalendarPage refreshToken={token} /></Suspense>} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <footer>
      <p>Schedule and event information is sourced from the official Lincoln High School website.</p>
      <p>This is an independent schedule utility and is not an official Lincoln High School or LAUSD website.</p>
      <div><a href="https://www.lincolnhs.org/apps/bell_schedules/" target="_blank" rel="noreferrer">Official bell schedule</a><a href="https://www.lincolnhs.org/apps/events/" target="_blank" rel="noreferrer">Official calendar</a></div>
    </footer>
    <BottomNav />
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
  </>;
}
