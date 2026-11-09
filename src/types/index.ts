export type UserRole = 'ADMIN' | 'GUARD' | 'STUDENT';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  studentId?: string; // Linked student ID if role is STUDENT
  createdAt?: string;
}

export interface Student {
  id?: string; // Firestore doc ID
  studentId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string; // Student Google / Gmail address for portal login
  studentEmail?: string; // Alternative alias
  portalUsername?: string; // Student login username (default studentId)
  portalPassword?: string; // Legacy/transient initial password
  portalPasswordHash?: string; // Cryptographically hashed password for secure portal authentication
  passwordResetRequired?: boolean; // Flag if student must reset initial password
  gradeLevel: string;
  section: string;
  status: 'ACTIVE' | 'INACTIVE';
  qrTokenHash: string;
  guardianIds: string[];
  guardianName?: string;
  guardianEmail?: string;
  parentEmail?: string; // Alias for guardianEmail
  createdAt: string;
  updatedAt: string;
  // Hydrated or client fields
  rawQrToken?: string; // only temporarily available right after generation for printing
  guardians?: Guardian[];
}

export interface Guardian {
  guardianId: string;
  fullName: string;
  email: string;
  studentIds: string[];
  emailVerified?: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  studentName?: string;
  gradeLevel?: string;
  section?: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  firstEntryAt: string | null;
  lastExitAt: string | null;
  entryCount: number;
  exitCount: number;
  correctedBy?: string;
  correctionReason?: string;
  correctedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type EventType = 'ENTRY' | 'EXIT';

export interface AttendanceEvent {
  eventId: string;
  studentId: string;
  studentName?: string;
  eventType: EventType;
  timestamp: string;
  guardId: string;
  guardName?: string;
  date: string;
  status: 'PRESENT' | 'LATE' | 'N/A';
  idempotencyKey: string;
  createdAt: string;
}

export interface EmailLog {
  logId: string;
  eventId: string;
  studentId: string;
  recipient: string;
  guardianName?: string;
  eventType: EventType;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
  providerMessageId?: string | null;
  sentAt: string;
  errorMessage?: string | null;
  simulated?: boolean;
  retriedAt?: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolLogo?: string;
  address?: string;
  motto?: string;
  resendApiKey?: string;
  backupResendApiKeys?: string[];
  timezone: string;
  openingTime: string; // "07:30"
  lateCutoff: string;  // "08:00"
  closingTime: string; // "17:00"
  schoolDays: string[]; // ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}

export interface AuditLog {
  auditId?: string;
  actorId?: string;
  actorName?: string;
  action: string;
  targetId: string;
  targetName?: string;
  details?: string;
  timestamp: string;
}

export interface ScanResult {
  success: boolean;
  student: {
    studentId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    fullName: string;
    gradeLevel: string;
    section: string;
    status: 'ACTIVE' | 'INACTIVE';
  };
  attendance: {
    eventId: string;
    eventType: EventType;
    date: string;
    time: string;
    status: 'PRESENT' | 'LATE' | 'N/A';
  };
  notifications: {
    totalTargeted: number;
    dispatched: Array<{
      recipient: string;
      status: 'SENT' | 'FAILED' | 'PENDING';
      simulated?: boolean;
    }>;
  };
}
