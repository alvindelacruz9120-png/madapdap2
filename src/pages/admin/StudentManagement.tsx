import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { Student, Guardian } from '../../types';
import { useToast } from '../../context/ToastContext';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  UploadCloud, 
  Download, 
  QrCode, 
  Edit, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  Printer,
  Mail,
  UserCheck,
  Trash2,
  KeyRound,
  Copy,
  Check,
  Lock,
  X
} from 'lucide-react';
import { generateInitialPassword, hashPassword } from '../../utils/security';

interface StudentManagementProps {
  onOpenRegister: () => void;
  onOpenCsvImport: () => void;
  onSelectStudentForCard: (student: Student) => void;
  onSelectStudentForEdit: (student: Student) => void;
  onSelectStudentForRegenerate: (student: Student) => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  onOpenRegister,
  onOpenCsvImport,
  onSelectStudentForCard,
  onSelectStudentForEdit,
  onSelectStudentForRegenerate
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [guardiansMap, setGuardiansMap] = useState<Record<string, Guardian>>({});
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    // 1. Listen to students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
      setLoading(false);
    });

    // 2. Fetch guardians
    const loadGuardians = async () => {
      try {
        const snap = await getDocs(collection(db, 'guardians'));
        const map: Record<string, Guardian> = {};
        snap.docs.forEach(d => {
          map[d.id] = d.data() as Guardian;
        });
        setGuardiansMap(map);
      } catch (e) {
        console.warn('Error loading guardians map:', e);
      }
    };
    loadGuardians();

    return () => unsubStudents();
  }, []);

  const { showToast } = useToast();

  // Toggle student status (Active / Inactive)
  const toggleStudentStatus = async (student: Student) => {
    const nextStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const docId = student.id || `std_${student.studentId}`;
      await setDoc(doc(db, 'students', docId), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast('success', 'Status Updated', `${student.firstName} ${student.lastName} marked as ${nextStatus}.`);
    } catch (err: any) {
      showToast('error', 'Status Update Failed', err.message);
    }
  };

  // Permanently delete student from Firebase
  const handleDeleteStudent = async (student: Student) => {
    const studentFullName = `${student.firstName} ${student.lastName}`;
    try {
      const docId = student.id || `std_${student.studentId}`;
      await deleteDoc(doc(db, 'students', docId));
      if (student.id && student.id !== `std_${student.studentId}`) {
        await deleteDoc(doc(db, 'students', `std_${student.studentId}`)).catch(() => {});
      }
      await deleteDoc(doc(db, 'students', student.studentId)).catch(() => {});

      // Add audit log
      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          action: 'DELETE_STUDENT',
          targetId: student.studentId,
          targetName: studentFullName,
          timestamp: new Date().toISOString()
        });
      } catch {}
      showToast('success', 'Student Record Deleted', `Removed ${studentFullName} from campus registry.`);
    } catch (err: any) {
      showToast('error', 'Deletion Failed', err.message);
    }
  };

  // Student password reset modal state
  const [resetTargetStudent, setResetTargetStudent] = useState<Student | null>(null);
  const [tempNewPassword, setTempNewPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const handleExecutePasswordReset = async () => {
    if (!resetTargetStudent) return;
    setResetting(true);
    try {
      const generated = generateInitialPassword();
      const hash = await hashPassword(generated);
      const docId = resetTargetStudent.id || `std_${resetTargetStudent.studentId}`;

      await setDoc(doc(db, 'students', docId), {
        portalPassword: generated,
        portalPasswordHash: hash,
        passwordResetRequired: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Log audit
      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          action: 'RESET_STUDENT_PASSWORD',
          targetId: resetTargetStudent.studentId,
          targetName: `${resetTargetStudent.firstName} ${resetTargetStudent.lastName}`,
          timestamp: new Date().toISOString()
        });
      } catch {}

      setTempNewPassword(generated);
      showToast('success', 'Password Reset Complete', `New temporary password generated for ${resetTargetStudent.firstName}.`);
    } catch (err: any) {
      showToast('error', 'Password Reset Failed', err.message);
    } finally {
      setResetting(false);
    }
  };

  // Distinct grades for filter
  const uniqueGrades = Array.from(new Set(students.map(s => s.gradeLevel).filter(Boolean)));

  // Filtered students
  const filteredStudents = students.filter(s => {
    const sName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
    const matchesSearch =
      sName.includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.section.toLowerCase().includes(search.toLowerCase());

    const matchesGrade = selectedGrade === 'ALL' || s.gradeLevel === selectedGrade;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesGrade && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export students to CSV
  const handleExportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Student ID', 'First Name', 'Middle Name', 'Last Name', 'Grade Level', 'Section', 'Status', 'Guardian Emails', 'Created At'];
    const rows = students.map(s => {
      const gEmails = (s.guardianIds || [])
        .map(id => guardiansMap[id]?.email)
        .filter(Boolean)
        .join('; ');

      return [
        `"${s.studentId}"`,
        `"${s.firstName}"`,
        `"${s.middleName || ''}"`,
        `"${s.lastName}"`,
        `"${s.gradeLevel}"`,
        `"${s.section}"`,
        `"${s.status}"`,
        `"${gEmails}"`,
        `"${s.createdAt || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Students_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Student Roster &amp; QR Credentials</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Manage student enrollment, cryptographic QR badges, and registered parent alert contacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onOpenCsvImport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={onOpenRegister}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-xs shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Register Student</span>
            </button>
          </div>
        </div>

        {/* Filters and search row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, ID, or section..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Grade filter */}
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Grades</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Authorized)</option>
              <option value="INACTIVE">Inactive (Suspended)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading student records...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>No students match your search and filter criteria.</p>
            <button
              onClick={onOpenRegister}
              className="inline-flex items-center gap-1.5 text-blue-600 font-bold hover:underline"
            >
              <Plus className="w-4 h-4" />
              Register new student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Student ID</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Grade &amp; Section</th>
                  <th className="p-3">Parent Notification Email</th>
                  <th className="p-3">QR Status</th>
                  <th className="p-3">Enrollment</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((std) => {
                  const guardianEmails = Array.from(new Set([
                    ...(std.guardianIds || []).map(id => guardiansMap[id]?.email),
                    std.guardianEmail,
                    std.parentEmail
                  ].filter(Boolean)));

                  return (
                    <tr key={std.studentId} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="p-3 pl-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {std.studentId}
                      </td>

                      {/* Name */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {std.firstName} {std.middleName ? std.middleName + ' ' : ''}{std.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Registered: {std.createdAt ? new Date(std.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Grade & Section */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{std.gradeLevel}</span>
                        <span className="text-slate-400 mx-1">&bull;</span>
                        <span className="text-slate-600">{std.section}</span>
                      </td>

                      {/* Parent Email */}
                      <td className="p-3">
                        {guardianEmails.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {guardianEmails.map((email, i) => (
                              <span key={i} className="text-slate-700 font-mono text-[11px] flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {email}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No email assigned</span>
                        )}
                      </td>

                      {/* QR Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <QrCode className="w-3 h-3" />
                          Hashed &amp; Active
                        </span>
                      </td>

                      {/* Enrollment Status */}
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleStudentStatus(std)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-transform active:scale-95 ${
                            std.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {std.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {std.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print ID Card Button */}
                          <button
                            onClick={() => onSelectStudentForCard(std)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Print Student ID Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => onSelectStudentForEdit(std)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Student & Guardian"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Regenerate / Revoke QR */}
                          <button
                            onClick={() => onSelectStudentForRegenerate(std)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Revoke &amp; Regenerate QR Code"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* Reset Student Portal Password */}
                          <button
                            onClick={() => {
                              setResetTargetStudent(std);
                              setTempNewPassword(null);
                              setCopiedReset(false);
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Reset Student Portal Credentials"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Delete Student */}
                          <button
                            onClick={() => handleDeleteStudent(std)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Permanently Delete Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Reset Student Password Modal */}
      {resetTargetStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <KeyRound className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Reset Student Portal Credentials</h3>
                  <p className="text-[11px] text-slate-500">Generate a new temporary access password</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Student</span>
                <div className="text-sm font-extrabold text-slate-900">
                  {resetTargetStudent.firstName} {resetTargetStudent.lastName}
                </div>
                <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                  Student ID: {resetTargetStudent.studentId}
                </div>
                <div className="text-[11px] text-slate-500">
                  {resetTargetStudent.gradeLevel} &bull; {resetTargetStudent.section}
                </div>
              </div>

              {!tempNewPassword ? (
                <div className="space-y-3">
                  <p className="text-slate-600 text-xs leading-relaxed">
                    This will invalidate the student's existing portal password and generate a fresh, secure temporary password hashed with SHA-256 in the database.
                  </p>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>The student will be prompted to change their password upon their next login.</span>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setResetTargetStudent(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecutePasswordReset}
                      disabled={resetting}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-2 shadow-sm"
                    >
                      {resetting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating &amp; Hashing...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Generate New Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Password Reset Successfully!</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      Copy and deliver these updated credentials directly to the student or guardian:
                    </p>

                    <div className="bg-white p-3 rounded-xl border border-emerald-300 font-mono text-xs space-y-1">
                      <div>
                        <span className="text-slate-400">Student ID: </span>
                        <strong className="text-blue-700">{resetTargetStudent.studentId}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Temporary Password: </span>
                        <strong className="text-slate-900 bg-amber-100 px-1.5 py-0.5 rounded text-xs select-all">
                          {tempNewPassword}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const payload = `Madapdap Resettlement SHS - Student Portal Access\nStudent Name: ${resetTargetStudent.firstName} ${resetTargetStudent.lastName}\nStudent ID: ${resetTargetStudent.studentId}\nTemporary Password: ${tempNewPassword}`;
                        navigator.clipboard.writeText(payload);
                        setCopiedReset(true);
                        setTimeout(() => setCopiedReset(false), 2000);
                      }}
                      className="px-4 py-2 text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedReset ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Credentials</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetTargetStudent(null)}
                      className="px-4 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
