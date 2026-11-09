import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSaved: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSaved
}) => {
  const { userProfile } = useAuth();
  const [newStatus, setNewStatus] = useState<AttendanceStatus>(record?.status || 'PRESENT');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid administrative reason is required for attendance adjustments.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const docId = record.id || `${record.studentId}_${record.date}`;
      const timestamp = new Date().toISOString();

      // 1. Update attendance record
      await setDoc(doc(db, 'attendance', docId), {
        status: newStatus,
        correctedBy: userProfile?.uid || 'admin',
        correctionReason: reason.trim(),
        correctedAt: timestamp,
        updatedAt: timestamp
      }, { merge: true });

      // 2. Write immutable audit log
      await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
        actorId: userProfile?.uid || 'admin',
        actorName: userProfile?.fullName || 'Administrator',
        action: 'CORRECT_ATTENDANCE',
        targetId: record.studentId,
        details: `Modified status for ${record.studentName || record.studentId} on ${record.date} from ${record.status} to ${newStatus}. Reason: ${reason.trim()}`,
        timestamp
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Administrative Attendance Correction"
      description="Authorized status override with mandatory audit tracking"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Student:</span>
            <span className="font-bold text-slate-900">{record.studentName || record.studentId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date:</span>
            <span className="font-medium text-slate-700">{record.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Status:</span>
            <span className="font-bold text-slate-800">{record.status}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            New Attendance Status <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setNewStatus(st)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                  newStatus === st
                    ? st === 'PRESENT'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : st === 'LATE'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Reason for Correction <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Excused medical certificate submitted, clinic pass verified by school nurse, etc."
            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-blue-50/70 text-blue-800 p-2.5 rounded-xl border border-blue-100">
          <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
          <span>This action is logged to the immutable audit database with your administrator ID.</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Save Correction</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
