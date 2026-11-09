import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../../types';
import { useAuth, isAllowedAdmin } from '../../context/AuthContext';
import { 
  Shield, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  KeyRound, 
  Mail 
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

export const UserManagement: React.FC = () => {
  const { userProfile: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New user form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('GUARD');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error reading users:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      if (!cleanEmail || !cleanName) {
        throw new Error('Please fill in all user account fields.');
      }

      const assignedRole: UserRole = role;

      // Unique UID
      const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newProfile: UserProfile = {
        uid,
        fullName: cleanName,
        email: cleanEmail,
        role: assignedRole,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), newProfile);

      setIsCreateOpen(false);
      setFullName('');
      setEmail('');
      setRole('GUARD');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user account');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) {
      showToast('warning', 'Action Restricted', 'You cannot modify your own administrative role.');
      return;
    }

    const nextRole: UserRole = targetUser.role === 'ADMIN' ? 'GUARD' : 'ADMIN';

    try {
      await setDoc(doc(db, 'users', targetUser.uid), {
        role: nextRole
      }, { merge: true });
      showToast('success', 'Role Updated', `Changed ${targetUser.fullName}'s role to ${nextRole}.`);
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) {
      showToast('warning', 'Action Restricted', 'You cannot deactivate your own account.');
      return;
    }

    const nextStatus = targetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await setDoc(doc(db, 'users', targetUser.uid), {
        status: nextStatus
      }, { merge: true });
      showToast('success', 'Account Status Changed', `${targetUser.fullName} set to ${nextStatus}.`);
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const filtered = users.filter(u => {
    const term = search.toLowerCase();
    return u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>Staff Roles &amp; Guard Access Control</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Manage authorized gate guards, security shift officers, and system administrators.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading accounts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No staff accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Staff Member</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">System Role</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const isSelf = u.uid === currentUser?.uid;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{u.fullName}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded font-bold">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {u.email}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {u.role === 'ADMIN' ? 'ADMINISTRATOR' : 'SECURITY GUARD'}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.status}
                        </span>
                      </td>

                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        {!isSelf && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleRole(u)}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Switch to {u.role === 'ADMIN' ? 'Guard' : 'Admin'}
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`text-[11px] font-semibold ${
                                u.status === 'ACTIVE' ? 'text-rose-600 hover:underline' : 'text-emerald-600 hover:underline'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Staff Account"
        description="Add a new security guard or administrator to the school attendance portal"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Officer Marcus Reyes"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. guard.reyes@school.edu"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Assigned Role <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-xs font-semibold flex items-center justify-between transition-all ${
                  role === 'GUARD'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold">Security Guard</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Scanner &amp; Gate access only
                  </div>
                </div>
                <input
                  type="radio"
                  name="role"
                  checked={role === 'GUARD'}
                  onChange={() => setRole('GUARD')}
                  className="text-blue-600"
                />
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-xs font-semibold flex items-center justify-between transition-all ${
                  role === 'ADMIN'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold">Administrator</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Full system &amp; student access
                  </div>
                </div>
                <input
                  type="radio"
                  name="role"
                  checked={role === 'ADMIN'}
                  onChange={() => setRole('ADMIN')}
                  className="text-blue-600"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xs shadow-blue-500/20 disabled:opacity-50"
            >
              {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
