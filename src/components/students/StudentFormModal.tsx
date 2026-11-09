import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Guardian, Student } from '../../types';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { generateQrDataUrl, downloadDataUrl } from '../../utils/qr';
import { useAuth } from '../../context/AuthContext';
import { generateCryptographicToken } from '../../services/scanService';
import { hashPassword, generateStudentId, generateInitialPassword } from '../../utils/security';
import { 
  User, 
  Mail, 
  School, 
  UserCheck, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Printer, 
  Download, 
  ShieldCheck, 
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  IdCard,
  Building,
  Lock,
  PhoneCall,
  BellRing,
  Eye,
  EyeOff,
  GraduationCap
} from 'lucide-react';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (student: Student, rawToken?: string) => void;
  studentToEdit?: Student | null;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  studentToEdit,
}) => {
  const { userProfile } = useAuth();

  // Section 1: Personal Information
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');

  // Section 2: Academic Information
  const [studentId, setStudentId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 10');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Section 3: Parent/Guardian Information
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');

  // Section 4: Account Information
  const [portalPassword, setPortalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [savedStudent, setSavedStudent] = useState<Student | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  useEffect(() => {
    if (studentToEdit) {
      setStudentId(studentToEdit.studentId || '');
      setFirstName(studentToEdit.firstName || '');
      setMiddleName(studentToEdit.middleName || '');
      setLastName(studentToEdit.lastName || '');
      setStudentEmail(studentToEdit.email || studentToEdit.studentEmail || '');
      setPortalPassword(studentToEdit.portalPassword || '');
      setGradeLevel(studentToEdit.gradeLevel || 'Grade 10');
      setSection(studentToEdit.section || '');
      setStatus(studentToEdit.status || 'ACTIVE');
      setGuardianName(studentToEdit.guardianName || '');
      setGuardianEmail(studentToEdit.guardianEmail || '');

      // Fetch guardian if linked via guardianIds
      if (!studentToEdit.guardianEmail && studentToEdit.guardianIds && studentToEdit.guardianIds.length > 0) {
        const fetchGuardian = async () => {
          try {
            const gSnap = await getDocs(query(collection(db, 'guardians'), where('studentIds', 'array-contains', studentToEdit.studentId)));
            if (!gSnap.empty) {
              const gData = gSnap.docs[0].data() as Guardian;
              setGuardianName(gData.fullName || '');
              setGuardianEmail(gData.email || '');
            }
          } catch {}
        };
        void fetchGuardian();
      }
    } else {
      // Auto-generate fresh Student ID and initial secure password for new enrollments
      setStudentId(generateStudentId());
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setStudentEmail('');
      setPortalPassword(generateInitialPassword());
      setGradeLevel('Grade 10');
      setSection('');
      setGuardianName('');
      setGuardianEmail('');
      setStatus('ACTIVE');
    }
    setQrUrl('');
    setSavedStudent(null);
    setError('');
  }, [studentToEdit, isOpen]);

  const handleAutoGenerateId = () => {
    setStudentId(generateStudentId());
  };

  const handleAutoGeneratePassword = () => {
    setPortalPassword(generateInitialPassword());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const cleanStudentId = (studentId.trim() || generateStudentId());
      const cleanStudentEmail = studentEmail.trim().toLowerCase();
      const cleanGuardianEmail = guardianEmail.trim().toLowerCase();
      const cleanGuardianName = guardianName.trim();
      const cleanPass = portalPassword.trim() || generateInitialPassword();

      // Cryptographically hash the portal password using SHA-256
      const passHash = await hashPassword(cleanPass);

      let token = studentToEdit?.rawQrToken || '';
      let tokenHash = studentToEdit?.qrTokenHash || '';

      if (!studentToEdit || !tokenHash) {
        try {
          const response = await fetch('/api/qr/generate-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            token = data.token;
            tokenHash = data.tokenHash;
          } else {
            throw new Error('API offline');
          }
        } catch {
          // Client-side Web Crypto fallback
          const gen = await generateCryptographicToken();
          token = gen.token;
          tokenHash = gen.tokenHash;
        }
      }

      const payload: Student = {
        studentId: cleanStudentId,
        firstName: firstName.trim(),
        middleName: middleName.trim() || '',
        lastName: lastName.trim(),
        email: cleanStudentEmail || '',
        studentEmail: cleanStudentEmail || '',
        portalUsername: cleanStudentId,
        portalPassword: cleanPass || '', // Preserved for on-screen receipt printing
        portalPasswordHash: passHash, // Used for secure authentication
        gradeLevel,
        section: section.trim(),
        status,
        qrTokenHash: tokenHash,
        guardianIds: studentToEdit?.guardianIds || [],
        guardianName: cleanGuardianName || '',
        guardianEmail: cleanGuardianEmail || '',
        parentEmail: cleanGuardianEmail || '',
        createdAt: studentToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check duplicate student ID when creating
      if (!studentToEdit) {
        const dup = await getDocs(query(collection(db, 'students'), where('studentId', '==', payload.studentId)));
        if (!dup.empty) throw new Error(`Student ID "${payload.studentId}" is already registered in the system.`);
      }

      // Check duplicate student email if provided
      if (cleanStudentEmail) {
        const dupEmail = await getDocs(query(collection(db, 'students'), where('email', '==', cleanStudentEmail)));
        const otherDocs = dupEmail.docs.filter((d) => (d.data() as Student).studentId !== cleanStudentId);
        if (otherDocs.length > 0) {
          throw new Error(`The student Gmail "${cleanStudentEmail}" is already linked to another student.`);
        }
      }

      // Save or update Guardian in both collection and student record
      if (cleanGuardianEmail) {
        const gid = `guard_${payload.studentId}_1`;
        const guardianData: Guardian = {
          guardianId: gid,
          fullName: cleanGuardianName || 'Parent / Guardian',
          email: cleanGuardianEmail,
          studentIds: [payload.studentId],
          notificationsEnabled: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'guardians', gid), guardianData, { merge: true });
        payload.guardianIds = Array.from(new Set([...(payload.guardianIds || []), gid]));
      }

      // Save Student Doc
      const studentDocId = studentToEdit?.id || `std_${payload.studentId}`;
      await setDoc(doc(db, 'students', studentDocId), payload, { merge: true });

      const finalStudent = { ...payload, id: studentDocId };
      onSaved(finalStudent, token);
      setSavedStudent(finalStudent);

      if (token) {
        const generated = await generateQrDataUrl(token);
        setQrUrl(generated);
      }

      // Audit Log
      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          actorId: userProfile?.uid || 'admin',
          action: studentToEdit ? 'UPDATE_STUDENT' : 'ENROLL_STUDENT',
          targetId: payload.studentId,
          timestamp: new Date().toISOString(),
        });
      } catch {}

    } catch (err: any) {
      setError(err.message || 'Failed to save student profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!savedStudent) return;
    const credText = `MADAPDAP RESETTLEMENT SENIOR HIGH SCHOOL\nStudent Portal Login Credentials\n\nStudent: ${savedStudent.firstName} ${savedStudent.lastName}\nStudent ID / Username: ${savedStudent.studentId}\nPortal Password: ${savedStudent.portalPassword || 'marhs123'}\n${savedStudent.studentEmail ? `Linked Google SSO: ${savedStudent.studentEmail}\n` : ''}\nLogin at: ${window.location.origin}`;
    navigator.clipboard.writeText(credText);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2000);
  };

  const printBadge = () => {
    if (!savedStudent || !qrUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID Badge - ${savedStudent.studentId}</title>
          <style>
            @page { size: portrait; margin: 0; }
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
            .card { width: 320px; background: white; border: 2px solid #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            .header { background: #0f172a; color: white; padding: 16px 12px; text-align: center; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header p { margin: 3px 0 0; font-size: 10px; color: #94a3b8; }
            .body { padding: 20px 16px; text-align: center; }
            .qr-wrap { background: white; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 12px; display: inline-block; margin-bottom: 12px; }
            .qr-wrap img { width: 170px; height: 170px; display: block; }
            .name { font-size: 16px; font-weight: bold; color: #0f172a; margin: 0; }
            .id-num { font-size: 13px; font-family: monospace; font-weight: bold; color: #2563eb; margin: 4px 0 0; }
            .class-info { font-size: 11px; color: #64748b; margin: 4px 0 16px; }
            .portal-creds { background: #f1f5f9; border-radius: 8px; padding: 10px; font-size: 11px; text-align: left; margin-top: 10px; }
            .portal-creds table { width: 100%; border-collapse: collapse; font-size: 10px; }
            .portal-creds td { padding: 2px 0; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 9px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2>Madapdap Resettlement SHS</h2>
              <p>Official Student Gate ID &amp; Attendance Badge</p>
            </div>
            <div class="body">
              <div class="qr-wrap">
                <img src="${qrUrl}" alt="QR Code" />
              </div>
              <h3 class="name">${savedStudent.firstName} ${savedStudent.lastName}</h3>
              <div class="id-num">${savedStudent.studentId}</div>
              <div class="class-info">${savedStudent.gradeLevel} &bull; Section ${savedStudent.section}</div>
              <div class="portal-creds">
                <strong>Student Portal Login Credentials:</strong>
                <table>
                  <tr><td style="color:#64748b;">Username:</td><td style="font-family:monospace;font-weight:bold;">${savedStudent.studentId}</td></tr>
                  <tr><td style="color:#64748b;">Initial Password:</td><td style="font-family:monospace;font-weight:bold;">${savedStudent.portalPassword || 'marhs123'}</td></tr>
                </table>
              </div>
            </div>
            <div class="footer">
              Valid for School Year 2026-2027 &bull; Scan at school gate for daily attendance
            </div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 400); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={studentToEdit ? 'Edit Student & Guardian Information' : 'Enroll New Student'}
      description="DepEd Institutional Registration & Cryptographic Gate QR Issuance"
      maxWidth="2xl"
    >
      {savedStudent ? (
        // Registration Confirmation Card
        <div className="space-y-4 font-sans animate-in fade-in">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-emerald-900">
                Student Successfully Enrolled!
              </h4>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Student record for <strong>{savedStudent.firstName} {savedStudent.lastName}</strong> has been saved. Initial portal credentials and cryptographic QR attendance badge have been generated.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Credential Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>Student Portal Credentials</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedCreds ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCreds ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-bold text-slate-900">{savedStudent.firstName} {savedStudent.lastName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Student ID / User:</span>
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{savedStudent.studentId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Initial Password:</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{savedStudent.portalPassword || 'marhs123'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Grade &amp; Section:</span>
                  <span className="font-medium text-slate-700">{savedStudent.gradeLevel} - {savedStudent.section}</span>
                </div>
                {savedStudent.guardianEmail && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Parent Alerts:</span>
                    <span className="font-mono text-slate-700 truncate max-w-[150px]">{savedStudent.guardianEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: QR Code Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center text-center shadow-xs">
              <span className="text-xs font-bold text-slate-800 mb-2">Cryptographic Gate Badge</span>
              {qrUrl ? (
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs mb-3">
                  <img src={qrUrl} alt="Student QR Code" className="w-32 h-32" />
                </div>
              ) : (
                <div className="w-32 h-32 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs mb-3">
                  Loading QR...
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printBadge}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print ID Badge</span>
                </button>
                {qrUrl && (
                  <button
                    type="button"
                    onClick={() => downloadDataUrl(qrUrl, `MARHS_ID_${savedStudent.studentId}.png`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              Close &amp; Finish
            </button>
          </div>
        </div>
      ) : (
        // Clean 4-Section Institutional Enrollment Form
        <form onSubmit={submit} className="space-y-4 font-sans">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: Personal Information */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <User className="w-4 h-4 text-blue-600" />
                <span>1. Personal Information</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Student Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Academic Information */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>2. Academic Information</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">School Enrollment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Student ID with Auto-Generate shortcut */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Student ID <span className="text-rose-500">*</span>
                  </label>
                  {!studentToEdit && (
                    <button
                      type="button"
                      onClick={handleAutoGenerateId}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      Generate ID
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={!!studentToEdit}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 2026-1042"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold bg-white disabled:bg-slate-100 disabled:text-slate-500 transition-all text-blue-700"
                />
              </div>

              {/* Grade Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grade Level / Track <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-medium"
                >
                  <optgroup label="Junior High School (JHS)">
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                  </optgroup>
                  <optgroup label="Senior High School (SHS) - Grade 11">
                    <option value="Grade 11 - STEM">Grade 11 - STEM</option>
                    <option value="Grade 11 - ABM">Grade 11 - ABM</option>
                    <option value="Grade 11 - HUMSS">Grade 11 - HUMSS</option>
                    <option value="Grade 11 - TVL">Grade 11 - TVL</option>
                  </optgroup>
                  <optgroup label="Senior High School (SHS) - Grade 12">
                    <option value="Grade 12 - STEM">Grade 12 - STEM</option>
                    <option value="Grade 12 - ABM">Grade 12 - ABM</option>
                    <option value="Grade 12 - HUMSS">Grade 12 - HUMSS</option>
                    <option value="Grade 12 - TVL">Grade 12 - TVL</option>
                  </optgroup>
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Assignment <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. Rizal, Einstein, Diamond"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enrollment Status
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="student_status"
                    checked={status === 'ACTIVE'}
                    onChange={() => setStatus('ACTIVE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-emerald-700">Active (Authorized for Gate Entry)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="student_status"
                    checked={status === 'INACTIVE'}
                    onChange={() => setStatus('INACTIVE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-500">Inactive / Suspended</span>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 3: Parent/Guardian Information */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <BellRing className="w-4 h-4 text-emerald-600" />
                <span>3. Parent / Guardian Notification Contact</span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                Auto-Alert on Gate Scan
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              When the student scans their QR badge at the campus gate (Entry or Exit), the system transmits an instant attendance receipt with exact time and status to this email address.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Full Name
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. Maria Dela Cruz"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent Notification Email <span className="text-emerald-700 font-bold">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    placeholder="parent.guardian@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white transition-all font-mono"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 mt-1 text-[10px]">
                  <span className="text-slate-400">
                    Dispatches via active Resend notification engine
                  </span>
                  <button
                    type="button"
                    onClick={() => setGuardianEmail('alvin.outsourced@gmail.com')}
                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                    title="Fill authorized Resend account email for instant delivery testing"
                  >
                    Use alvin.outsourced@gmail.com (Test Inbox)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Account Information (Student Portal Access) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>4. Student Portal Account &amp; Access</span>
              </div>
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                Secure Hashed Credentials
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Initial Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Portal Initial Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGeneratePassword}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Password is cryptographically hashed with SHA-256 upon saving.
                </span>
              </div>

              {/* Optional Student Google Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Google Account <span className="text-slate-400 font-normal">(Optional SSO)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student.name@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition-all font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Allows student to log into the portal directly via "Continue with Google".
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{studentToEdit ? 'Save Changes' : 'Complete Enrollment & Generate QR'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
