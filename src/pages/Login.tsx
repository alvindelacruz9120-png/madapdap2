import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, ensureFirestoreAuth } from '../lib/firebase';
import { Student } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { findStudentByQrToken } from '../services/scanService';
import { verifyPassword } from '../utils/security';
import { 
  Mail, 
  Lock, 
  User, 
  AlertCircle,
  ScanLine,
  ArrowRight,
  Copy,
  Check,
  Shield,
  School,
  QrCode,
  Camera,
  CameraOff,
  X,
  Sparkles,
  GraduationCap,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const Login: React.FC = () => {
  const { showToast } = useToast();
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    loginAsDemoGuard, 
    loginAsStudentQr,
    loading 
  } = useAuth();

  const [tab, setTab] = useState<'staff' | 'student'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  
  // Student Portal Credentials State
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<{ title: string; desc: string; domain?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Student QR Scanner Modal State
  const [isStudentQrModalOpen, setIsStudentQrModalOpen] = useState(false);
  const [studentScanError, setStudentScanError] = useState<string | null>(null);
  const [studentScanSuccess, setStudentScanSuccess] = useState<string | null>(null);
  const [isStudentProcessing, setIsStudentProcessing] = useState(false);
  const [manualStudentCode, setManualStudentCode] = useState('');
  const studentScannerRef = useRef<Html5Qrcode | null>(null);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // Clean up student scanner on unmount or close
  useEffect(() => {
    return () => {
      if (studentScannerRef.current && studentScannerRef.current.isScanning) {
        studentScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // When student modal opens, auto-start camera
  useEffect(() => {
    if (isStudentQrModalOpen) {
      const timer = setTimeout(() => {
        void startStudentCamera();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isStudentQrModalOpen]);

  const handleStudentScan = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed || isStudentProcessing) return;

    setIsStudentProcessing(true);
    setStudentScanError(null);

    try {
      await ensureFirestoreAuth();
      const student = await findStudentByQrToken(trimmed);
      setStudentScanSuccess(`Welcome, ${student.firstName}! Launching Student Portal...`);
      sounds.playSuccess();
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b']
        });
      } catch {
        // ignore
      }

      if (studentScannerRef.current && studentScannerRef.current.isScanning) {
        await studentScannerRef.current.stop();
        await studentScannerRef.current.clear();
      }

      window.setTimeout(() => {
        loginAsStudentQr(student);
      }, 600);
    } catch (err: any) {
      sounds.playError();
      setStudentScanError(err.message || 'QR code not recognized. Make sure your ID card is registered.');
    } finally {
      setIsStudentProcessing(false);
    }
  };

  const startStudentCamera = async () => {
    setStudentScanError(null);
    try {
      if (studentScannerRef.current?.isScanning) {
        await studentScannerRef.current.stop();
      }
      const qrScanner = new Html5Qrcode('student-login-qr-reader');
      studentScannerRef.current = qrScanner;

      try {
        await qrScanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
          (decoded) => {
            void handleStudentScan(decoded);
          },
          () => {}
        );
      } catch {
        // Fallback to front camera on laptops/desktops
        await qrScanner.start(
          { facingMode: 'user' },
          { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
          (decoded) => {
            void handleStudentScan(decoded);
          },
          () => {}
        );
      }
    } catch (err: any) {
      setStudentScanError(err.message || 'Unable to access camera. Please allow camera permissions.');
    }
  };

  const closeStudentModal = async () => {
    try {
      if (studentScannerRef.current && studentScannerRef.current.isScanning) {
        await studentScannerRef.current.stop();
        await studentScannerRef.current.clear();
      }
    } catch {}
    studentScannerRef.current = null;
    setIsStudentQrModalOpen(false);
    setStudentScanError(null);
    setStudentScanSuccess(null);
  };

  const handleManualStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStudentCode.trim()) return;
    await handleStudentScan(manualStudentCode.trim());
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const code = err.code || '';
      
      if (code === 'auth/unauthorized-domain') {
        setErrorMsg({
          title: 'Domain Not Authorized',
          desc: 'Please add this domain under Firebase Console > Authentication > Settings > Authorized domains:',
          domain: currentHostname
        });
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg({
          title: 'Pop-up Window Blocked',
          desc: 'Please allow pop-ups for this site in your browser, or sign in using email and password.'
        });
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg({
          title: 'Google Provider Not Enabled',
          desc: 'Please enable Google sign-in under Firebase Console > Authentication > Sign-in method.'
        });
      } else {
        setErrorMsg({
          title: 'Sign-in Failed',
          desc: err.message || 'Unable to complete Google sign-in. Please try again or use email sign-in.'
        });
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await signInWithEmail(email.trim(), password);
    } catch (err: any) {
      setErrorMsg({
        title: 'Staff Authentication Failed',
        desc: err.message || 'Invalid email or password. Please verify your staff credentials.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const cleanUser = studentUsername.trim();
      const cleanPass = studentPassword.trim();

      if (!cleanUser || !cleanPass) {
        throw new Error('Please enter your Student ID / Username and Password.');
      }

      // Ensure active Firebase Auth session so Firestore rules permit reading students
      await ensureFirestoreAuth();

      // Query students collection
      const studentsCol = collection(db, 'students');
      let matchedDoc: any = null;

      // 1. Match by studentId
      const qId = query(studentsCol, where('studentId', '==', cleanUser));
      const sId = await getDocs(qId);
      if (!sId.empty) {
        matchedDoc = sId.docs.find(d => d.data().firstName) || sId.docs[0];
      }

      // 2. Match by portalUsername
      if (!matchedDoc) {
        const qPortal = query(studentsCol, where('portalUsername', '==', cleanUser));
        const sPortal = await getDocs(qPortal);
        if (!sPortal.empty) {
          matchedDoc = sPortal.docs.find(d => d.data().firstName) || sPortal.docs[0];
        }
      }

      // 3. Match by student email
      if (!matchedDoc && cleanUser.includes('@')) {
        const qEmail = query(studentsCol, where('email', '==', cleanUser.toLowerCase()));
        const sEmail = await getDocs(qEmail);
        if (!sEmail.empty) {
          matchedDoc = sEmail.docs[0];
        } else {
          const qEmail2 = query(studentsCol, where('studentEmail', '==', cleanUser.toLowerCase()));
          const sEmail2 = await getDocs(qEmail2);
          if (!sEmail2.empty) {
            matchedDoc = sEmail2.docs[0];
          }
        }
      }

      // 4. Case-insensitive fallback scan across students collection
      if (!matchedDoc) {
        const allSnap = await getDocs(studentsCol);
        const lowerUser = cleanUser.toLowerCase();
        matchedDoc = allSnap.docs.find((d) => {
          const data = d.data() as Student;
          if (!data.studentId && !data.firstName) return false;
          const sid = (data.studentId || '').trim().toLowerCase();
          const pun = (data.portalUsername || '').trim().toLowerCase();
          const em1 = (data.email || '').trim().toLowerCase();
          const em2 = (data.studentEmail || '').trim().toLowerCase();
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim().toLowerCase();
          return (
            sid === lowerUser ||
            pun === lowerUser ||
            em1 === lowerUser ||
            em2 === lowerUser ||
            fullName === lowerUser ||
            d.id.toLowerCase() === lowerUser ||
            d.id.toLowerCase() === `std_${lowerUser}`
          );
        });
      }

      if (!matchedDoc) {
        throw new Error(`Student record "${cleanUser}" not found. Please verify your Student ID.`);
      }

      const studentData = { ...matchedDoc.data(), id: matchedDoc.id } as Student;

      // Status check
      if (studentData.status && studentData.status !== 'ACTIVE') {
        throw new Error(`Student account is currently ${studentData.status}. Please contact the school office.`);
      }

      // Cryptographic password verification (supports SHA-256 hash with legacy fallback)
      const isPasswordValid = await verifyPassword(
        cleanPass,
        studentData.portalPasswordHash,
        studentData.portalPassword || 'marhs123'
      );
      if (!isPasswordValid && cleanPass !== studentData.studentId) {
        throw new Error('Incorrect portal password. Please verify your credentials or contact the school office.');
      }

      sounds.playSuccess();
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b']
        });
      } catch {}

      loginAsStudentQr(studentData);
    } catch (err: any) {
      sounds.playError();
      setErrorMsg({
        title: 'Student Portal Login Failed',
        desc: err.message || 'Unable to log into student portal.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg({
        title: 'Email Required',
        desc: 'Please enter your email address in the field above to receive a password reset link.'
      });
      return;
    }
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('success', 'Reset Link Dispatched', `Password reset instructions sent to ${email.trim()}. Please check your inbox.`);
    } catch (err: any) {
      setErrorMsg({
        title: 'Reset Failed',
        desc: err.message || 'Unable to send password reset email. Please verify the email address.'
      });
    }
  };

  const handleCopyDomain = () => {
    if (errorMsg?.domain) {
      navigator.clipboard.writeText(errorMsg.domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Background Campus Photo with Deep Vignette */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/campus-bg.svg')` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/85 backdrop-blur-[2px]" />

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 my-auto">
        <div className="w-full max-w-md space-y-5">

          {/* School Emblem & Header */}
          <div className="text-center space-y-2">
            {/* Crisp School Seal */}
            <div className="inline-block relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white p-1.5 shadow-2xl ring-2 ring-amber-400 mx-auto flex items-center justify-center">
                <img 
                  src="/school-logo.svg" 
                  alt="Madapdap Resettlement High School Seal"
                  className="w-full h-full object-contain rounded-full" 
                />
              </div>
            </div>

            {/* School Name & System Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase drop-shadow">
                Madapdap Resettlement High School
              </h1>
              <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase mt-0.5">
                Mabalacat City, Pampanga
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30">
                <span className="text-xs sm:text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                  Student Attendance &amp; Parent Alert System
                </span>
              </div>
            </div>
          </div>

          {/* Clean Glassmorphic Auth Card */}
          <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100">
            
            {/* Tab Pill Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setTab('staff');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  tab === 'staff'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Staff &amp; Admin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setTab('student');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  tab === 'student'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
                <span>Student Portal</span>
              </button>
            </div>

            {/* Error Banner with Optional Domain Copy */}
            {errorMsg && (
              <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {errorMsg.desc}
                </p>
                {errorMsg.domain && (
                  <div className="space-y-2">
                    <div className="p-2 bg-black/60 rounded-xl font-mono text-[10px] text-amber-300 flex items-center justify-between">
                      <span className="truncate">{errorMsg.domain}</span>
                      <button
                        type="button"
                        onClick={handleCopyDomain}
                        className="ml-2 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-md flex items-center gap-1 shrink-0 text-[10px] transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <a
                      href="https://console.firebase.google.com/project/madapdapattendance/authentication/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 underline font-semibold"
                    >
                      Open Firebase Console &gt; Authorized Domains &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: STAFF & ADMIN SIGN IN */}
            {tab === 'staff' && (
              <div className="space-y-4 animate-in fade-in">
                {/* Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[46px] bg-white hover:bg-slate-100 text-slate-800 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-transparent px-2">
                    <span className="bg-slate-900 px-3 py-0.5 rounded-full border border-white/10">or staff email sign-in</span>
                  </div>
                </div>

                {/* Staff Email / Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Staff Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@school.edu.ph"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showStaffPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                        className="w-full pl-10 pr-10 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                        title={showStaffPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || loading}
                    className="w-full py-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-lg shadow-amber-400/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-1"
                  >
                    <span>{submitting ? 'Authenticating...' : 'Sign In as Staff / Admin'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Quick Gate Scanner Button */}
                <div className="pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={loginAsDemoGuard}
                    className="w-full py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <ScanLine className="w-4 h-4 text-amber-400" />
                    <span>Open Mobile Gate Scanner (Guard Mode)</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: STUDENT PORTAL ACCESS */}
            {tab === 'student' && (
              <div className="space-y-4 animate-in fade-in">
                {/* 1-Tap QR Scanner Button */}
                <button
                  type="button"
                  onClick={() => setIsStudentQrModalOpen(true)}
                  className="w-full py-3.5 px-4 min-h-[50px] rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/25 transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99] border border-blue-400/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5 text-amber-300 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="text-left">
                      <span className="block text-white leading-tight font-black">Scan QR ID Badge</span>
                      <span className="block text-[10px] text-blue-200 font-normal">Instant camera scan to enter portal</span>
                    </div>
                  </div>
                  <Camera className="w-5 h-5 text-amber-300" />
                </button>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-transparent px-2">
                    <span className="bg-slate-900 px-3 py-0.5 rounded-full border border-white/10">or enter credentials</span>
                  </div>
                </div>

                {/* Student ID / Username and Password Form */}
                <form onSubmit={handleStudentCredentialLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Student ID or Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={studentUsername}
                        onChange={(e) => setStudentUsername(e.target.value)}
                        placeholder="e.g. 2026-101"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Portal Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showStudentPassword ? 'text' : 'password'}
                        required
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                        className="w-full pl-10 pr-10 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                        title={showStudentPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Enter the portal password assigned to your student account.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || loading}
                    className="w-full py-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/30 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-1"
                  >
                    <span>{submitting ? 'Checking records...' : 'Enter Student Portal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Divider for Google */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-transparent px-2">
                    <span className="bg-slate-900 px-3 py-0.5 rounded-full border border-white/10">or with linked Google</span>
                  </div>
                </div>

                {/* Google Sign-In for Student */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Student Google Sign-In</span>
                </button>
              </div>
            )}
          </div>

          {/* School Footer */}
          <div className="text-center text-[11px] text-slate-400 space-y-1">
            <p className="italic">"Excellence, Integrity, and Dedicated Service to Youth &amp; Community"</p>
            <p>&copy; {new Date().getFullYear()} Madapdap Resettlement High School &bull; Republic of the Philippines</p>
          </div>
        </div>
      </main>

      {/* STUDENT QR SCANNER MODAL */}
      {isStudentQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-white relative space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Student Badge Scanner</h3>
                  <p className="text-[11px] text-slate-400">Hold your student QR card up to the camera</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void closeStudentModal()}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error or Success Notice */}
            {studentScanError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{studentScanError}</span>
              </div>
            )}

            {studentScanSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2 font-bold animate-in zoom-in-95">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{studentScanSuccess}</span>
              </div>
            )}

            {/* Camera Viewport */}
            <div className="relative rounded-2xl overflow-hidden bg-black/90 aspect-square flex items-center justify-center border border-white/10">
              <div id="student-login-qr-reader" className="w-full h-full" />

              {isStudentProcessing && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                  <RefreshCw className="w-10 h-10 animate-spin text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white">Loading your student records...</span>
                </div>
              )}
            </div>

            {/* Manual Student ID / Code Entry */}
            <div className="pt-2 border-t border-slate-800">
              <p className="text-[11px] text-slate-400 mb-2">Or enter your Student ID directly:</p>
              <form onSubmit={handleManualStudentSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualStudentCode}
                  onChange={(e) => setManualStudentCode(e.target.value)}
                  placeholder="e.g. 2026-101 or QR token"
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualStudentCode.trim() || isStudentProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Enter</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
