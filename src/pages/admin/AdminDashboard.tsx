import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Student, AttendanceRecord, AttendanceEvent, EmailLog } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { 
  Users, 
  UserCheck, 
  Clock, 
  UserX, 
  Building2, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  QrCode, 
  Download, 
  Plus, 
  CheckCircle2, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Mail,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Printer,
  Edit,
  Search,
  School,
  Trash2,
  Shield
} from 'lucide-react';

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenRegisterStudent: () => void;
  onSelectStudentForCard?: (student: Student) => void;
  onSelectStudentForEdit?: (student: Student) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  setActiveTab,
  onOpenRegisterStudent,
  onSelectStudentForCard,
  onSelectStudentForEdit
}) => {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'ENTRY' | 'EXIT'>('ALL');
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [confirmClearFeed, setConfirmClearFeed] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const handleDeleteGateEvent = async (ev: AttendanceEvent) => {
    const targetDocId = ev.eventId;
    if (!targetDocId) return;
    setDeletingEventId(targetDocId);
    try {
      await deleteDoc(doc(db, 'attendance_events', targetDocId));
      showToast('success', 'Scan Record Deleted', `Removed gate event for ${ev.studentName || ev.studentId}.`);
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message || 'Could not delete scan record.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleClearGateFeed = async () => {
    if (recentEvents.length === 0) return;
    try {
      const batch = writeBatch(db);
      recentEvents.forEach((ev) => {
        if (ev.eventId) {
          batch.delete(doc(db, 'attendance_events', ev.eventId));
        }
      });
      await batch.commit();
      setConfirmClearFeed(false);
      showToast('success', 'Gate Feed Cleared', `Removed ${recentEvents.length} gate scan records.`);
    } catch (err: any) {
      showToast('error', 'Clear Failed', err.message || 'Unable to clear gate history.');
    }
  };

  // Formatted today string in school timezone (Asia/Manila default)
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.timezone || 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, [settings.timezone]);

  // Formatted human-readable date
  const humanDateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone || 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date());
  }, [settings.timezone]);

  // Real-time Firestore subscriptions
  useEffect(() => {
    // 1. Listen to students collection
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
    }, (err) => {
      console.warn('Students subscription error:', err);
    });

    // 2. Listen to today's attendance records
    const attendanceQ = query(
      collection(db, 'attendance'),
      where('date', '==', todayStr)
    );
    const unsubAttendance = onSnapshot(attendanceQ, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
      setTodayAttendance(list);
    }, (err) => {
      console.warn('Attendance subscription error:', err);
    });

    // 3. Listen to recent scan events (gate live stream)
    const eventsQ = query(
      collection(db, 'attendance_events'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );
    const unsubEvents = onSnapshot(eventsQ, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), eventId: d.id } as AttendanceEvent));
      setRecentEvents(list);
      setLoading(false);
    }, (err) => {
      console.warn('Scan events subscription error:', err);
      setLoading(false);
    });

    // 4. Listen to email logs
    const emailsQ = query(
      collection(db, 'email_logs'),
      orderBy('sentAt', 'desc'),
      limit(50)
    );
    const unsubEmails = onSnapshot(emailsQ, (snap) => {
      const list = snap.docs.map(d => d.data() as EmailLog);
      setEmailLogs(list);
    }, (err) => {
      console.warn('Email logs subscription error:', err);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubEvents();
      unsubEmails();
    };
  }, [todayStr]);

  // Attendance metrics calculations
  const totalStudents = students.length;
  const activeStudents = useMemo(() => students.filter(s => s.status === 'ACTIVE').length, [students]);

  const presentCount = useMemo(() => todayAttendance.filter(a => a.status === 'PRESENT').length, [todayAttendance]);
  const lateCount = useMemo(() => todayAttendance.filter(a => a.status === 'LATE').length, [todayAttendance]);
  const totalAttendedToday = presentCount + lateCount;
  const absentCount = Math.max(0, activeStudents - totalAttendedToday);

  // Today's total gate scans
  const todayEvents = useMemo(() => recentEvents.filter(e => e.date === todayStr), [recentEvents, todayStr]);
  const entryScansCount = useMemo(() => todayEvents.filter(e => e.eventType === 'ENTRY').length, [todayEvents]);
  const exitScansCount = useMemo(() => todayEvents.filter(e => e.eventType === 'EXIT').length, [todayEvents]);

  // Currently on Campus Grounds calculation
  const insideSchoolCount = useMemo(() => {
    return todayAttendance.filter(a => (a.entryCount || 0) > (a.exitCount || 0)).length;
  }, [todayAttendance]);

  // Turnout compliance rate
  const attendanceRate = activeStudents > 0 
    ? Math.round((totalAttendedToday / activeStudents) * 100) 
    : 0;

  // Email notifications stats
  const failedEmailCount = useMemo(() => emailLogs.filter(e => e.deliveryStatus === 'FAILED').length, [emailLogs]);
  const totalDispatchedEmails = emailLogs.length;

  // Grade level distribution breakdown
  const gradeStats = useMemo(() => {
    const map: Record<string, { total: number; present: number; late: number }> = {};
    
    students.forEach((s) => {
      if (s.status === 'ACTIVE') {
        const g = s.gradeLevel || 'Unassigned';
        if (!map[g]) map[g] = { total: 0, present: 0, late: 0 };
        map[g].total += 1;
      }
    });

    todayAttendance.forEach((a) => {
      const g = a.gradeLevel || 'Unassigned';
      if (map[g]) {
        if (a.status === 'PRESENT') map[g].present += 1;
        if (a.status === 'LATE') map[g].late += 1;
      }
    });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [students, todayAttendance]);

  // Operational Period Status
  const sessionStatus = useMemo(() => {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const openMin = parseTime(settings.openingTime || '07:00');
      const lateMin = parseTime(settings.lateCutoff || '07:30');
      const closeMin = parseTime(settings.closingTime || '17:00');

      if (currentMinutes < openMin) {
        return { label: 'Early Arrival · Gate Closed', color: 'text-slate-500 bg-slate-100 border-slate-200' };
      }
      if (currentMinutes >= openMin && currentMinutes < lateMin) {
        return { label: 'Morning Entry Rush (On-Time Window)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      }
      if (currentMinutes >= lateMin && currentMinutes < closeMin) {
        return { label: 'Regular Academic Sessions (Late Window Active)', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      }
      return { label: 'Campus Dismissal / After Hours', color: 'text-slate-700 bg-slate-100 border-slate-200' };
    } catch {
      return { label: 'Active School Day', color: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  }, [settings.openingTime, settings.lateCutoff, settings.closingTime]);

  // Filtered live events
  const filteredEvents = useMemo(() => {
    if (activityFilter === 'ALL') return recentEvents;
    return recentEvents.filter(e => e.eventType === activityFilter);
  }, [recentEvents, activityFilter]);

  // Filtered recently enrolled students
  const filteredRecentStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return students.slice(0, 6);
    const term = searchStudentTerm.toLowerCase();
    return students.filter(s => 
      s.firstName.toLowerCase().includes(term) ||
      s.lastName.toLowerCase().includes(term) ||
      s.studentId.toLowerCase().includes(term) ||
      s.section.toLowerCase().includes(term)
    ).slice(0, 6);
  }, [students, searchStudentTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 1. INSTITUTIONAL EXECUTIVE HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left Brand & School Identification */}
          <div className="flex items-start sm:items-center gap-4">
            <img 
              src={settings.schoolLogo || '/school-logo.svg'} 
              alt="School Seal" 
              className="w-14 h-14 rounded-full border border-amber-400/80 p-0.5 object-contain bg-white shadow-xs shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  {settings.schoolName || 'Madapdap Resettlement High School'}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sessionStatus.color}`}>
                  {sessionStatus.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>Division of Mabalacat City · Region III - Central Luzon</span>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="text-slate-700 font-medium">{humanDateStr}</span>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="font-mono text-slate-600">PHT (GMT+8)</span>
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenRegisterStudent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll Student</span>
            </button>

            <button
              onClick={() => setActiveTab('guard-scanner')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors active:scale-98 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Gate Scanner</span>
            </button>

            <button
              onClick={() => setActiveTab('admin-reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>DepEd SF2 Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE ATTENDANCE TELEMETRY RIBBON (High-Density Key Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Total Active Enrollment */}
        <div 
          onClick={() => setActiveTab('admin-students')}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {activeStudents}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {totalStudents} total registry records
          </div>
        </div>

        {/* Metric 2: Present Today (On-Time) */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Present (On-Time)</span>
            <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono tabular-nums">
            {presentCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Scanned before {settings.lateCutoff}
          </div>
        </div>

        {/* Metric 3: Late Arrivals (Tardy) */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tardy / Late</span>
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2 font-mono tabular-nums">
            {lateCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Flagged for late entry
          </div>
        </div>

        {/* Metric 4: Absent / Unaccounted */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-rose-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Unaccounted / Absent</span>
            <UserX className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono tabular-nums">
            {absentCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            No gate entry today
          </div>
        </div>

        {/* Metric 5: Currently on Campus Grounds */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Inside Campus</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2 font-mono tabular-nums">
            {insideSchoolCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Active physical headcount
          </div>
        </div>

        {/* Metric 6: Compliance / Attendance Rate */}
        <div 
          onClick={() => setActiveTab('admin-reports')}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Turnout Rate</span>
            <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {attendanceRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {totalAttendedToday} of {activeStudents} active
          </div>
        </div>
      </div>

      {/* 3. CORE OPERATIONS ROW (Left: Real-Time Gate Stream | Right: Compliance & Curfew Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Real-Time Gate Security Telemetry */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Telemetry Stream Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Live Gate Terminal Feed
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {recentEvents.length} logged
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audited campus gate access stream authenticated via QR badges
                </p>
              </div>

              {/* Right Filter + Clear Feed Action */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Segmented Filter Control */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setActivityFilter('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activityFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('ENTRY')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activityFilter === 'ENTRY'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Entries
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('EXIT')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      activityFilter === 'EXIT'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Departures
                  </button>
                </div>

                {/* Clear Feed Button */}
                {recentEvents.length > 0 && (
                  confirmClearFeed ? (
                    <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => void handleClearGateFeed()}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Confirm Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearFeed(false)}
                        className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearFeed(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/80 rounded-xl transition-colors cursor-pointer"
                      title="Clear Gate Scan Feed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Event List Items */}
            <div className="mt-3 space-y-2 max-h-[390px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">No gate activity recorded yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                    Gate security scans will appear here in real time as students present their QR badges at the entrance.
                  </p>
                  <button
                    onClick={() => setActiveTab('guard-scanner')}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Open Gate Scanner Terminal <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const isEntry = ev.eventType === 'ENTRY';
                  const isLate = ev.status === 'LATE';
                  const initials = (ev.studentName || ev.studentId || 'S')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join('');

                  return (
                    <div 
                      key={ev.eventId}
                      className="p-3 bg-slate-50/60 hover:bg-white border border-slate-200/70 hover:border-slate-300 rounded-2xl transition-all flex items-center justify-between gap-3 text-xs group shadow-2xs"
                    >
                      {/* Left: Clean Modern Student Badge & Status Icon */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-2xs border ${
                            isEntry
                              ? isLate
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            {initials}
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-2xs ${
                              isEntry
                                ? isLate
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                            title={isEntry ? 'Gate Entry' : 'Gate Departure'}
                          >
                            {isEntry ? (
                              <ArrowDownLeft className="w-3 h-3 stroke-[2.5]" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                            )}
                          </span>
                        </div>

                        <div className="truncate">
                          <div className="font-bold text-slate-900 leading-tight truncate text-xs sm:text-sm">
                            {ev.studentName || ev.studentId}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded">
                              ID: {ev.studentId}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">&bull;</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 truncate">
                              <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{ev.guardName || 'Gate Security'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp, Status Badge & Delete Button */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className="mt-1">
                            {isEntry ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                isLate 
                                  ? 'bg-amber-100/80 text-amber-800 border border-amber-300/80' 
                                  : 'bg-emerald-100/80 text-emerald-800 border border-emerald-300/80'
                              }`}>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>{isLate ? 'TARDY / LATE' : 'PRESENT'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-800 border border-blue-300/80">
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                <span>DEPARTED</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Individual Delete History Record Button */}
                        <button
                          type="button"
                          onClick={() => void handleDeleteGateEvent(ev)}
                          disabled={deletingEventId === ev.eventId}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer disabled:opacity-40"
                          title="Delete Scan History Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Action link */}
          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Showing recent live scans · Auto-refreshed via Firebase
            </span>
            <button
              onClick={() => setActiveTab('guard-history')}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <span>Full Gate Security Log</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Curfew, Notification Gateway & Turnout Distribution */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card A: Turnout Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Today's Roster Breakdown
              </h3>
              <span className="text-xs font-mono font-bold text-blue-600">
                {attendanceRate}% Present
              </span>
            </div>

            {/* Multi-segment Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex mb-3">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${activeStudents > 0 ? (presentCount / activeStudents) * 100 : 0}%` }}
                title={`Present: ${presentCount}`}
              />
              <div 
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${activeStudents > 0 ? (lateCount / activeStudents) * 100 : 0}%` }}
                title={`Late: ${lateCount}`}
              />
              <div 
                className="bg-slate-300 h-full transition-all duration-500"
                style={{ width: `${activeStudents > 0 ? (absentCount / activeStudents) * 100 : 0}%` }}
                title={`Absent: ${absentCount}`}
              />
            </div>

            {/* Breakdown Legend with Exact Numbers */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  <span>On-Time Entry</span>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {presentCount} ({activeStudents > 0 ? Math.round((presentCount / activeStudents) * 100) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Late Arrival (Tardy)</span>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {lateCount} ({activeStudents > 0 ? Math.round((lateCount / activeStudents) * 100) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" />
                  <span>Unaccounted (Absent)</span>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {absentCount} ({activeStudents > 0 ? Math.round((absentCount / activeStudents) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Card B: School Schedule & Curfew Rules */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Gate Timetable &amp; Curfew</span>
              </h3>
              <button
                onClick={() => setActiveTab('admin-settings')}
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Configure
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gate Opens</span>
                <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                  {settings.openingTime || '07:00'}
                </span>
              </div>
              <div className="border-x border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Tardy Cutoff</span>
                <span className="font-mono text-xs font-bold text-amber-700 block mt-0.5">
                  {settings.lateCutoff || '07:30'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Dismissal</span>
                <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                  {settings.closingTime || '17:00'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              Students arriving after <strong className="text-slate-800">{settings.lateCutoff}</strong> are recorded as Tardy on official DepEd Form 2 reports and guardian alerts.
            </p>
          </div>

          {/* Card C: Guardian Email Alert Gateway Status */}
          <div 
            onClick={() => setActiveTab('admin-email-logs')}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">
                  Guardian Alert Gateway
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                failedEmailCount === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {failedEmailCount === 0 ? 'HEALTHY' : `${failedEmailCount} FAILED`}
              </span>
            </div>

            <div className="text-xs text-slate-600 mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span>Recent email dispatches:</span>
                <span className="font-mono font-bold text-slate-900">{totalDispatchedEmails}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery status:</span>
                <span className="font-semibold text-emerald-600">
                  {failedEmailCount === 0 ? '100% Successful' : `${totalDispatchedEmails - failedEmailCount} Delivered`}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-blue-600 group-hover:text-blue-800 flex items-center gap-1">
              <span>Inspect email delivery logs</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. GRADE LEVEL PERFORMANCE COMPARISON (DepEd SF2 Administrative Standard) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Grade Level Attendance Performance</span>
            </h3>
            <p className="text-xs text-slate-500">
              Comparative cohort breakdown across Junior and Senior High School levels
            </p>
          </div>
          <button
            onClick={() => setActiveTab('admin-reports')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View Full Analytics</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {gradeStats.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No active grade levels registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Grade Level</th>
                  <th className="py-2.5 px-3 text-right">Active Roster</th>
                  <th className="py-2.5 px-3 text-right">Present (On-Time)</th>
                  <th className="py-2.5 px-3 text-right">Tardy (Late)</th>
                  <th className="py-2.5 px-3">Turnout Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeStats.map(([grade, stats]) => {
                  const attended = stats.present + stats.late;
                  const rate = stats.total > 0 ? Math.round((attended / stats.total) * 100) : 0;

                  return (
                    <tr key={grade} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {grade}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {stats.total}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {stats.present}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                        {stats.late}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                rate >= 80 ? 'bg-emerald-600' : rate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-800 text-[11px] tabular-nums">
                            {rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. RECENTLY ENROLLED LEARNERS DIRECTORY & QUICK ACTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Student Directory Snapshot
            </h3>
            <p className="text-xs text-slate-500">
              Quick access to student credentials, printable QR badges, and profiles
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, ID or section..."
                value={searchStudentTerm}
                onChange={(e) => setSearchStudentTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-56 sm:w-64"
              />
            </div>

            <button
              onClick={() => setActiveTab('admin-students')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 inline-flex items-center gap-1"
            >
              <span>Manage All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No student records registered yet. Click "Enroll Student" to create the first record.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRecentStudents.map((std) => (
              <div 
                key={std.studentId}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {std.firstName} {std.middleName ? `${std.middleName.charAt(0)}. ` : ''}{std.lastName}
                      </h4>
                      <div className="text-[11px] font-mono font-semibold text-blue-600 mt-0.5">
                        LRN / ID: {std.studentId}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      std.status === 'ACTIVE' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {std.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                    <div>
                      <span className="text-slate-400">Level:</span> <strong>{std.gradeLevel}</strong> · Sec: <strong>{std.section}</strong>
                    </div>
                    {std.guardianName && (
                      <div className="truncate">
                        <span className="text-slate-400">Parent:</span> {std.guardianName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  {onSelectStudentForCard && (
                    <button
                      type="button"
                      onClick={() => onSelectStudentForCard(std)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                      title="View & Print ID Card"
                    >
                      <Printer className="w-3 h-3 text-slate-400" />
                      <span>ID Badge</span>
                    </button>
                  )}

                  {onSelectStudentForEdit && (
                    <button
                      type="button"
                      onClick={() => onSelectStudentForEdit(std)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                      title="Edit Profile"
                    >
                      <Edit className="w-3 h-3 text-slate-400" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
