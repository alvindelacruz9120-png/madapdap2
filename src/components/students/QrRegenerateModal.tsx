import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Student } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateQrDataUrl, downloadDataUrl } from '../../utils/qr';
import { AlertTriangle, RefreshCw, Download, Printer, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { generateCryptographicToken } from '../../services/scanService';

interface QrRegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onRegenerated: (updatedStudent: Student) => void;
}

export const QrRegenerateModal: React.FC<QrRegenerateModalProps> = ({
  isOpen,
  onClose,
  student,
  onRegenerated,
}) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ rawToken: string; qrUrl: string } | null>(null);

  if (!student) return null;

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      let token = '';
      let tokenHash = '';

      try {
        const res = await fetch('/api/qr/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          token = data.token;
          tokenHash = data.tokenHash;
        } else {
          throw new Error('API offline');
        }
      } catch {
        const gen = await generateCryptographicToken();
        token = gen.token;
        tokenHash = gen.tokenHash;
      }

      const studentDocId = student.id || `std_${student.studentId}`;
      const timestamp = new Date().toISOString();

      await setDoc(
        doc(db, 'students', studentDocId),
        { qrTokenHash: tokenHash, updatedAt: timestamp },
        { merge: true }
      );

      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          actorId: userProfile?.uid || 'admin',
          action: 'REGENERATE_QR',
          targetId: student.studentId,
          details: `Revoked prior QR and issued new cryptographic credential for ${student.firstName} ${student.lastName}.`,
          timestamp,
        });
      } catch (e) {
        console.warn(e);
      }

      const qrDataUrl = await generateQrDataUrl(token);
      const updated = {
        ...student,
        qrTokenHash: tokenHash,
        rawQrToken: token,
        updatedAt: timestamp,
      };

      setSuccessData({ rawToken: token, qrUrl: qrDataUrl });
      onRegenerated(updated);
      showToast('success', 'QR Token Replaced', 'New cryptographic credentials issued for student.');
    } catch (err: any) {
      showToast('error', 'Regeneration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!successData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Replacement QR Card - ${student.firstName} ${student.lastName}</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #fff; }
            .card { width: 320px; height: 480px; border: 2px solid #0f172a; border-radius: 16px; overflow: hidden; text-align: center; }
            .header { background: #0f172a; color: white; padding: 16px; }
            .name { font-size: 18px; font-weight: bold; margin-top: 15px; color: #0f172a; }
            .id { font-size: 13px; font-weight: bold; color: #2563eb; }
            .qr { margin: 20px auto; width: 140px; height: 140px; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px; font-size: 10px; color: #64748b; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div style="font-size: 14px; font-weight: bold;">${settings.schoolName || 'Madapdap Resettlement High School'}</div>
              <div style="font-size: 10px; color: #94a3b8;">REPLACEMENT ID BADGE</div>
            </div>
            <div class="name">${student.firstName} ${student.lastName}</div>
            <div class="id">ID: ${student.studentId}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${student.gradeLevel} - ${student.section}</div>
            <img class="qr" src="${successData.qrUrl}" alt="QR" />
            <div class="footer">Previous QR credentials have been permanently revoked.</div>
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
      title={successData ? 'New QR Credential Ready' : 'Revoke & Regenerate QR Code'}
      description={
        successData
          ? 'The previous QR code has been permanently invalidated. Download or print the new card.'
          : 'Security credential rotation for lost, stolen, or damaged student cards.'
      }
      maxWidth="md"
    >
      {successData ? (
        <div className="py-2 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {student.firstName} {student.lastName} ({student.studentId})
            </h4>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">
              New cryptographic key successfully activated!
            </p>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl inline-block shadow-xs">
            <img src={successData.qrUrl} alt="New QR" className="w-40 h-40 rounded" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => downloadDataUrl(successData.qrUrl, `QR_${student.studentId}_new.png`)}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              Print Card
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">Warning: Irreversible Credential Rotation</p>
              <p className="mt-1 leading-normal">
                Regenerating the QR code will <strong>permanently revoke</strong> the current QR code for{' '}
                <strong>{student.firstName} {student.lastName} (ID: {student.studentId})</strong>. Any printed ID card using the old QR will immediately fail gate scan verification.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">What happens next:</div>
            <div>&bull; A fresh 192-bit cryptographic token will be created.</div>
            <div>&bull; Only the secure SHA-256 hash will be stored in Firestore.</div>
            <div>&bull; You will immediately receive the new printable QR code.</div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-xs shadow-rose-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Rotating Key...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Regenerate QR</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default QrRegenerateModal;
