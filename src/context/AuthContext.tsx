import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, SERVICE_READER_EMAIL, ensureFirestoreAuth } from '../lib/firebase';
import { UserProfile, UserRole, Student } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isGuard: boolean;
  isStudent: boolean;
  linkedStudent: Student | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName: string, requestedRole: UserRole) => Promise<void>;
  loginAsDemoGuard: () => void;
  loginAsStudentQr: (student: Student) => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isAllowedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'alvindelacruz917@gmail.com' ||
    normalized === 'alvindelacruz917' ||
    normalized.startsWith('alvindelacruz917@') ||
    normalized === 'alvin.outsourced@gmail.com' ||
    normalized === 'alvin.outsourced' ||
    normalized.startsWith('alvin.outsourced@')
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [studentPortalUser, setStudentPortalUser] = useState<{ student: Student; profile: UserProfile } | null>(() => {
    try {
      const saved = localStorage.getItem('student_portal_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('student_portal_user');
      return saved ? JSON.parse(saved).profile : null;
    } catch {
      return null;
    }
  });
  const [linkedStudent, setLinkedStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem('student_portal_user');
      return saved ? JSON.parse(saved).student : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [demoGuard, setDemoGuard] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('demo_guard_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Fetch or create user profile in Firestore and automatically detect if the account is a Student
  const syncUserProfile = async (firebaseUser: User) => {
    try {
      const normEmail = (firebaseUser.email || '').trim().toLowerCase();
      const isAdminUser = isAllowedAdmin(normEmail);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;
      const isReassignedAdmin = existingData?.role === 'ADMIN';

      // Check if this email belongs to a registered student
      let studentRecord: Student | null = null;
      if (!isAdminUser && !isReassignedAdmin && normEmail) {
        try {
          const studentQuery = query(collection(db, 'students'), where('email', '==', normEmail));
          let studentSnap = await getDocs(studentQuery);
          if (studentSnap.empty) {
            const studentQuery2 = query(collection(db, 'students'), where('studentEmail', '==', normEmail));
            studentSnap = await getDocs(studentQuery2);
          }
          if (!studentSnap.empty) {
            studentRecord = { ...studentSnap.docs[0].data(), id: studentSnap.docs[0].id } as Student;
          }
        } catch (e) {
          console.warn('Student email lookup warning:', e);
        }
      }

      setLinkedStudent(studentRecord);

      // Determine role:
      // 1. isAllowedAdmin OR assigned ADMIN in Firestore -> ADMIN
      // 2. registered student email -> STUDENT
      // 3. existing role in DB (if any) or GUARD
      const correctRole: UserRole = (isAdminUser || isReassignedAdmin)
        ? 'ADMIN' 
        : (studentRecord ? 'STUDENT' : (existingData?.role || 'GUARD'));

      const studentName = studentRecord 
        ? `${studentRecord.firstName} ${studentRecord.lastName}`
        : null;

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        
        const updated: UserProfile = { 
          ...data, 
          role: correctRole,
          fullName: studentName || data.fullName || firebaseUser.displayName || 'User',
          studentId: studentRecord?.studentId || data.studentId
        };
        await setDoc(userRef, updated, { merge: true });
        setUserProfile(updated);
      } else {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: studentName || firebaseUser.displayName || normEmail.split('@')[0] || 'User',
          email: normEmail,
          role: correctRole,
          status: 'ACTIVE',
          studentId: studentRecord?.studentId,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.warn('Failed to sync user profile with Firestore, using in-memory fallback:', err);
      const normEmail = (firebaseUser.email || '').trim().toLowerCase();
      const isAdminUser = isAllowedAdmin(normEmail);
      setUserProfile({
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || normEmail.split('@')[0] || 'Staff User',
        email: normEmail,
        role: isAdminUser ? 'ADMIN' : 'GUARD',
        status: 'ACTIVE'
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const isServiceReader = currentUser?.email?.trim().toLowerCase() === SERVICE_READER_EMAIL;

      if (currentUser && !isServiceReader) {
        setUser(currentUser);
        setDemoGuard(null);
        setStudentPortalUser(null);
        localStorage.removeItem('demo_guard_user');
        localStorage.removeItem('student_portal_user');
        await syncUserProfile(currentUser);
      } else {
        setUser(null);
        if (!currentUser) {
          // Establish silent Firestore transport session so Student Portal & Login queries work
          void ensureFirestoreAuth();
        }

        // Preserve Student Portal session or Demo Guard session
        const savedStudentStr = localStorage.getItem('student_portal_user');
        if (savedStudentStr) {
          try {
            const parsed = JSON.parse(savedStudentStr);
            if (parsed?.profile && parsed?.student) {
              setStudentPortalUser(parsed);
              setUserProfile(parsed.profile);
              setLinkedStudent(parsed.student);
              setLoading(false);
              return;
            }
          } catch {}
        }

        const savedGuardStr = localStorage.getItem('demo_guard_user');
        if (savedGuardStr) {
          try {
            const parsedGuard = JSON.parse(savedGuardStr);
            if (parsedGuard?.uid) {
              setDemoGuard(parsedGuard);
              setUserProfile(parsedGuard);
              setLoading(false);
              return;
            }
          } catch {}
        }

        setUserProfile(null);
        setLinkedStudent(null);
        setStudentPortalUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogleHandler = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmailHandler = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Email sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmailHandler = async (
    email: string, 
    pass: string, 
    fullName: string, 
    _requestedRole: UserRole
  ) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (fullName) {
        await updateProfile(res.user, { displayName: fullName });
      }
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Sign-up failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoGuard = () => {
    void ensureFirestoreAuth();
    const demoProfile: UserProfile = {
      uid: 'guard_demo_session_01',
      fullName: 'Gate Guard Officer',
      email: 'guard@marhs.edu.ph',
      role: 'GUARD',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    setDemoGuard(demoProfile);
    setUserProfile(demoProfile);
    localStorage.setItem('demo_guard_user', JSON.stringify(demoProfile));
  };

  const loginAsStudentQr = (student: Student) => {
    void ensureFirestoreAuth();
    const studentProfile: UserProfile = {
      uid: `student_${student.studentId}`,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email || student.studentEmail || `${student.studentId}@student.marhs.edu.ph`,
      role: 'STUDENT',
      studentId: student.studentId,
      status: student.status,
      createdAt: new Date().toISOString()
    };
    setLinkedStudent(student);
    setUserProfile(studentProfile);
    setStudentPortalUser({ student, profile: studentProfile });
    localStorage.setItem('student_portal_user', JSON.stringify({ student, profile: studentProfile }));
  };

  const signOutUserHandler = async () => {
    setLoading(true);
    try {
      setDemoGuard(null);
      setLinkedStudent(null);
      setStudentPortalUser(null);
      localStorage.removeItem('demo_guard_user');
      localStorage.removeItem('student_portal_user');
      setUser(null);
      setUserProfile(null);

      if (auth.currentUser && auth.currentUser.email?.trim().toLowerCase() !== SERVICE_READER_EMAIL) {
        await signOut(auth);
      }
      await ensureFirestoreAuth();
    } finally {
      setLoading(false);
    }
  };

  const activeEmail = (userProfile?.email || user?.email || (demoGuard ? demoGuard.email : '')).trim().toLowerCase();
  const isAdmin = !studentPortalUser && (isAllowedAdmin(activeEmail) || userProfile?.role === 'ADMIN');
  const isStudent = !!studentPortalUser || (!isAdmin && (userProfile?.role === 'STUDENT' || !!linkedStudent));
  const isGuard = !isAdmin && !isStudent;
  const currentRole: UserRole = isAdmin ? 'ADMIN' : (isStudent ? 'STUDENT' : 'GUARD');

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: userProfile || demoGuard,
        role: currentRole,
        loading,
        isAdmin,
        isGuard,
        isStudent,
        linkedStudent,
        signInWithGoogle: signInWithGoogleHandler,
        signInWithEmail: signInWithEmailHandler,
        signUpWithEmail: signUpWithEmailHandler,
        loginAsDemoGuard,
        loginAsStudentQr,
        signOutUser: signOutUserHandler
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
