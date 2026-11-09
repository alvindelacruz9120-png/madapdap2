import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Guardian, Student } from '../../types';
import { executeScan } from '../../services/scanService';
import {
  UserCheck,
  Search,
  Mail,
  Bell,
  BellOff,
  CheckCircle2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const GuardianManagement: React.FC = () => {
  const { showToast } = useToast();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [testSending, setTestSending] = useState<string | null>(null);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubGuardians = onSnapshot(collection(db, 'guardians'), (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), guardianId: d.id } as Guardian));
      setGuardians(list);
      setLoading(false);
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const map: Record<string, Student> = {};
      snap.docs.forEach((d) => {
        const s = d.data() as Student;
        map[s.studentId] = s;
      });
      setStudents(map);
    });

    return () => {
      unsubGuardians();
      unsubStudents();
    };
  }, []);

  const toggleNotifications = async (guardian: Guardian) => {
    try {
      const current = guardian.notificationsEnabled !== false;
      await setDoc(
        doc(db, 'guardians', guardian.guardianId),
        { notificationsEnabled: !current },
        { merge: true }
      );
      showToast('success', 'Notification Preference Updated', `Email alerts ${!current ? 'enabled' : 'disabled'} for ${guardian.fullName}.`);
    } catch (e: any) {
      showToast('error', 'Update Failed', e.message);
    }
  };

  const handleSendTestEmail = async (guardian: Guardian) => {
    setTestSending(guardian.guardianId);
    setAlertNotice(null);

    try {
      const linkedStudentId = guardian.studentIds?.[0];
      const student = linkedStudentId ? students[linkedStudentId] : null;

      if (!student) {
        throw new Error('No linked student found for this guardian.');
      }

      await executeScan({
        qrToken: student.qrTokenHash || student.studentId,
        eventType: 'ENTRY',
        guardId: 'admin_test',
        guardName: 'Admin System Verification',
      });

      setAlertNotice(`Test notification sent successfully for ${guardian.email}.`);
      setTimeout(() => setAlertNotice(null), 5000);
    } catch (e: any) {
      setAlertNotice(`Failed to trigger email: ${e.message}`);
    } finally {
      setTestSending(null);
    }
  };

  const filtered = guardians.filter((g) => {
    const term = search.toLowerCase();
    const gName = g.fullName.toLowerCase();
    const gEmail = g.email.toLowerCase();
    return gName.includes(term) || gEmail.includes(term);
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>Parent &amp; Guardian Directory</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Registered recipients for automated student entry and departure email alerts.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            Total Guardians: {guardians.length}
          </div>
        </div>

        {alertNotice && (
          <div className="p-3 mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{alertNotice}</span>
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parent name or email address..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading parent directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No parent or guardian records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Guardian Name</th>
                  <th className="p-3">Verified Email</th>
                  <th className="p-3">Linked Student(s)</th>
                  <th className="p-3">Email Alerts</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((g) => {
                  const studentObjs = (g.studentIds || [])
                    .map((id) => students[id])
                    .filter(Boolean) as Student[];
                  const isEnabled = g.notificationsEnabled !== false;

                  return (
                    <tr key={g.guardianId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 pl-4 font-bold text-slate-900 whitespace-nowrap">{g.fullName}</td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {g.email}
                          <span title="Email verified"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {studentObjs.length > 0 ? (
                            studentObjs.map((s) => (
                              <span
                                key={s.studentId}
                                className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-100"
                              >
                                {s.firstName} {s.lastName} ({s.studentId})
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              {(g.studentIds || []).join(', ') || 'None'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleNotifications(g)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {isEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                          {isEnabled ? 'Enabled' : 'Muted'}
                        </button>
                      </td>

                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleSendTestEmail(g)}
                          disabled={testSending === g.guardianId}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{testSending === g.guardianId ? 'Sending...' : 'Test Alert'}</span>
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

export default GuardianManagement;
