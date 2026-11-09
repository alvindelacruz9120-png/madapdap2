import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Student, Guardian } from '../../types';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { hashTokenClient } from '../../utils/qr';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download 
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const sampleCsv = `Student ID,First Name,Middle Name,Last Name,Grade Level,Section,Parent Full Name,Parent Email
2026-101,Alexander,,Tan,Grade 10,Diamond,Eduardo Tan,tan.family@gmail.com
2026-102,Sophia,Marie,Reyes,Grade 10,Diamond,Elena Reyes,reyes.elena@gmail.com
2026-103,Ethan,James,Cruz,Grade 11 - STEM,Einstein,Victoria Cruz,vcruz.parent@gmail.com
2026-104,Chloe,,Santos,Grade 12 - ICT,Turing,Roberto Santos,rsantos@outlook.com`;

  const handleLoadSample = () => {
    setCsvText(sampleCsv);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text || '');
    };
    reader.readAsText(file);
  };

  const parseAndValidate = async () => {
    setParsing(true);
    setErrorLog([]);
    const errors: string[] = [];
    const validRows: any[] = [];

    try {
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error('CSV must contain a header line and at least one student data row.');
      }

      // Fetch existing student IDs to prevent collision
      const studentsSnap = await getDocs(collection(db, 'students'));
      const existingIds = new Set(studentsSnap.docs.map(d => d.data().studentId));
      const fileIds = new Set();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV splitter handling basic commas
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const [rawId, firstName, middleName, lastName, gradeLevel, section, parentName, parentEmail] = cols;

        if (!rawId || !firstName || !lastName || !gradeLevel || !section || !parentEmail) {
          errors.push(`Row ${i + 1}: Missing required fields.`);
          continue;
        }

        if (existingIds.has(rawId)) {
          errors.push(`Row ${i + 1}: Student ID "${rawId}" already exists in the school database.`);
          continue;
        }

        if (fileIds.has(rawId)) {
          errors.push(`Row ${i + 1}: Duplicate Student ID "${rawId}" within the CSV file.`);
          continue;
        }

        if (!parentEmail.includes('@') || !parentEmail.includes('.')) {
          errors.push(`Row ${i + 1}: Invalid email address "${parentEmail}".`);
          continue;
        }

        fileIds.add(rawId);
        validRows.push({
          studentId: rawId,
          firstName,
          middleName: middleName || '',
          lastName,
          gradeLevel,
          section,
          parentName: parentName || 'Guardian',
          parentEmail: parentEmail.toLowerCase()
        });
      }

      setParsedRows(validRows);
      setErrorLog(errors);
    } catch (err: any) {
      setErrorLog([err.message || 'Error parsing CSV']);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const timestamp = new Date().toISOString();

      for (const row of parsedRows) {
        // 1. Generate token
        const rawToken = `${row.studentId}_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        const tokenHash = await hashTokenClient(rawToken);

        // 2. Save Guardian
        const guardianId = `guard_${row.studentId}_1`;
        const guardianData: Guardian = {
          guardianId,
          fullName: row.parentName,
          email: row.parentEmail,
          studentIds: [row.studentId],
          emailVerified: true,
          notificationsEnabled: true,
          createdAt: timestamp
        };
        await setDoc(doc(db, 'guardians', guardianId), guardianData, { merge: true });

        // 3. Save Student
        const studentDocId = `std_${row.studentId}`;
        const studentData: Student = {
          studentId: row.studentId,
          firstName: row.firstName,
          middleName: row.middleName || undefined,
          lastName: row.lastName,
          gradeLevel: row.gradeLevel,
          section: row.section,
          status: 'ACTIVE',
          qrTokenHash: tokenHash,
          guardianIds: [guardianId],
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await setDoc(doc(db, 'students', studentDocId), studentData);
      }

      onImportComplete(parsedRows.length);
      onClose();
    } catch (err: any) {
      setErrorLog(prev => [...prev, `Import failed: ${err.message}`]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Student CSV Import"
      description="Import multiple students at once. Unique QR credentials and parent alerts will be generated automatically."
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Upload & Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs">
              <UploadCloud className="w-4 h-4 text-blue-600" />
              <span>Choose CSV File</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Load Sample Data
            </button>
          </div>

          <button
            type="button"
            onClick={parseAndValidate}
            disabled={!csvText.trim() || parsing}
            className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {parsing ? 'Validating...' : 'Validate & Preview'}
          </button>
        </div>

        {/* Text Area */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            CSV Contents (or paste spreadsheet rows directly):
          </label>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Student ID,First Name,Middle Name,Last Name,Grade Level,Section,Parent Full Name,Parent Email..."
            className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
          />
        </div>

        {/* Error warnings */}
        {errorLog.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Validation Warnings ({errorLog.length}):
            </div>
            <ul className="list-disc list-inside text-[11px] max-h-24 overflow-y-auto space-y-0.5">
              {errorLog.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {parsedRows.length} Valid Student Record(s) Ready to Register
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 text-[11px] font-bold">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Grade &amp; Section</th>
                    <th className="p-2">Parent / Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-blue-600">{r.studentId}</td>
                      <td className="p-2 font-medium">{r.firstName} {r.lastName}</td>
                      <td className="p-2 text-slate-600">{r.gradeLevel} - {r.section}</td>
                      <td className="p-2 text-slate-600">{r.parentName} ({r.parentEmail})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsedRows.length === 0 || importing}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20 disabled:opacity-50"
          >
            {importing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Registering Students &amp; Generating QRs...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import {parsedRows.length > 0 ? `(${parsedRows.length})` : ''} Students</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
