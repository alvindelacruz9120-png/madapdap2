import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { getDefaultGatewayToken } from '../../utils/security';
import { 
  Settings as SettingsIcon, 
  School, 
  Clock, 
  Mail, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  RotateCw, 
  Send,
  KeyRound,
  Plus,
  Trash2,
  Layers,
  Eye,
  EyeOff,
  Globe,
  Sliders,
  AlertCircle,
  FileText
} from 'lucide-react';

type SettingsTab = 'school' | 'attendance' | 'email' | 'security';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('school');

  // Form State
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [address, setAddress] = useState(settings.address || 'Mabalacat City, Pampanga');
  const [motto, setMotto] = useState(settings.motto || "Excellence, Integrity, and Dedicated Service to Youth & Community");
  const [schoolLogo, setSchoolLogo] = useState(settings.schoolLogo || '/school-logo.svg');
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Manila');
  const [openingTime, setOpeningTime] = useState(settings.openingTime || '07:00');
  const [lateCutoff, setLateCutoff] = useState(settings.lateCutoff || '07:30');
  const [closingTime, setClosingTime] = useState(settings.closingTime || '17:00');
  const [schoolDays, setSchoolDays] = useState<string[]>(settings.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

  // Resend / Email Settings
  const [resendApiKey, setResendApiKey] = useState(settings.resendApiKey || getDefaultGatewayToken());
  const [backupResendApiKeys, setBackupResendApiKeys] = useState<string[]>(settings.backupResendApiKeys || []);
  const [newBackupKeyInput, setNewBackupKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Email test sender
  const [testEmail, setTestEmail] = useState('alvin.outsourced@gmail.com');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAddress(settings.address || 'Mabalacat City, Pampanga');
    setMotto(settings.motto || "Excellence, Integrity, and Dedicated Service to Youth & Community");
    setSchoolLogo(settings.schoolLogo || '/school-logo.svg');
    setResendApiKey(settings.resendApiKey || getDefaultGatewayToken());
    setBackupResendApiKeys(settings.backupResendApiKeys || []);
    setTimezone(settings.timezone);
    setOpeningTime(settings.openingTime);
    setLateCutoff(settings.lateCutoff);
    setClosingTime(settings.closingTime);
    setSchoolDays(settings.schoolDays);
  }, [settings]);

  useEffect(() => {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ ...d.data(), auditId: d.id } as AuditLog)));
    }, (err) => {
      console.warn('Audit logs listener error:', err);
    });

    return () => unsub();
  }, []);

  const handleAddBackupKey = async () => {
    const clean = newBackupKeyInput.trim();
    if (!clean) return;
    if (!clean.startsWith('re_')) {
      showToast('warning', 'Invalid Key Format', 'Resend API keys must start with re_');
      return;
    }
    if (clean === resendApiKey || backupResendApiKeys.includes(clean)) {
      showToast('warning', 'Duplicate Key', 'This key is already in your active or backup pool.');
      return;
    }

    const updated = [...backupResendApiKeys, clean];
    setBackupResendApiKeys(updated);
    setNewBackupKeyInput('');

    try {
      await updateSettings({ backupResendApiKeys: updated });
      showToast('success', 'Backup Key Registered', 'New key added to automatic rotation pool.');
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message);
    }
  };

  const handleRemoveBackupKey = async (index: number) => {
    const updated = backupResendApiKeys.filter((_, i) => i !== index);
    setBackupResendApiKeys(updated);
    try {
      await updateSettings({ backupResendApiKeys: updated });
      showToast('success', 'Backup Key Removed', 'Updated rotation pool.');
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const handlePromoteToActive = async (index: number) => {
    const targetKey = backupResendApiKeys[index];
    const oldActive = resendApiKey;
    const remainingBackups = backupResendApiKeys.filter((_, i) => i !== index);
    const updatedBackups = oldActive && oldActive.startsWith('re_') ? [oldActive, ...remainingBackups] : remainingBackups;

    setResendApiKey(targetKey);
    setBackupResendApiKeys(updatedBackups);

    try {
      await updateSettings({
        resendApiKey: targetKey,
        backupResendApiKeys: updatedBackups
      });
      showToast('success', 'Active Key Switched', 'The selected key is now primary.');
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        schoolName: schoolName.trim(),
        address: address.trim(),
        motto: motto.trim(),
        schoolLogo: schoolLogo.trim(),
        resendApiKey: resendApiKey.trim(),
        backupResendApiKeys,
        timezone: timezone.trim(),
        openingTime,
        lateCutoff,
        closingTime,
        schoolDays
      });
      setSavedSuccess(true);
      showToast('success', 'Settings Saved', 'School configuration has been updated across all gate terminals.');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    if (schoolDays.includes(day)) {
      setSchoolDays(schoolDays.filter(d => d !== day));
    } else {
      setSchoolDays([...schoolDays, day]);
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleTestEmailSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    setTestingEmail(true);
    setEmailStatusMessage('');

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: testEmail.trim(),
          testApiKey: resendApiKey.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setEmailStatusMessage(`Success! Live notification delivered via Resend (ID: ${data.messageId}). ${data.note || 'Delivered to ' + testEmail + '. Please check your inbox.'}`);
        showToast('success', 'Email Delivered', `Sent to ${data.deliveredTo || testEmail}!`);
        return;
      } else {
        setEmailStatusMessage(`Notice: ${data.error || 'Failed to dispatch email.'}`);
      }
    } catch (e: any) {
      setEmailStatusMessage(`Error: ${e.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
            <span>System Settings &amp; Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage school identity, gate entry schedules, automated parent email dispatches, and security policies.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
        >
          {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Configuration successfully updated in database and synchronized across all gate scanners!</span>
        </div>
      )}

      {/* Clean Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('school')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'school'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <School className="w-4 h-4" />
          <span>School Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'attendance'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'email'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Parent Email Engine</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security &amp; Audit</span>
        </button>
      </div>

      {/* SECTION 1: SCHOOL INFORMATION */}
      {activeTab === 'school' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-900">Institutional Identity &amp; Region</h3>
            <p className="text-xs text-slate-500">Official DepEd institution name, location, logo, and time zone.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <img 
              src={schoolLogo || '/school-logo.svg'} 
              alt="School Seal" 
              className="w-16 h-16 rounded-full border-2 border-amber-400 bg-white p-1 object-contain shadow-xs shrink-0" 
            />
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900">{schoolName || 'Madapdap Resettlement High School'}</h4>
              <p className="text-xs text-slate-500 font-medium">{address || 'Mabalacat City, Pampanga'}</p>
              <p className="text-[11px] text-amber-700 italic font-semibold">"{motto}"</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campus Location / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Mabalacat City, Pampanga"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                School Motto / Slogan
              </label>
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Excellence, Integrity, and Dedicated Service to Youth & Community"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Logo Asset Path
              </label>
              <input
                type="text"
                value={schoolLogo}
                onChange={(e) => setSchoolLogo(e.target.value)}
                placeholder="/school-logo.svg"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                System Timezone <span className="text-rose-500">*</span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
              >
                <option value="Asia/Manila">Asia/Manila (GMT+8) - Standard Philippine Time</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Save School Info</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: ATTENDANCE TIMETABLE */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-900">Campus Attendance Rules &amp; Schedule</h3>
            <p className="text-xs text-slate-500">Configure gate opening, late arrival threshold, dismissal time, and active school days.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gate Opening Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1.5 block">Earliest check-in allowed at scanner</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                Late Arrival Cutoff <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={lateCutoff}
                onChange={(e) => setLateCutoff(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-bold text-amber-800"
              />
              <span className="text-[10px] text-amber-700 mt-1.5 block">Scans after this hour are recorded LATE</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dismissal / Closing Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1.5 block">Campus departure hour</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Active School Operating Days
            </label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = schoolDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/70 text-xs space-y-1">
            <span className="font-bold text-blue-900 block">Gate Scan Safeguard Policy</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Scanners enforce a 60-second duplicate scan cooldown per student to prevent accidental double-badging. Scans within the gate opening window are categorized as ENTRY, while scans post-lunch or afternoon are recognized as EXIT.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Save Timetable Rules</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 3: PARENT EMAIL ENGINE */}
      {activeTab === 'email' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">Parent Auto-Email Notification Engine</h3>
              <p className="text-xs text-slate-500">Automated campus arrival and dismissal email dispatches powered by Resend API.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Engine Active &amp; Ready</span>
            </span>
          </div>

          {/* Primary Key */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Primary Resend API Key
                </label>
                <p className="text-[11px] text-slate-500">Main credential used to send automated attendance emails.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showApiKey ? 'Mask Key' : 'Reveal Key'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_..."
                className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold bg-white text-slate-900"
              />
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer shadow-xs"
              >
                Save Key
              </button>
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">
              Active Key: {resendApiKey ? `${resendApiKey.slice(0, 7)}...${resendApiKey.slice(-4)}` : 'None'}
            </span>
          </div>

          {/* Backup Keys Pool */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Backup Keys Pool (Auto-Failover on Free Tier Limit)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Add supplementary Resend API keys so the notification service automatically rotates keys if the daily 100-email quota is reached.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newBackupKeyInput}
                onChange={(e) => setNewBackupKeyInput(e.target.value)}
                placeholder="Paste backup key (re_...)"
                className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono bg-white"
              />
              <button
                type="button"
                onClick={handleAddBackupKey}
                disabled={!newBackupKeyInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shrink-0 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Backup</span>
              </button>
            </div>

            {backupResendApiKeys.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Pool ({backupResendApiKeys.length} registered)
                </span>
                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {backupResendApiKeys.map((key, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-mono text-slate-700">
                          {key.substring(0, 8)}••••••••••••{key.substring(key.length - 4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePromoteToActive(idx)}
                          className="px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          Set Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBackupKey(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Test Dispatcher */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
            <div>
              <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-emerald-700" />
                <span>Live Email Test Dispatcher</span>
              </h4>
              <p className="text-[11px] text-emerald-800/80">Send a live test gate alert to verify delivery straight to your email.</p>
            </div>

            <form onSubmit={handleTestEmailSend} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="parent@gmail.com"
                className="flex-1 px-3.5 py-2.5 text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-mono"
              />
              <button
                type="submit"
                disabled={testingEmail}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {testingEmail ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{testingEmail ? 'Dispatching...' : 'Send Live Test'}</span>
              </button>
            </form>

            {emailStatusMessage && (
              <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-900">
                {emailStatusMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: SECURITY & AUDIT */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-900">Security Architecture &amp; Administrative Audit Trail</h3>
            <p className="text-xs text-slate-500">Immutable logging of student enrollments, password resets, and gate terminal actions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Credential Security</span>
              <span className="text-xs font-extrabold text-slate-900 mt-1 block">SHA-256 Hashing</span>
              <p className="text-[10px] text-slate-500 mt-1">Student portal passwords are cryptographically hashed; no plain text stored.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">QR Code Tokens</span>
              <span className="text-xs font-extrabold text-blue-700 mt-1 block">Opaque UUID Tokens</span>
              <p className="text-[10px] text-slate-500 mt-1">QR badges embed only unforgeable tokens, masking student personal data.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Access Control</span>
              <span className="text-xs font-extrabold text-emerald-700 mt-1 block">Role-Based (RBAC)</span>
              <p className="text-[10px] text-slate-500 mt-1">Strict separation between ADMIN, GUARD, and STUDENT scopes.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Audit Trail Events ({auditLogs.length})
              </h4>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                No administrative audit actions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-2xl border border-slate-200 max-h-72 overflow-y-auto text-xs">
                {auditLogs.map((log) => (
                  <div key={log.auditId} className="p-3 flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-mono">
                          {log.action}
                        </span>
                        <span>{log.targetName || log.targetId}</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5 font-mono">
                        ID: {log.targetId} {log.details ? `• ${log.details}` : ''}
                      </div>
                    </div>
                    <div className="font-mono text-slate-400 text-[10px] shrink-0 ml-3">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
