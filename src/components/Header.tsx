import { Bell, CalendarDays, Download, Home, Info, Moon, RefreshCw, Sun, Monitor } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { Theme } from '../hooks/useTheme';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onRefresh: () => void;
  refreshing: boolean;
  canInstall: boolean;
  onInstall: () => void;
}

export function Header({ theme, setTheme, onRefresh, refreshing, canInstall, onInstall }: HeaderProps) {
  const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  return <header className="site-header">
    <div className="brand-wrap"><NavLink to="/" className="brand">Lincoln Bell Live</NavLink><span>Lincoln High School · Los Angeles</span></div>
    <nav aria-label="Primary"><NavLink to="/" end>Today</NavLink><NavLink to="/bells">Bell Schedules</NavLink><NavLink to="/calendar">Calendar</NavLink><NavLink to="/about">About</NavLink></nav>
    <div className="header-actions">
      {canInstall && <button className="install-btn" onClick={onInstall}><Download size={16}/>Install App</button>}
      <button className="icon-btn" onClick={onRefresh} disabled={refreshing} aria-label="Refresh official data"><RefreshCw size={18} className={refreshing ? 'spin' : ''}/></button>
      <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`}><ThemeIcon size={18}/></button>
    </div>
  </header>;
}

const mobileLinks = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/bells', label: 'Bells', icon: Bell },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/about', label: 'About', icon: Info }
];

export function BottomNav() {
  return <nav className="bottom-nav" aria-label="Mobile primary navigation">{mobileLinks.map(item => {
    const Icon = item.icon;
    return <NavLink key={item.to} to={item.to} end={item.end}><Icon size={20}/><span>{item.label}</span></NavLink>;
  })}</nav>;
}
