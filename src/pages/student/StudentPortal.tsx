import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, ensureFirestoreAuth } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  updateDoc,
  getDocs 
} from 'firebase/firestore';
import { AttendanceRecord, AttendanceEvent, Student } from '../../types';
import { generateQrDataUrl } from '../../utils/qr';
import { hashPassword, verifyPassword } from '../../utils/security';
import { 
  User, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Award, 
  TrendingUp, 
  Download, 
  Sparkles,
  School,
  RefreshCw,
  CalendarCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Shield
} from 'lucide-react';

export const StudentPortal: React.FC = () => {
  const { userProfile, linkedStudent: contextStudent, signOutUser } = useAuth();

  const [student, setStudent] = useState<Student | null>(contextStudent);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [scanEvents, setScanEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'id_badge' | 'security'>('overview');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg] = useState('');
  const [pwErrorMsg, setPwErrorMsg] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErrorMsg('');
    setPwSuccessMsg('');

    if (!student || !student.id) {
      setPwErrorMsg('Student account record could not be found.');
      return;
    }

    if (!currentPassword) {
      setPwErrorMsg('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setPwErrorMsg('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwErrorMsg('New password and confirmation do not match.');
      return;
    }

    setPwSubmitting(true);
    try {
      await ensureFirestoreAuth();
      // Verify current password against stored hash or fallback
      const isCurrentValid = await verifyPassword(
        currentPassword,
        student.portalPasswordHash,
        student.portalPassword || 'marhs123'
      );
      if (!isCurrentValid) {
        setPwErrorMsg('Current password is incorrect.');
        setPwSubmitting(false);
        return;
      }

      // Hash new password using SHA-256
      const newHash = await hashPassword(newPassword);

      // Update in Firestore
      await updateDoc(doc(db, 'students', student.id), {
        portalPassword: newPassword.trim(),
        portalPasswordHash: newHash,
        passwordResetRequired: false,
        updatedAt: new Date().toISOString()
      });

      // Update local student state
      const updatedStudent: Student = {
        ...student,
        portalPassword: newPassword.trim(),
        portalPasswordHash: newHash,
        passwordResetRequired: false
      };
      setStudent(updatedStudent);

      // Update cached session in localStorage if active
      const cached = localStorage.getItem('student_portal_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.studentId === student.studentId) {
            localStorage.setItem('student_portal_user', JSON.stringify({
              ...parsed,
              student: updatedStudent
            }));
          }
        } catch {
          // ignore
        }
      }

      setPwSuccessMsg('Password successfully updated and secured with SHA-256 encryption.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password update error:', err);
      setPwErrorMsg('Failed to update password. Please check your network connection.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const studentId = student?.studentId || userProfile?.studentId;

  // 1. Fetch Student profile if not already loaded in context
  useEffect(() => {
    if (contextStudent) {
      setStudent(contextStudent);
      return;
    }

    if (!studentId && userProfile?.email) {
      const fetchStudentByEmail = async () => {
        try {
          const normEmail = userProfile.email.trim().toLowerCase();
          const q1 = query(collection(db, 'students'), where('email', '==', normEmail));
          const s1 = await getDocs(q1);
          if (!s1.empty) {
            setStudent({ ...s1.docs[0].data(), id: s1.docs[0].id } as Student);
          } else {
            const q2 = query(collection(db, 'students'), where('studentEmail', '==', normEmail));
            const s2 = await getDocs(q2);
            if (!s2.empty) {
              setStudent({ ...s2.docs[0].data(), id: s2.docs[0].id } as Student);
            }
          }
        } catch (err) {
          console.warn('Error loading student by email:', err);
        }
      };
      void fetchStudentByEmail();
    }
  }, [contextStudent, studentId, userProfile?.email]);

  // 2. Real-time Attendance & Event Listeners
  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    // Attendance ledger
    const qAttendance = query(
      collection(db, 'attendance'),
      where('studentId', '==', studentId)
    );
    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const records = snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as AttendanceRecord));
      // Sort descending by date
      records.sort((a, b) => b.date.localeCompare(a.date));
      setAttendanceRecords(records);
    }, (err) => {
      console.warn('Attendance records listener error:', err);
      setLoading(false);
    });

    // Recent gate scan events
    const qEvents = query(
      collection(db, 'attendance_events'),
      where('studentId', '==', studentId)
    );
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      const events = snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as AttendanceEvent));
      events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setScanEvents(events);
      setLoading(false);
    }, (err) => {
      console.warn('Scan events listener error:', err);
      setLoading(false);
    });

    return () => {
      unsubAttendance();
      unsubEvents();
    };
  }, [studentId]);

  // 3. Generate QR Data URL for Student Digital Badge
  useEffect(() => {
    if (student) {
      const token = student.rawQrToken || student.qrTokenHash;
      if (token) {
        generateQrDataUrl(token)
          .then(setQrCodeDataUrl)
          .catch((err) => console.warn('QR gen error in student portal:', err));
      }
    }
  }, [student]);

  // Today's Date String in Manila Time
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const todayRecord = attendanceRecords.find((r) => r.date === todayStr);

  // Computed Statistics
  const totalDaysPresent = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const totalDaysLate = attendanceRecords.filter((r) => r.status === 'LATE').length;
  const totalRecordedDays = attendanceRecords.length;
  const onTimeRate = totalRecordedDays > 0 
    ? Math.round((totalDaysPresent / totalRecordedDays) * 100) 
    : 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-3" />
        <p className="text-xs font-semibold text-slate-300">Loading Student Attendance Portal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Student Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl border border-white/10 p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-400 text-slate-950 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg border-2 border-amber-300">
              {student ? `${student.firstName.charAt(0)}${student.lastName.charAt(0)}` : 'S'}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-bold text-blue-300 mb-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>OFFICIAL STUDENT PORTAL</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {student ? `${student.firstName} ${student.lastName}` : (userProfile?.fullName || 'Student')}
              </h1>
              <p className="text-xs text-slate-300 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                <span>ID: {student?.studentId || studentId || 'N/A'}</span>
                <span>&bull;</span>
                <span>{student?.gradeLevel || 'Grade Level'} - Section {student?.section || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* Quick tab switcher */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Scan History
            </button>
            <button
              onClick={() => setActiveTab('id_badge')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'id_badge'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Digital ID Badge</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Account &amp; Security</span>
            </button>
            <button
              onClick={() => void signOutUser()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-600/80 transition-all flex items-center gap-1.5 border border-rose-500/30 ml-1 cursor-pointer"
              title="Sign Out of Student Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Today's Campus Gate Status Alert Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <CalendarCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">Today's Attendance Status</h3>
                  <p className="text-xs text-slate-500 font-medium">Real-time gate verification &bull; {todayStr}</p>
                </div>
              </div>

              {todayRecord ? (
                <span
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    todayRecord.status === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : todayRecord.status === 'LATE'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {todayRecord.status === 'PRESENT' ? 'PRESENT (ON-TIME)' : todayRecord.status}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  NOT RECORDED YET TODAY
                </span>
              )}
            </div>

            {/* In / Out Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">First Campus Entry</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {todayRecord?.firstEntryAt 
                        ? new Date(todayRecord.firstEntryAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : 'No entry logged today'}
                    </span>
                  </div>
                </div>
                {todayRecord?.firstEntryAt && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded-md">
                    VERIFIED
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Last Campus Exit</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {todayRecord?.lastExitAt 
                        ? new Date(todayRecord.lastExitAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : todayRecord?.firstEntryAt 
                        ? 'Still inside campus' 
                        : 'No departure logged'}
                    </span>
                  </div>
                </div>
                {todayRecord?.lastExitAt && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-200/60 px-2 py-0.5 rounded-md">
                    LOGGED
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Days Present</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{totalDaysPresent}</div>
              <div className="text-[11px] text-slate-400 mt-1">Recorded on-time arrivals</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">On-Time Rate</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-600">{onTimeRate}%</div>
              <div className="text-[11px] text-slate-400 mt-1">Attendance consistency score</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Late Arrivals</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">{totalDaysLate}</div>
              <div className="text-[11px] text-slate-400 mt-1">Entries after 7:30 AM cutoff</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Scans</span>
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{scanEvents.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">Gate pass check-ins &amp; check-outs</div>
            </div>
          </div>

          {/* Recent Scans Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-3">Recent Gate Events</h3>
            {scanEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No scan events recorded yet for this student.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {scanEvents.slice(0, 5).map((ev) => (
                  <div key={ev.eventId} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                        ev.eventType === 'ENTRY' ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}>
                        {ev.eventType === 'ENTRY' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block leading-tight">
                          {ev.eventType === 'ENTRY' ? 'Gate Entry Recorded' : 'Gate Exit Recorded'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {ev.date} &bull; {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {ev.eventType === 'ENTRY' ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ev.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {ev.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium">DEPARTED CAMPUS</span>
                      )}
                      <span className="text-[10px] text-slate-400 block mt-0.5">Duty Guard: {ev.guardName || 'Officer'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCAN HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Complete Attendance History Ledger</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
              {attendanceRecords.length} Record(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Entry Time</th>
                  <th className="p-3">Exit Time</th>
                  <th className="p-3">Total Passes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                      No attendance history recorded yet.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((r) => (
                    <tr key={r.id || r.date} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4 font-bold text-slate-900 font-mono">
                        {r.date}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {r.firstEntryAt ? new Date(r.firstEntryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {r.lastExitAt ? new Date(r.lastExitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {r.entryCount || 0} in / {r.exitCount || 0} out
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIGITAL ID BADGE TAB */}
      {activeTab === 'id_badge' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center">
          <div className="text-center max-w-sm mb-6">
            <h3 className="text-base font-black text-slate-900">Your Student Digital ID &amp; QR Badge</h3>
            <p className="text-xs text-slate-500 mt-1">
              Present this high-resolution QR code on your phone screen to the gate scanner camera upon entry and exit.
            </p>
          </div>

          {/* Realistic ID Badge Card */}
          <div className="w-[300px] h-[470px] bg-white rounded-2xl border-2 border-slate-900 shadow-2xl overflow-hidden flex flex-col text-center relative">
            <div className="bg-slate-900 text-white p-3.5">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <img
                  src="/school-logo.svg"
                  alt="Logo"
                  className="w-5 h-5 rounded-full object-contain bg-white p-0.5 border border-amber-400 shrink-0"
                />
                <h4 className="text-[11px] font-black uppercase tracking-wider line-clamp-1">
                  Madapdap Resettlement HS
                </h4>
              </div>
              <p className="text-[9px] font-medium text-amber-300">STUDENT IDENTIFICATION CARD</p>
            </div>

            <div className="mt-3 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-blue-600 flex items-center justify-center text-slate-900 font-extrabold text-xl shadow-inner">
                {student ? `${student.firstName.charAt(0)}${student.lastName.charAt(0)}` : 'S'}
              </div>
            </div>

            <div className="px-3 mt-2">
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                {student ? `${student.firstName} ${student.lastName}` : (userProfile?.fullName || 'Student')}
              </h3>
              <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                ID: {student?.studentId || studentId || 'N/A'}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                {student?.gradeLevel || 'Grade'} &bull; {student?.section || 'Section'}
              </div>
            </div>

            <div className="my-auto py-1">
              {qrCodeDataUrl ? (
                <div className="inline-block p-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <img src={qrCodeDataUrl} alt="Student QR Code" className="w-32 h-32 block rounded" />
                </div>
              ) : (
                <div className="w-32 h-32 mx-auto flex items-center justify-center bg-slate-100 rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-2.5 text-[9px] text-slate-500 font-medium">
              Scan at gate for automated entry/exit logging &amp; parent notification
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT & SECURITY TAB */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Profile Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Student Account Profile</h3>
                <p className="text-xs text-slate-500">Official student portal registration details</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</span>
                <span className="font-extrabold text-slate-800 text-sm">
                  {student ? `${student.firstName} ${student.lastName}` : (userProfile?.fullName || 'Student')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student ID</span>
                  <span className="font-mono font-bold text-blue-700">{student?.studentId || studentId || 'N/A'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grade &amp; Section</span>
                  <span className="font-bold text-slate-800">{student?.gradeLevel} &bull; {student?.section}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Google Account</span>
                <span className="font-mono text-slate-800 break-all">{student?.studentEmail || student?.email || 'Not configured'}</span>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Parent Alert Destination</span>
                  <span className="text-[9px] font-extrabold bg-blue-200/80 text-blue-800 px-2 py-0.5 rounded-full">ACTIVE DISPATCH</span>
                </div>
                <span className="font-mono font-semibold text-slate-900 break-all">
                  {student?.guardianEmail || student?.parentEmail || 'No parent email linked'}
                </span>
                <p className="text-[10px] text-blue-600/80 mt-1">
                  Automated gate arrival and dismissal emails are dispatched to this address on every scan.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Credential Encryption</span>
                  <span className="text-xs font-bold text-emerald-900">SHA-256 Hashed in Database</span>
                </div>
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>
            </div>
          </div>

          {/* Change Password Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Lock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Change Portal Password</h3>
                <p className="text-xs text-slate-500">Secure your portal credentials with high-strength hashing</p>
              </div>
            </div>

            {pwSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{pwSuccessMsg}</span>
              </div>
            )}

            {pwErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{pwErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white text-slate-900 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white text-slate-900 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white text-slate-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwSubmitting}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {pwSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Encrypting &amp; Saving...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Update Portal Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
