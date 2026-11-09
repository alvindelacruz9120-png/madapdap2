import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { EmailLog } from '../../types';
import { 
  Mail, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  RotateCw, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

export const EmailLogs: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'email_logs'),
      orderBy('sentAt', 'desc'),
      limit(150)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), logId: d.id } as EmailLog));
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error reading email logs:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleRetry = async (logId: string) => {
    setRetryingId(logId);
    try {
      const targetLog = logs.find(l => l.logId === logId);
      if (!targetLog) throw new Error('Log record not found.');

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: targetLog.recipient,
          studentName: targetLog.guardianName ? `Student (${targetLog.studentId})` : targetLog.studentId,
          studentId: targetLog.studentId,
          eventType: targetLog.eventType,
          timeStr: new Date(targetLog.sentAt).toLocaleTimeString(),
          dateStr: new Date(targetLog.sentAt).toLocaleDateString()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        await setDoc(doc(db, 'email_logs', logId), {
          deliveryStatus: 'SENT',
          simulated: false,
          providerMessageId: data.messageId || null,
          errorMessage: data.note || null,
          retriedAt: new Date().toISOString()
        }, { merge: true });

        showToast('success', 'Live Email Delivered via Resend!', `Alert dispatched to ${data.deliveredTo || targetLog.recipient} (ID: ${data.messageId || 'Success'}).`);
        return;
      } else {
        throw new Error(data.error || 'Failed to dispatch email via Resend.');
      }
    } catch (err: any) {
      showToast('error', 'Dispatch Retry Failed', err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const handleQuickTest = async () => {
    setRetryingId('quick_test');
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: 'alvin.outsourced@gmail.com'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('success', 'Live Verification Sent!', `Test email delivered to alvin.outsourced@gmail.com (Resend ID: ${data.messageId}). Check your Gmail!`);
      } else {
        showToast('error', 'Test Dispatch Error', data.error || 'Could not send test email.');
      }
    } catch (e: any) {
      showToast('error', 'Connection Error', e.message);
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = logs.filter(l => {
    const term = search.toLowerCase();
    const recipient = l.recipient.toLowerCase();
    const student = l.studentId.toLowerCase();
    const matchesSearch = recipient.includes(term) || student.includes(term);
    const matchesStatus = statusFilter === 'ALL' || l.deliveryStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sentCount = logs.filter(l => l.deliveryStatus === 'SENT' && !l.simulated).length;
  const simulatedCount = logs.filter(l => l.simulated).length;
  const failedCount = logs.filter(l => l.deliveryStatus === 'FAILED').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Resend Sandbox Live Delivery Notice */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-amber-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-bold text-amber-950">Resend Live Delivery Policy Notice:</span>
          </div>
          <button
            type="button"
            onClick={handleQuickTest}
            disabled={retryingId === 'quick_test'}
            className="self-start sm:self-auto px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3 h-3 ${retryingId === 'quick_test' ? 'animate-spin' : ''}`} />
            <span>Send Live Test to My Gmail (alvin.outsourced@gmail.com)</span>
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-800">
          When using Resend's free default domain (<code>onboarding@resend.dev</code>), Resend strictly permits delivery to your registered Resend account address (<strong>alvin.outsourced@gmail.com</strong>). When a student with an external parent email is scanned, our backend forwards a live alert copy to your account inbox so you can verify the email instantly. To send directly to external parent inboxes (like <code>alvindelacruz917@gmail.com</code>), verify your school domain at <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-bold text-amber-950">resend.com/domains</a>.
        </p>
      </div>

      {/* Top Banner & Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <span>Parent Email Delivery Audit Logs</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Real-time audit log of automated campus arrival and departure emails dispatched via Resend.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              {sentCount} Live Dispatched
            </span>
            {simulatedCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                {simulatedCount} Historical Simulated
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              failedCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {failedCount} Failed
            </span>
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
              placeholder="Search by parent email or student ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="SENT">SENT (Successful)</option>
              <option value="FAILED">FAILED (Requires Attention)</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading email delivery logs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No parent email logs match your search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Parent Recipient</th>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Notification Event</th>
                  <th className="p-3">Delivery Status</th>
                  <th className="p-3">Resend Message ID</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.logId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 pl-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleTimeString()} &bull; {new Date(log.sentAt).toLocaleDateString()}
                    </td>

                    <td className="p-3 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.recipient}</span>
                      </div>
                    </td>

                    <td className="p-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {log.studentId}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                        log.eventType === 'ENTRY' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {log.eventType} ALERT
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.deliveryStatus === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.deliveryStatus === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {log.deliveryStatus === 'SENT' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : log.deliveryStatus === 'FAILED' ? (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        {log.deliveryStatus}
                        {log.simulated && <span className="text-[9px] text-slate-400">(simulated)</span>}
                      </span>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.providerMessageId || (log.errorMessage ? <span className="text-rose-600 truncate max-w-xs block">{log.errorMessage}</span> : 'N/A')}
                    </td>

                    <td className="p-3 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          View Details
                        </button>

                        {(log.deliveryStatus === 'FAILED' || log.simulated) && (
                          <button
                            onClick={() => handleRetry(log.logId)}
                            disabled={retryingId === log.logId}
                            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
                              log.simulated
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                          >
                            <RotateCw className={`w-3 h-3 ${retryingId === log.logId ? 'animate-spin' : ''}`} />
                            <span>{log.simulated ? 'Dispatch Live' : 'Retry'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Notification Dispatch Details"
          description="Detailed payload and delivery trace from Resend API"
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Email:</span>
                <span className="font-bold text-slate-900">{selectedLog.recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student ID:</span>
                <span className="font-mono font-bold text-blue-600">{selectedLog.studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Event Type:</span>
                <span className="font-bold text-slate-800">{selectedLog.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-700">{new Date(selectedLog.sentAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Status:</span>
                <span className={`font-bold ${selectedLog.deliveryStatus === 'SENT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedLog.deliveryStatus} {selectedLog.simulated ? '(Simulated Mode)' : ''}
                </span>
              </div>
              {selectedLog.providerMessageId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider Message ID:</span>
                  <span className="font-mono text-[11px] text-slate-700">{selectedLog.providerMessageId}</span>
                </div>
              )}
            </div>

            {selectedLog.errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                <div className="font-bold text-rose-900 mb-0.5">Delivery Error Trace:</div>
                <div className="font-mono text-[11px]">{selectedLog.errorMessage}</div>
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900">
              <div className="font-bold mb-1">Standard Email Template Dispatched:</div>
              <div className="p-2 bg-white rounded border border-blue-200 text-slate-700 font-mono text-[10px] leading-relaxed">
                Subject: Student {selectedLog.eventType} Notification<br /><br />
                Dear Parent/Guardian,<br />
                This is to inform you that your child has successfully {selectedLog.eventType === 'ENTRY' ? 'entered' : 'exited'} school premises.<br />
                Student ID: {selectedLog.studentId}<br />
                Date &amp; Time: {new Date(selectedLog.sentAt).toLocaleString()}<br />
                Thank you.<br />
                Automated Student Attendance System
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
