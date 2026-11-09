import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Student } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { generateQrDataUrl } from '../../utils/qr';
import { useToast } from '../../context/ToastContext';
import { QrCode, Printer, Download, RefreshCw, Search } from 'lucide-react';

interface QRCodesProps {
  onSelectStudentForCard: (student: Student) => void;
  onSelectStudentForRegenerate: (student: Student) => void;
}

export const QRCodes: React.FC<QRCodesProps> = ({
  onSelectStudentForCard,
  onSelectStudentForRegenerate,
}) => {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const uniqueGrades = Array.from(new Set(students.map((s) => s.gradeLevel).filter(Boolean)));

  const filtered = students.filter((s) => {
    const sName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matchesSearch =
      sName.includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesGrade = selectedGrade === 'ALL' || s.gradeLevel === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const handleBulkPrint = async () => {
    if (filtered.length === 0) return;
    setIsBulkPrinting(true);

    try {
      const cardsData: Array<{ student: Student; qrUrl: string }> = [];
      for (const s of filtered) {
        const token = s.rawQrToken || s.qrTokenHash;
        if (!token) continue;
        const qrUrl = await generateQrDataUrl(token);
        cardsData.push({ student: s, qrUrl });
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setIsBulkPrinting(false);
        return;
      }

      const cardsHtml = cardsData
        .map(
          ({ student: s, qrUrl }) => `
            <div class="card">
              <div class="header">
                <img src="${window.location.origin}/school-logo.svg" style="width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 4px; display: block; border: 1.5px solid #f59e0b; background: #fff;" />
                <div class="school-name">${settings.schoolName || 'Madapdap Resettlement High School'}</div>
                <div class="sub">Mabalacat City, Pampanga &bull; STUDENT ID BADGE</div>
              </div>
              <div class="avatar-box">
                <div class="avatar">${s.firstName.charAt(0)}${s.lastName.charAt(0)}</div>
              </div>
              <div class="student-name">${s.firstName} ${s.lastName}</div>
              <div class="student-id">ID: ${s.studentId}</div>
              <div class="details">${s.gradeLevel} &bull; ${s.section}</div>
              <div class="qr-box">
                <img src="${qrUrl}" alt="QR" />
              </div>
              <div class="footer">Gate Attendance &bull; Automated Parent Alerts</div>
            </div>
          `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bulk Student ID Cards - ${settings.schoolName || 'Madapdap Resettlement High School'}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background-color: #fff; }
              .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; page-break-after: always; justify-items: center; }
              .card { width: 310px; height: 460px; border: 2px solid #0f172a; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; text-align: center; background: white; }
              .header { background: #0f172a; color: white; padding: 14px 10px; }
              .school-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
              .sub { font-size: 9px; color: #94a3b8; font-weight: bold; margin-top: 2px; }
              .avatar-box { margin-top: 10px; display: flex; justify-content: center; }
              .avatar { width: 60px; height: 60px; border-radius: 50%; background: #e2e8f0; color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; }
              .student-name { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 8px; }
              .student-id { font-size: 12px; font-weight: 700; color: #2563eb; font-family: monospace; }
              .details { font-size: 10px; color: #475569; margin-top: 2px; font-weight: 600; }
              .qr-box { margin: 8px auto; padding: 4px; border: 1px dashed #cbd5e1; border-radius: 8px; display: inline-block; background: white; }
              .qr-box img { width: 125px; height: 125px; display: block; }
              .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 8px; font-size: 8px; color: #64748b; margin-top: auto; }
              @media print { body { background: white; } }
            </style>
          </head>
          <body>
            <div class="sheet">
              ${cardsHtml}
            </div>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      showToast('error', 'Print Preparation Failed', err.message);
    } finally {
      setIsBulkPrinting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <span>QR Code &amp; Student ID Card Hub</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              High-resolution QR badges ready for printing, card cutting, or batch laminate production.
            </p>
          </div>

          <button
            onClick={handleBulkPrint}
            disabled={filtered.length === 0 || isBulkPrinting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20 disabled:opacity-50"
          >
            {isBulkPrinting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Preparing Sheet...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Print All {filtered.length} Cards (Batch Sheet)</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name or ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Grade Levels ({students.length})</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          Loading student ID cards...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          No students found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((s) => (
            <div
              key={s.studentId}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="bg-slate-900 text-white p-3 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-300">
                  {settings.schoolName || 'Madapdap Resettlement High School'}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">STUDENT PASS</span>
              </div>

              <div className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-blue-600 flex items-center justify-center font-black text-slate-800 text-sm mx-auto mb-2 shadow-inner">
                  {s.firstName.charAt(0)}{s.lastName.charAt(0)}
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  {s.firstName} {s.lastName}
                </h4>
                <div className="text-[11px] font-mono font-bold text-blue-600 mt-0.5">
                  ID: {s.studentId}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {s.gradeLevel} &bull; {s.section}
                </div>

                <div className="mt-3 p-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl inline-block">
                  <QrCode className="w-16 h-16 text-slate-800 mx-auto" />
                  <span className="text-[9px] text-slate-400 block mt-1 font-mono">SHA-256 HASHED</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectStudentForCard(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectStudentForRegenerate(s)}
                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                  title="Revoke & Rotate Key"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRCodes;
