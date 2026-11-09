import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { AttendanceRecord, Student, AttendanceEvent } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { 
  BarChart3, 
  Printer, 
  Download, 
  Calendar, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users 
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { settings } = useSettings();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => d.data() as Student));
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendance(snap.docs.map(d => d.data() as AttendanceRecord));
    });

    const unsubEvents = onSnapshot(collection(db, 'attendance_events'), (snap) => {
      setEvents(snap.docs.map(d => d.data() as AttendanceEvent));
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubEvents();
    };
  }, []);

  // Compute Grade breakdown
  const gradeBreakdown: Record<string, { total: number; present: number; late: number; rate: number }> = {};
  students.forEach(s => {
    const g = s.gradeLevel || 'General';
    if (!gradeBreakdown[g]) {
      gradeBreakdown[g] = { total: 0, present: 0, late: 0, rate: 0 };
    }
    if (s.status === 'ACTIVE') {
      gradeBreakdown[g].total += 1;
    }
  });

  attendance.forEach(a => {
    const g = a.gradeLevel || 'General';
    if (gradeBreakdown[g]) {
      if (a.status === 'PRESENT') gradeBreakdown[g].present += 1;
      if (a.status === 'LATE') gradeBreakdown[g].late += 1;
    }
  });

  Object.keys(gradeBreakdown).forEach(k => {
    const item = gradeBreakdown[k];
    item.rate = item.total > 0 ? Math.round(((item.present + item.late) / item.total) * 100) : 0;
  });

  // Hourly rush hour distribution (6 AM to 6 PM)
  const hourlyCounts: Record<number, { entry: number; exit: number }> = {};
  for (let h = 6; h <= 18; h++) {
    hourlyCounts[h] = { entry: 0, exit: 0 };
  }

  events.forEach(ev => {
    try {
      const hour = new Date(ev.timestamp).getHours();
      if (hourlyCounts[hour]) {
        if (ev.eventType === 'ENTRY') hourlyCounts[hour].entry += 1;
        if (ev.eventType === 'EXIT') hourlyCounts[hour].exit += 1;
      }
    } catch {}
  });

  const totalEntries = events.filter(e => e.eventType === 'ENTRY').length;
  const totalExits = events.filter(e => e.eventType === 'EXIT').length;
  const totalLateRecorded = attendance.filter(a => a.status === 'LATE').length;
  const totalPresentRecorded = attendance.filter(a => a.status === 'PRESENT').length;

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Attendance Analytics &amp; Compliance Reports</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Campus-wide statistical breakdown, punctuality metrics, and peak traffic distribution.
          </p>
        </div>

        <button
          onClick={handlePrintReport}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>Print Official Report</span>
        </button>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Cumulative Entries</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalEntries}</div>
          <span className="text-[11px] text-slate-400">Total gate check-ins</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Cumulative Exits</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{totalExits}</div>
          <span className="text-[11px] text-slate-400">Total gate departures</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Punctuality Rate</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalPresentRecorded + totalLateRecorded > 0 
              ? `${Math.round((totalPresentRecorded / (totalPresentRecorded + totalLateRecorded)) * 100)}%`
              : '100%'}
          </div>
          <span className="text-[11px] text-slate-400">On-time arrival ratio</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Tardy Incidents</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{totalLateRecorded}</div>
          <span className="text-[11px] text-slate-400">Arrived after {settings.lateCutoff}</span>
        </div>
      </div>

      {/* Hourly Gate Rush Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Hourly Gate Traffic Distribution (Rush Hour Analysis)</span>
        </h3>

        <div className="grid grid-cols-13 gap-1.5 h-36 items-end pt-4 border-b border-slate-200">
          {Object.entries(hourlyCounts).map(([hour, val]) => {
            const hNum = parseInt(hour, 10);
            const label = hNum === 12 ? '12p' : hNum > 12 ? `${hNum - 12}p` : `${hNum}a`;
            const maxVal = Math.max(1, ...Object.values(hourlyCounts).map(v => v.entry + v.exit));
            const entryHeight = Math.min(100, Math.round((val.entry / maxVal) * 100));
            const exitHeight = Math.min(100, Math.round((val.exit / maxVal) * 100));

            return (
              <div key={hour} className="flex flex-col items-center h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-0.5 h-24">
                  {/* Entry Bar */}
                  <div
                    className="w-2.5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-600"
                    style={{ height: `${Math.max(val.entry > 0 ? 8 : 0, entryHeight)}%` }}
                    title={`Entries: ${val.entry}`}
                  />
                  {/* Exit Bar */}
                  <div
                    className="w-2.5 bg-blue-500 rounded-t transition-all group-hover:bg-blue-600"
                    style={{ height: `${Math.max(val.exit > 0 ? 8 : 0, exitHeight)}%` }}
                    title={`Exits: ${val.exit}`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-2 font-bold">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span>Campus Entry Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span>Campus Exit Flow</span>
          </div>
        </div>
      </div>

      {/* Grade Level Attendance Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Grade Level Performance Breakdown</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase">
              <tr>
                <th className="p-3 pl-4">Grade Level</th>
                <th className="p-3">Active Students</th>
                <th className="p-3">On-Time (Present)</th>
                <th className="p-3">Late (Tardy)</th>
                <th className="p-3">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(gradeBreakdown).map(([grade, stats]) => (
                <tr key={grade} className="hover:bg-slate-50">
                  <td className="p-3 pl-4 font-bold text-slate-900">{grade}</td>
                  <td className="p-3 font-semibold text-slate-700">{stats.total}</td>
                  <td className="p-3 font-semibold text-emerald-700">{stats.present}</td>
                  <td className="p-3 font-semibold text-amber-700">{stats.late}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full" 
                          style={{ width: `${Math.min(100, stats.rate)}%` }} 
                        />
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">{stats.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
