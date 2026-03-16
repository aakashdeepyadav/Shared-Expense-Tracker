# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

---

## Onboarding-First Flow (New)

This project now supports a guided setup wizard for creating an expense tracker instance.

### What the wizard captures

1. Group name and group image.
2. Number of members and member profile type (e.g. student).
3. Per-member details (name, PIN, phone, avatar).
4. Admin selection from members and admin password.
5. Firebase project config JSON upload/paste (stored as project metadata).
6. Theme preference and model API key for report generation.

### Runtime flow

1. If setup is not complete, users are sent to `/setup`.
2. Once setup is complete, users can:
   - Login as member with PIN + OTP.
   - Login as admin with admin password.
   - Signup as new member from the login page.
3. Admin has management access. Members have read/report oriented flow.

### Local run

```bash
npm install
npm run typecheck
npm run dev
```

Open `http://localhost:9002`.

If this is a fresh project, run setup at `http://localhost:9002/setup`.

---

## Firebase-Only Data Flow

This app is configured for Firebase + Vercel.

1. Setup captures group details and Firebase web config.
2. Live month data stays in Firestore collections: `expenses`, `contributions`, and `messages`.
3. `Start New Month` creates a Firestore archive document in `monthArchives` and clears only the live month collections.
4. History pages can switch between current month and archived months.

Google Sheets sync is disabled in this mode.
