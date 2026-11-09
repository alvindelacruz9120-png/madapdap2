import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { AttendanceRecord, Student } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  CalendarCheck2, 
  Search, 
  Filter, 
  Download, 
  Edit3, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Clock, 
  FileSpreadsheet,
  Calendar,
  ShieldCheck,
  Trash2
} from 'lucide-react';

interface AttendanceManagementProps {
  onOpenCorrection: (record: AttendanceRecord) => void;
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({
  onOpenCorrection
}) => {
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [loading, setLoading] = useState(true);

  const handleDeleteRecord = async (record: AttendanceRecord) => {
    if (!record.id || record.id.startsWith('absent_')) return;
    try {
      await deleteDoc(doc(db, 'attendance', record.id));
      showToast('success', 'Attendance Record Deleted', `Removed daily record for ${record.studentName || record.studentId}.`);
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message || 'Unable to delete attendance record.');
    }
  };

  // Filters
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');

  useEffect(() => {
    // 1. Fetch all students for reference
    const loadStudents = async () => {
      try {
        const snap = await getDocs(collection(db, 'students'));
        const map: Record<string, Student> = {};
        snap.docs.forEach(d => {
          const s = d.data() as Student;
          map[s.studentId] = s;
        });
        setStudents(map);
      } catch (e) {
        console.warn('Error fetching students:', e);
      }
    };
    loadStudents();

    // 2. Listen to attendance records
    let q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
    if (selectedDate) {
      q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
      setRecords(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading attendance records:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate]);

  // Combine attendance with absent students if filtering on a specific date
  // Active students who have no entry on this date are displayed as ABSENT
  const allDateRecords: AttendanceRecord[] = [...records];
  if (selectedDate) {
    const recordedStudentIds = new Set(records.map(r => r.studentId));
    Object.values(students).forEach(std => {
      if (std.status === 'ACTIVE' && !recordedStudentIds.has(std.studentId)) {
        allDateRecords.push({
          id: `absent_${std.studentId}_${selectedDate}`,
          studentId: std.studentId,
          studentName: `${std.firstName} ${std.lastName}`,
          gradeLevel: std.gradeLevel,
          section: std.section,
          date: selectedDate,
          status: 'ABSENT',
          firstEntryAt: null,
          lastExitAt: null,
          entryCount: 0,
          exitCount: 0
        });
      }
    });
  }

  // Filter logic
  const filtered = allDateRecords.filter(r => {
    const name = (r.studentName || students[r.studentId]?.firstName || '').toLowerCase();
    const id = r.studentId.toLowerCase();
    const sec = (r.section || students[r.studentId]?.section || '').toLowerCase();

    const matchesSearch = name.includes(search.toLowerCase()) || id.includes(search.toLowerCase()) || sec.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesGrade = gradeFilter === 'ALL' || (r.gradeLevel || students[r.studentId]?.gradeLevel) === gradeFilter;

    return matchesSearch && matchesStatus && matchesGrade;
  });

  // Distinct grades for filter
  const uniqueGrades = Array.from(new Set(
    Object.values(students).map(s => s.gradeLevel).filter(Boolean)
  ));

  // Export to CSV / Excel
  const handleExport = (format: 'CSV' | 'EXCEL') => {
    if (filtered.length === 0) return;

    const headers = [
      'Student ID',
      'Student Name',
      'Grade Level',
      'Section',
      'Date',
      'Attendance Status',
      'First Entry Time',
      'Last Exit Time',
      'Total Entries',
      'Total Exits',
      'Correction Reason',
      'Corrected By'
    ];

    const rows = filtered.map(r => {
      const s = students[r.studentId];
      const name = r.studentName || (s ? `${s.firstName} ${s.lastName}` : r.studentId);
      const grade = r.gradeLevel || s?.gradeLevel || 'N/A';
      const section = r.section || s?.section || 'N/A';
      const firstEntry = r.firstEntryAt ? new Date(r.firstEntryAt).toLocaleTimeString() : 'N/A';
      const lastExit = r.lastExitAt ? new Date(r.lastExitAt).toLocaleTimeString() : 'N/A';

      return [
        `"${r.studentId}"`,
        `"${name}"`,
        `"${grade}"`,
        `"${section}"`,
        `"${r.date}"`,
        `"${r.status}"`,
        `"${firstEntry}"`,
        `"${lastExit}"`,
        r.entryCount || 0,
        r.exitCount || 0,
        `"${r.correctionReason || ''}"`,
        `"${r.correctedBy || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${selectedDate || 'all'}.${format === 'EXCEL' ? 'xls' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-blue-600" />
              <span>Official Attendance Records &amp; Gate Audits</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Daily rolled-up student attendance records with entry times, departure logs, and administrative adjustments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('CSV')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExport('EXCEL')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors shadow-xs shadow-emerald-500/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            {/* Date Picker */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="ABSENT">ABSENT</option>
            </select>

            {/* Grade Filter */}
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Grades</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading attendance records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No attendance records found for {selectedDate || 'the selected period'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Student ID</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Grade &amp; Section</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">First Entry</th>
                  <th className="p-3">Last Exit</th>
                  <th className="p-3 text-center">Entries</th>
                  <th className="p-3 text-center">Exits</th>
                  <th className="p-3">Correction Audit</th>
                  {isAdmin && <th className="p-3 pr-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => {
                  const s = students[record.studentId];
                  const name = record.studentName || (s ? `${s.firstName} ${s.lastName}` : record.studentId);
                  const grade = record.gradeLevel || s?.gradeLevel || 'N/A';
                  const section = record.section || s?.section || 'N/A';

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 pl-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {record.studentId}
                      </td>

                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {name}
                      </td>

                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {grade} &bull; {section}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            record.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : record.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {record.firstEntryAt ? (
                          <span className="flex items-center gap-1 font-semibold text-emerald-700">
                            <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                            {new Date(record.firstEntryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-300">--:--</span>
                        )}
                      </td>

                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {record.lastExitAt ? (
                          <span className="flex items-center gap-1 font-semibold text-blue-700">
                            <LogOut className="w-3.5 h-3.5 text-blue-600" />
                            {new Date(record.lastExitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-300">--:--</span>
                        )}
                      </td>

                      <td className="p-3 text-center font-bold text-slate-700">
                        {record.entryCount || 0}
                      </td>

                      <td className="p-3 text-center font-bold text-slate-700">
                        {record.exitCount || 0}
                      </td>

                      <td className="p-3 text-slate-500">
                        {record.correctionReason ? (
                          <div className="text-[10px] bg-amber-50 p-1.5 rounded border border-amber-200">
                            <span className="font-bold text-amber-800">Reason:</span> {record.correctionReason}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">Gate verified</span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="p-3 pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenCorrection(record)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Authorized Attendance Correction"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {record.id && !record.id.startsWith('absent_') && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteRecord(record)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Attendance Record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
