import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Student } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { generateQrDataUrl, downloadDataUrl } from '../../utils/qr';
import { Download, Printer, RefreshCw } from 'lucide-react';

interface StudentIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  rawToken?: string;
}

export const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({
  isOpen,
  onClose,
  student,
  rawToken,
}) => {
  const { settings } = useSettings();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (student && isOpen) {
      setLoading(true);
      const token = rawToken || student.rawQrToken || student.qrTokenHash;
      if (!token) {
        setQrUrl('');
        setLoading(false);
        return;
      }
      generateQrDataUrl(token)
        .then((url) => {
          if (isMounted) {
            setQrUrl(url);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [student, rawToken, isOpen]);

  if (!student) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID - ${student.firstName} ${student.lastName}</title>
          <style>
            @page { size: auto; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .card { width: 320px; height: 490px; background: white; border: 2px solid #0f172a; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; text-align: center; }
            .header { background: #0f172a; color: white; padding: 18px 12px; }
            .school-name { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            .sub { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 3px; }
            .avatar-box { margin-top: 14px; display: flex; justify-content: center; }
            .avatar { width: 70px; height: 70px; border-radius: 50%; background: #e2e8f0; color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
            .student-name { font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 10px; margin-bottom: 2px; }
            .student-id { font-size: 13px; font-weight: 700; color: #2563eb; font-family: monospace; }
            .details { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; }
            .qr-container { margin: 12px auto; padding: 6px; background: white; border: 1px dashed #cbd5e1; border-radius: 10px; display: inline-block; }
            .qr-container img { width: 135px; height: 135px; display: block; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px; font-size: 9px; color: #64748b; margin-top: auto; }
            @media print { body { background: white; } .card { box-shadow: none; border: 1.5px solid #000; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <img src="${window.location.origin}/school-logo.svg" style="width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 6px; display: block; border: 2px solid #f59e0b; background: #fff;" />
              <div class="school-name">${settings.schoolName || 'Madapdap Resettlement High School'}</div>
              <div class="sub">Mabalacat City, Pampanga &bull; OFFICIAL STUDENT ID</div>
            </div>
            <div class="avatar-box">
              <div class="avatar">${student.firstName.charAt(0)}${student.lastName.charAt(0)}</div>
            </div>
            <div class="student-name">${student.firstName} ${student.lastName}</div>
            <div class="student-id">ID: ${student.studentId}</div>
            <div class="details">${student.gradeLevel} &bull; Section ${student.section}</div>
            <div class="qr-container">
              <img src="${qrUrl}" alt="Student QR Code" />
            </div>
            <div class="footer">Automated Campus Attendance &amp; Parent Alert System</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student ID &amp; QR Badge"
      description="Printable student identification card with high-resolution QR scanner code"
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="mx-auto w-[290px] h-[460px] bg-white rounded-2xl border-2 border-slate-900 shadow-xl overflow-hidden flex flex-col text-center relative">
          <div className="bg-slate-900 text-white p-3.5">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <img
                src="/school-logo.svg"
                alt="Logo"
                className="w-5 h-5 rounded-full object-contain bg-white p-0.5 border border-amber-400 shrink-0"
              />
              <h4 className="text-[11px] font-black uppercase tracking-wider line-clamp-1">
                {settings.schoolName || 'Madapdap Resettlement High School'}
              </h4>
            </div>
            <p className="text-[9px] font-medium text-amber-300">STUDENT IDENTIFICATION CARD</p>
          </div>

          <div className="mt-3.5 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-blue-600 flex items-center justify-center text-slate-900 font-extrabold text-xl shadow-inner">
              {student.firstName.charAt(0)}{student.lastName.charAt(0)}
            </div>
          </div>

          <div className="px-3 mt-2">
            <h3 className="text-sm font-black text-slate-900 leading-tight">{student.firstName} {student.lastName}</h3>
            <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">ID: {student.studentId}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
              {student.gradeLevel} &bull; {student.section}
            </div>
          </div>

          <div className="my-auto py-1">
            {loading ? (
              <div className="w-32 h-32 mx-auto flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="inline-block p-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                <img src={qrUrl} alt="Student QR" className="w-32 h-32 block rounded" />
              </div>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-2.5 text-[9px] text-slate-500 font-medium">
            Scan at gate for automated entry/exit logging &amp; parent notification
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => downloadDataUrl(qrUrl, `QR_${student.studentId}.png`)}
            disabled={loading || !qrUrl}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !qrUrl}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print ID Card
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default StudentIdCardModal;
