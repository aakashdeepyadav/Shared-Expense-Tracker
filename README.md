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

- Required for core app: none (Firebase web config is currently in `src/lib/firebase.ts`).
- Optional for AI report generation fallback: `GOOGLE_API_KEY`.
  - Admin can also store a model key through setup/config and the server action uses it at runtime.

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
