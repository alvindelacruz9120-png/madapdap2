import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { executeScan } from '../../services/scanService';
import { ScanResult, EventType } from '../../types';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { 
  ScanLine, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  User, 
  Clock, 
  BellRing, 
  Send, 
  RefreshCw,
  SwitchCamera,
  History as HistoryIcon,
  ShieldCheck
} from 'lucide-react';

export const GuardScanner: React.FC = () => {
  const { userProfile, isAdmin } = useAuth();

  // Mode & State
  const [eventType, setEventType] = useState<EventType>('ENTRY');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Result state
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // In-session scan history (last 5 scans)
  const [sessionScans, setSessionScans] = useState<Array<{
    id: string;
    studentName: string;
    studentId: string;
    eventType: EventType;
    status: string;
    time: string;
  }>>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);

  // Auto-start camera on mount with desktop/laptop front-camera fallback
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) {
        void startScanner('environment');
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
      void stopScanner();
    };
  }, []);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899']
      });
    } catch {
      // confetti ignored
    }
  };

  const handleScanSuccess = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed || processing || isCooldownRef.current) return;

    isCooldownRef.current = true;
    setProcessing(true);
    setErrorMessage(null);

    try {
      const res = await executeScan({
        qrToken: trimmed,
        eventType,
        guardId: userProfile?.uid || 'gate-guard-1',
        guardName: userProfile?.fullName || 'Gate Guard Officer'
      });

      setLastScanResult(res);

      // Audio & Visual celebratory feedback
      if (eventType === 'ENTRY') {
        sounds.playSuccess();
        triggerCelebration();
      } else {
        sounds.playExit();
        triggerCelebration();
      }

      // Append to session scans
      setSessionScans((prev) => [
        {
          id: res.attendance.eventId,
          studentName: res.student.fullName,
          studentId: res.student.studentId,
          eventType: res.attendance.eventType,
          status: res.attendance.status,
          time: res.attendance.time
        },
        ...prev.slice(0, 9)
      ]);
    } catch (err: any) {
      sounds.playError();
      const msg = err.message || 'QR code verification failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setProcessing(false);
      // Brief cooldown to prevent multi-reads of the same frame
      window.setTimeout(() => {
        isCooldownRef.current = false;
      }, 2500);
    }
  };

  const startScanner = async (facing: 'environment' | 'user' = cameraFacing) => {
    setCameraError(null);
    try {
      // If already running, stop first
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      const html5Qr = new Html5Qrcode('qr-reader-viewport');
      scannerRef.current = html5Qr;

      try {
        await html5Qr.start(
          { facingMode: facing },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            void handleScanSuccess(decodedText);
          },
          () => {
            // frame decode miss
          }
        );
      } catch (firstErr) {
        // Fallback for laptops/desktops where only 1 camera exists
        const alternateFacing = facing === 'environment' ? 'user' : 'environment';
        await html5Qr.start(
          { facingMode: alternateFacing },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            void handleScanSuccess(decodedText);
          },
          () => {
            // frame decode miss
          }
        );
        setCameraFacing(alternateFacing);
      }

      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsScanning(false);
      setCameraError(
        err.message || 'Unable to access camera. Please allow camera permissions in your browser.'
      );
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (e) {
      console.warn('Scanner stop warning:', e);
    } finally {
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (isScanning) {
      await stopScanner();
      await startScanner(nextFacing);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setIsManualSubmitting(true);
    try {
      await handleScanSuccess(manualCode.trim());
      setManualCode('');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ScanLine className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              School Gate QR Attendance Scanner
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Official QR entry &amp; exit scanner with instant parent email alerts. Works anywhere (Vercel &amp; Mobile).
          </p>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setEventType('ENTRY')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              eventType === 'ENTRY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>CAMPUS ENTRY</span>
          </button>
          <button
            type="button"
            onClick={() => setEventType('EXIT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              eventType === 'EXIT'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>CAMPUS EXIT</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Camera & Scanner Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-4 shadow-xl overflow-hidden text-white relative">
            {/* Header overlay */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isScanning ? `${eventType} Mode Active` : 'Camera Inactive'}
                </span>
              </div>

              {isScanning && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
                  title="Switch Front/Back Camera"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
                  <span>{cameraFacing === 'environment' ? 'Back Cam' : 'Front Cam'}</span>
                </button>
              )}
            </div>

            {/* Viewport Box */}
            <div className="relative rounded-2xl overflow-hidden bg-black/80 aspect-4/3 flex items-center justify-center border border-white/10">
              <div id="qr-reader-viewport" className="w-full h-full" />

              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-xs">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center mb-3 text-slate-400">
                    <Camera className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Gate Camera is Ready</h3>
                  <p className="text-xs text-slate-400 max-w-xs mb-4">
                    Point camera at student QR badge. Scanner automatically logs entry/exit and sends real-time email notification.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startScanner()}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Launch Gate Camera</span>
                  </button>
                </div>
              )}

              {/* Processing Spinner Overlay */}
              {processing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                  <RefreshCw className="w-10 h-10 animate-spin text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    Verifying Student QR Code...
                  </span>
                </div>
              )}
            </div>

            {/* Camera Control Footer */}
            <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              {isScanning ? (
                <button
                  type="button"
                  onClick={() => void stopScanner()}
                  className="w-full py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Turn Off Camera</span>
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 w-full justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Camera permission required on mobile &amp; laptop devices</span>
                </div>
              )}
            </div>
          </div>

          {/* Camera Error Alert */}
          {cameraError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Camera Access Issue</p>
                <p className="text-[11px] text-rose-600 mt-0.5">{cameraError}</p>
              </div>
            </div>
          )}

          {/* Manual Input Fallback (for damaged QR cards or direct Student ID entry) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <span>Manual Student ID / QR Code Input</span>
              <span className="text-[10px] text-slate-400 font-normal">(Card backup)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mb-2.5">
              If the physical badge is creased or camera is unavailable, enter Student ID (e.g. 2026-101) or QR token:
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter Student ID or paste QR code token..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || isManualSubmitting || processing}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {isManualSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Log {eventType}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scan Result & Real-Time Feedback */}
        <div className="lg:col-span-5 space-y-4">
          {/* Error Message Notice */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 space-y-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 font-black text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Verification Alert</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed pl-6">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Latest Verified Student Badge */}
          {lastScanResult ? (
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  RECORDED &amp; VERIFIED
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black ${
                    lastScanResult.attendance.eventType === 'ENTRY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {lastScanResult.attendance.eventType === 'ENTRY' ? 'CAMPUS ENTRY' : 'CAMPUS EXIT'}
                </span>
              </div>

              {/* Student Profile Card */}
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                  {lastScanResult.student.firstName.charAt(0)}{lastScanResult.student.lastName.charAt(0)}
                </div>
                <div className="truncate">
                  <h3 className="text-base font-black text-slate-900 leading-tight truncate">
                    {lastScanResult.student.fullName}
                  </h3>
                  <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                    ID: {lastScanResult.student.studentId}
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {lastScanResult.student.gradeLevel} &bull; {lastScanResult.student.section}
                  </div>
                </div>
              </div>

              {/* Attendance Details Grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Time Recorded</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {lastScanResult.attendance.time}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Attendance Status</span>
                  <span
                    className={`inline-block font-extrabold mt-0.5 ${
                      lastScanResult.attendance.status === 'PRESENT'
                        ? 'text-emerald-600'
                        : lastScanResult.attendance.status === 'LATE'
                        ? 'text-amber-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {lastScanResult.attendance.status}
                  </span>
                </div>
              </div>

              {/* Notification Dispatch Status */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs flex items-center justify-between text-blue-900">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    Parent Email Notification:
                  </span>
                </div>
                <span className="font-bold text-[11px] text-blue-700">
                  {lastScanResult.notifications.totalTargeted > 0
                    ? `Dispatched (${lastScanResult.notifications.totalTargeted})`
                    : 'Logged'}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 space-y-2">
              <ScanLine className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">No scans recorded yet this session</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Once a student QR badge is scanned, student details and parent notification dispatch status will appear here.
              </p>
            </div>
          )}

          {/* Quick Recent Session Activity Log */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <HistoryIcon className="w-4 h-4 text-slate-500" />
                <span>Recent Scans (Current Session)</span>
              </h4>
              <span className="text-[10px] font-semibold text-slate-400">
                {sessionScans.length} scan(s)
              </span>
            </div>

            {sessionScans.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                Scanned students will be listed here in real time.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {sessionScans.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">
                        {item.studentName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.studentId} &bull; {item.time}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.eventType === 'ENTRY'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {item.eventType} {item.status !== 'N/A' ? `(${item.status})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardScanner;
