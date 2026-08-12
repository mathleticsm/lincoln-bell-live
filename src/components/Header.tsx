import { Moon,RefreshCw,Sun,Monitor } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { Theme } from '../hooks/useTheme';
export function Header({theme,setTheme,onRefresh,refreshing}:{theme:Theme;setTheme:(t:Theme)=>void;onRefresh:()=>void;refreshing:boolean}){
  const next:Theme=theme==='system'?'light':theme==='light'?'dark':'system';
  const ThemeIcon=theme==='system'?Monitor:theme==='light'?Sun:Moon;
  return <header className="site-header"><div className="brand-wrap"><NavLink to="/" className="brand">Lincoln Bell Live</NavLink><span>Lincoln High School • Los Angeles</span></div><nav aria-label="Primary"><NavLink to="/" end>Today</NavLink><NavLink to="/bells">Bell Schedules</NavLink><NavLink to="/calendar">Calendar</NavLink><NavLink to="/about">About</NavLink></nav><div className="header-actions"><button className="icon-btn" onClick={onRefresh} disabled={refreshing} aria-label="Refresh live data"><RefreshCw size={18} className={refreshing?'spin':''}/></button><button className="icon-btn" onClick={()=>setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`}><ThemeIcon size={18}/></button></div></header>
}
