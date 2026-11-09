import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { 
  LogOut, 
  User as UserIcon, 
  Clock, 
  ShieldCheck, 
  QrCode, 
  Bell, 
  ChevronDown,
  School
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, activeTab, setActiveTab }) => {
  const { userProfile, role, signOutUser, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const t = new Intl.DateTimeFormat('en-US', {
          timeZone: settings.timezone || 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(now);

        const d = new Intl.DateTimeFormat('en-US', {
          timeZone: settings.timezone || 'Asia/Manila',
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }).format(now);

        setTimeStr(t);
        setDateStr(d);
      } catch (e) {
        setTimeStr(new Date().toLocaleTimeString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.timezone]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile hamburger & School Brand */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <img 
            src={settings.schoolLogo || '/school-logo.svg'} 
            alt="MaRHS Logo" 
            className="w-10 h-10 rounded-full border border-amber-400/60 object-contain shadow-xs bg-white p-0.5 shrink-0" 
          />
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5">
              <span>{settings.schoolName || 'Madapdap Resettlement High School'}</span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
              Mabalacat City, Pampanga &bull; MaRHS Attendance Gateway
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Live Clock in School Timezone */}
      <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-700">
        <Clock className="w-3.5 h-3.5 text-blue-600" />
        <span className="text-slate-500">{dateStr}</span>
        <span className="text-slate-300">|</span>
        <span className="font-semibold text-slate-900 font-mono">{timeStr}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded font-mono">
          {settings.timezone?.split('/')[1] || 'Manila'}
        </span>
      </div>

      {/* Right: Quick Scanner Link & User Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Quick Launch Scanner Button */}
        <button
          onClick={() => setActiveTab('guard-scanner')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs ${
            activeTab === 'guard-scanner'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
          title="Open Gate Scanner"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Gate Scanner</span>
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              {userProfile?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {userProfile?.fullName || 'User'}
              </div>
              <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {role || 'GUARD'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
          </button>

          {menuOpen && (
            <div 
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{userProfile?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{userProfile?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  Role: {role}
                </span>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setActiveTab('admin-settings');
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <School className="w-4 h-4 text-slate-400" />
                  School Settings
                </button>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOutUser();
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
