# QR Student Attendance & Parent Notification System

Enterprise-grade school management system utilizing unique cryptographic QR codes to record student entry and exit at campus gates, automatically calculating daily attendance statuses (PRESENT, LATE, ABSENT), and dispatching instant email alerts to registered parents or guardians via Resend.

---

## 1. System Architecture & Features

### Core Modules
- **Cryptographic QR Code Credential Generation**:
  - Automatically generates 192-bit opaque tokens (`crypto.randomBytes(24)`).
  - Only the SHA-256 token hash is stored in Firestore (`qrTokenHash`).
  - Student personal information (PII) is **never** embedded in the QR image.
  - Printable student ID card with school branding, student details, and high-resolution QR code.
  - Instant key rotation / regeneration if a card is lost or stolen.
- **Mobile-Optimized Guard Scanner**:
  - Live browser camera scanner powered by `html5-qrcode`.
  - Manual toggle between **ENTRY** (Green) and **EXIT** (Blue) modes.
  - Camera device selector (front, back/environment lens, external USB scanner).
  - Web Audio API synthesized audible chimes for instant auditory feedback without looking at the screen.
  - Confetti burst celebration on successful student check-in.
  - Anti-duplicate scan protection (rejects scans within 60 seconds).
  - Manual token entry fallback for creased or damaged cards.
- **Automated Parent Email Notifications (Resend API)**:
  - Exact transactional email templates for student entry and exit.
  - Sent exclusively to registered guardians linked to the specific student.
  - Full audit logging in Firestore (`email_logs`) with delivery statuses (`SENT`, `FAILED`, `PENDING`), provider message IDs, and error traces.
  - One-click retry mechanism for failed deliveries.
  - Attendance recording is non-blocking and resilient to temporary email service outages.
- **Comprehensive Administrative Dashboard**:
  - 8 real-time KPI metrics: Total Enrolled, Present Today, Late Today, Absent Today, Inside Campus, Entry Scans, Exit Scans, Failed Alerts.
  - Live gate activity stream with real-time Firestore listeners.
  - Daily attendance percentage widget.
  - Student management with search, grade filters, section filters, and CSV roster export.
  - CSV bulk student import with column validation and duplicate ID rejection.
  - Daily attendance ledger with authorized admin status overrides (requires mandatory reason, logged to immutable `audit_logs`).
  - Attendance analytics & hourly rush hour distribution charts.
  - Role-based access control (Admin vs. Guard).
  - Configurable school timetables (opening time, late cutoff, closing time, school days, and timezones e.g. `Asia/Manila`).

---

## 2. Firebase Configuration & Security Rules

### Firestore Collections
1. `students`: Enrolled student profiles, section, grade, status, `qrTokenHash`, and `guardianIds`.
2. `guardians`: Registered parents/guardians, email addresses, and notification preference flags.
3. `users`: System users with assigned roles (`ADMIN` or `GUARD`).
4. `attendance`: Daily aggregated attendance records (`${studentId}_${date}`) with first entry time, departure time, and total counts.
5. `attendance_events`: Raw gate scans with exact server timestamps, guard UIDs, and idempotency keys.
6. `email_logs`: Audit trail for dispatched parent notification emails.
7. `school_settings`: School timetable, late cutoff thresholds, and operational days.
8. `audit_logs`: Immutable security audit log for admin corrections and credential rotations.

### Security Rules
The system deploys strict Firestore ABAC security rules (`firestore.rules`):
- Non-authenticated requests are denied by default (`match /{document=**} { allow read, write: if false; }`).
- Guards have read-only access to verify student IDs at the gate and create gate scan events.
- Administrative functions (student registration, parent email updates, attendance corrections, and user management) require verified `ADMIN` role.
- Bootstrapped Administrator: `alvindelacruz917@gmail.com`.

---

## 3. Environment Variables & Resend Configuration

Create or update your `.env` file (see `.env.example`):

```bash
# Application Port & URL
PORT=3000
APP_URL="https://your-domain.com"

# Resend API Key for parent email alerts
# Get your API key from https://resend.com/api-keys
RESEND_API_KEY="re_your_api_key_here"
```

*Note:* If `RESEND_API_KEY` is not provided or left as placeholder, the system runs in safe simulation mode, logging dispatched parent emails cleanly to `email_logs` without breaking attendance scans.

---

## 4. Local Development & Testing

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the full-stack application (Express + Vite):**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Login as Admin:**
   - Sign in with Google using your administrator account (`alvindelacruz917@gmail.com`).
   - Or register a new staff account.

4. **Login as Guard:**
   - Click the green **"Instant Gate Guard Access (One-Click)"** button on the login screen to test gate scanning immediately.

5. **Register a Student:**
   - Go to **Students** &rarr; **Register Student**.
   - Enter student details and parent email address.
   - Click **Register & Generate QR**.
   - Download the QR code or click **Print ID Card**.

6. **Scan at the Gate:**
   - Open **Gate Scanner** on desktop or smartphone.
   - Choose **ENTRY** mode.
   - Present the student QR code to the camera (or use the Manual Token Entry input).
   - Verify green confirmation banner, chime sound, confetti, and parent alert dispatch.

---

## 5. Deployment Guide

### Deploying to Vercel
1. Push this repository to GitHub or upload to Vercel.
2. In Vercel Project Settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Environment Variables in Vercel:
   - `VITE_API_URL` (optional, leave blank for client-side Firestore mode)
   - `RESEND_API_KEY` (optional, for live email deliveries)
4. The application includes `vercel.json` with SPA routing and client-side Firestore attendance processing (`src/services/scanService.ts`), so the QR scanner, parent alert logging, and role restrictions work 100% directly on Vercel without requiring a standalone server.

### Administrative Access Control
- Tanging si **`alvindelacruz917@gmail.com`** lamang ang may `ADMIN` permissions.
- Lahat ng ibang user na mag-sign in gamit ang Google o mag-rehistro ng account ay awtomatikong magiging `GUARD` at makakakita lamang ng Gate Scanner at Scan History.
