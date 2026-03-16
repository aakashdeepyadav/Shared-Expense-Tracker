# Shared Expense Tracker

Single-project Firebase expense tracker built with Next.js.

## Architecture

- Firebase-only: one app-owned Firebase project (no BYO Firebase config flow).
- Setup-first onboarding: create group, members, and admin password once.
- Login modes:
  - Member: PIN + OTP flow.
  - Admin: admin password flow.
- Monthly rollover archives live data into `monthArchives` and now prunes archives older than 365 days.

## Local Development

```bash
npm install
npm run lint
npm run typecheck
npm run dev
```

App runs on `http://localhost:9002`.

## Production Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment Variables

Required for core app (Firebase Web SDK):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

Optional:

- `GOOGLE_API_KEY` for report-generation fallback.

Use `.env.example` as the template for local `.env.local`.

For Vercel deployment, add the same variables in Project Settings -> Environment Variables for Production (and Preview if needed).

## Firestore Data Model

- `config/app` and `config/admin`
- `users`
- `expenses`
- `contributions`
- `messages`
- `auditLogs`
- `monthArchives`

## Security Rules

Deploy Firestore rules from `firestore.rules` before production rollout and verify access paths for:

- Read/write on live collections used by current UI.
- Admin-only behavior for sensitive operations.
- Read access for month archive/history pages.
