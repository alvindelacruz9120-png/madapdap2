import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  QrCode,
  CalendarCheck2,
  BarChart3,
  Shield,
  Mail,
  Settings,
  ScanLine,
  History,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose
}) => {
  const { role, isAdmin, signOutUser } = useAuth();

  const handleSelect = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-students', label: 'Students', icon: Users },
    { id: 'admin-guardians', label: 'Parents / Guardians', icon: UserCheck },
    { id: 'admin-qr-codes', label: 'QR Cards & ID Print', icon: QrCode },
    { id: 'admin-attendance', label: 'Daily Attendance', icon: CalendarCheck2 },
    { id: 'admin-reports', label: 'Reports & Export', icon: BarChart3 },
    { id: 'admin-email-logs', label: 'Email Notifications', icon: Mail },
    { id: 'admin-users', label: 'Guard Accounts', icon: Shield },
    { id: 'admin-settings', label: 'School Settings', icon: Settings }
  ];

  const guardNavItems = [
    { id: 'guard-scanner', label: 'QR Gate Scanner', icon: ScanLine, highlight: true },
    { id: 'guard-history', label: 'My Scan History', icon: History }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800 gap-3">
          <img 
            src="/school-logo.svg" 
            alt="MaRHS Logo" 
            className="w-9 h-9 rounded-full border border-amber-400/80 bg-white p-0.5 object-contain shrink-0" 
          />
          <div className="truncate">
            <span className="font-extrabold text-white text-xs block leading-tight truncate">Madapdap Resettlement HS</span>
            <span className="text-[10px] text-amber-300 font-mono tracking-wider font-semibold">MaRHS CAMPUS PORTAL</span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Scanner Mode Section (Always accessible to guards & admins) */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gate Operations
            </div>
            <div className="space-y-1">
              {guardNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : item.highlight
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.highlight && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Management Section */}
          {isAdmin && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Administration
              </div>
              <div className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Logout */}
        <div className="p-3 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 mb-2">
            <div className="text-[11px] font-semibold text-slate-200 truncate">
              {isAdmin ? 'System Administrator' : 'Gate Security Officer'}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online &amp; Connected
            </div>
          </div>

          <button
            onClick={signOutUser}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
