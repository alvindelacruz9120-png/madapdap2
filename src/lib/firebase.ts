import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const SERVICE_READER_EMAIL = 'portal.reader@marhs.edu.ph';
const SERVICE_READER_PASS = 'MarhsPortalReader#2026';

let authInitPromise: Promise<void> | null = null;

/**
 * Ensures Firebase Auth has an active session so Firestore security rules
 * (request.auth != null) permit Student Portal logins, QR badge lookups, and attendance reads.
 */
export async function ensureFirestoreAuth(): Promise<void> {
  if (auth.currentUser) return;
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    try {
      await signInWithEmailAndPassword(auth, SERVICE_READER_EMAIL, SERVICE_READER_PASS);
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, SERVICE_READER_EMAIL, SERVICE_READER_PASS);
      } catch (err) {
        console.warn('Background Firestore transport auth warning:', err);
      }
    } finally {
      authInitPromise = null;
    }
  })();

  return authInitPromise;
}

// Validate connection per Firebase Skill requirements
async function testConnection() {
  try {
    await ensureFirestoreAuth();
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
