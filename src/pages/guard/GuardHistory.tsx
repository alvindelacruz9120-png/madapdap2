import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { AttendanceEvent, EventType } from '../../types';
import { 
  History, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  Shield 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const GuardHistory: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | EventType>('ALL');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'attendance_events'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), eventId: d.id } as AttendanceEvent));
      setEvents(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading attendance events:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteEvent = async (ev: AttendanceEvent) => {
    if (!ev.eventId) return;
    try {
      await deleteDoc(doc(db, 'attendance_events', ev.eventId));
      showToast('success', 'Record Deleted', `Removed scan log for ${ev.studentName || ev.studentId}.`);
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message || 'Could not delete record.');
    }
  };

  const handleClearAll = async () => {
    if (events.length === 0) return;
    try {
      const batch = writeBatch(db);
      events.forEach((ev) => {
        if (ev.eventId) {
          batch.delete(doc(db, 'attendance_events', ev.eventId));
        }
      });
      await batch.commit();
      setConfirmClearAll(false);
      showToast('success', 'Scan Log Cleared', `Deleted ${events.length} gate scan records.`);
    } catch (err: any) {
      showToast('error', 'Clear Failed', err.message || 'Unable to clear scan history.');
    }
  };

  const filtered = events.filter((ev) => {
    const matchesSearch =
      (ev.studentName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      ev.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || ev.eventType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <span>Gate Scan Event Log</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Real-time audit log of all student entries and exits recorded at the gate.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl font-mono">
              Total Scans: {events.length}
            </div>

            {isAdmin && events.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => void handleClearAll()}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filterType === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Scans
            </button>
            <button
              onClick={() => setFilterType('ENTRY')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                filterType === 'ENTRY' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Entries</span>
            </button>
            <button
              onClick={() => setFilterType('EXIT')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                filterType === 'EXIT' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:text-blue-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Departures</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading scan events...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No gate scan records match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Gate Direction</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duty Officer</th>
                  <th className="p-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const isEntry = item.eventType === 'ENTRY';
                  const initials = (item.studentName || item.studentId || 'S')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p.charAt(0).toUpperCase())
                    .join('');

                  return (
                    <tr key={item.eventId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} &bull; {item.date}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${
                            isEntry ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            {initials}
                          </span>
                          <span className="font-bold text-slate-900">
                            {item.studentName || item.studentId}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-600">
                        {item.studentId}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                            isEntry
                              ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100/80 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isEntry ? <ArrowDownLeft className="w-3 h-3 stroke-[2.5]" /> : <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
                          <span>{isEntry ? 'ENTRY' : 'DEPARTURE'}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        {isEntry ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{item.status === 'LATE' ? 'TARDY / LATE' : 'PRESENT'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-bold">DEPARTED</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Shield className="w-3 h-3 text-slate-400" />
                          <span>{item.guardName || item.guardId}</span>
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDeleteEvent(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Scan History Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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
