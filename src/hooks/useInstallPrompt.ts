import { useCallback, useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'lincoln-bell-live:install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent>();

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      let dismissedAt = 0;
      try { dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0); } catch { /* Storage is optional. */ }
      if (!isInstalled() && (!dismissedAt || Date.now() - dismissedAt > DISMISS_MS)) setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(undefined);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(undefined);
    if (choice.outcome === 'dismissed') {
      try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* Storage is optional. */ }
    }
    return choice.outcome === 'accepted';
  }, [promptEvent]);

  return { canInstall: Boolean(promptEvent), install };
}
