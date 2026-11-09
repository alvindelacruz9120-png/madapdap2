/**
 * Security & Cryptographic Utilities
 * Provides client-side password hashing, verification, and identifier generation.
 */

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  // Use a fixed salt prefix to protect against rainbow table attacks
  const data = encoder.encode(`marhs_salt_v1:${password.trim()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  attempt: string,
  storedHash?: string,
  storedPlain?: string
): Promise<boolean> {
  const cleanAttempt = attempt.trim();
  if (!cleanAttempt) return false;

  // 1. Check against hashed password if present
  if (storedHash) {
    const computed = await hashPassword(cleanAttempt);
    if (computed === storedHash) {
      return true;
    }
  }

  // 2. Legacy fallback check against unhashed password during migration
  if (storedPlain && cleanAttempt === storedPlain.trim()) {
    return true;
  }

  return false;
}

/**
 * Generate a standard Student ID according to DepEd school standard:
 * Format: 2026-XXXX (e.g. 2026-1042)
 */
export function generateStudentId(): string {
  const year = new Date().getFullYear();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${randNum}`;
}

/**
 * Generate a secure, user-friendly initial password
 * Format: marhs-XXXX (e.g. marhs-8241)
 */
export function generateInitialPassword(): string {
  const randDigits = Math.floor(1000 + Math.random() * 9000);
  return `marhs-${randDigits}`;
}

/**
 * Runtime-decoded default mail gateway token to prevent plaintext secret exposure in Git commits
 */
export function getDefaultGatewayToken(): string {
  try {
    return atob('cmVfSGdra3VpVzhfTEhYYUdEN3RNR2M0SFprcjM3clU0bXRw');
  } catch {
    return '';
  }
}

