# Shared Expense Tracker

Shared Expense Tracker is a group finance application built with Next.js and Firebase.
It helps a household, team, or travel group track contributions, expenses, chat, reports, and monthly rollovers in one place.

## Android APK Download

- Latest APK (v1.1.1): https://github.com/aakashdeepyadav/Shared-Expense-Tracker/releases/download/v1.1.1/android_app.apk

## Highlights

- Group-based setup flow with unique group ID.
- Admin and member login flows (shared member PIN model, admin password model).
- Dashboard for balances, recent activity, and contribution trends.
- Expense and contribution history with archive support.
- Admin can edit/delete current-month expenses and contributions.
- Chat with read-state tracking.
- Professional report generation with print/PDF support.
- Monthly rollover that archives current month data and starts a new live period.
- Group logo/picture can be updated later from Settings.
- Mobile-first responsive layout and overflow-safe dashboard rendering.

## Recent Updates (2026-03)

- Added admin edit/delete controls for current-month records:
  - Expense History: edit/delete
  - Contribution History: edit/delete
- Fixed Add Expense date picker interaction so date selection works reliably.
- Added extra predefined expense tags:
  - fruits, milk, eggs, store
- Added Settings flow to update/clear group picture URL.
- Improved mobile dashboard/header responsiveness to prevent horizontal overflow.
- Enforced latest-first ordering in history pages by date and time:
  - Expense History (latest on top)
  - Contribution History (latest on top)
- Fixed theme switcher icon behavior:
  - Light mode shows moon (switch to dark)
  - Dark mode shows sun (switch to light)
- Refined dashboard cards on phone for better alignment:
  - Member Contributions graph centered and resized
  - Recent Expenses centered with compact mobile card sizing
  - Recent Contributions centered with compact mobile card sizing
- Standardized Add Expense date input to native picker on all devices for reliable laptop and mobile selection.

## Financial Logic Rules

These rules are now applied consistently in dashboard cards, reports, and AI report flow.

1. Member Contribution

- Member contribution = direct wallet contributions + personally paid expenses.

2. Wallet Balance

- Wallet balance = total contributions - wallet-paid expenses.
- Member-paid expenses do not reduce wallet balance.
- Wallet balance may be negative.

3. Expense Share Per Expense

- For each expense, share = expense amount / number of participants in that expense.
- If all members participate, split across all.
- If fewer members participate, split only across participants.

4. Expense per Member (average)

- Computed from accumulated participant shares across all expenses,
  then averaged over total members in the group.

5. Edit Consistency

- When an expense amount is edited, participant shares are recomputed to keep splits consistent.

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS + Radix UI components
- Firebase Firestore + Firebase Auth

## Project Architecture

This project uses a single app-owned Firebase project.

- No runtime BYO Firebase onboarding.
- Setup-first lifecycle:
  1. Create/select group.
  2. Initialize app config and admin config.
  3. Create members and start operations.
- Group-scoped data model under `groups/{groupId}`.

## Project Structure

Top-level folders and purpose:

- `src/app` - routes, page-level UI, app layout
- `src/components` - reusable UI and feature components
- `src/context` - auth/session context and app state providers
- `src/hooks` - custom React hooks
- `src/lib` - Firebase integration, Firestore access layer, shared utilities
- `src/ai` - Genkit/AI-related flows and development entry points

## Firestore Data Model

Each group stores data under the following collections/documents:

- `config/app`
- `config/admin`
- `users`
- `expenses`
- `contributions`
- `messages`
- `auditLogs`
- `monthArchives`

## Prerequisites

- Node.js 20+
- npm 10+
- Firebase project with Firestore enabled
- Firebase CLI (for rules deployment)

## Environment Variables

Copy `.env.example` to `.env.local` and populate values.

Required:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional:

- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `GOOGLE_API_KEY` (optional AI/reporting support)

## Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:9002
```

## Quality Checks

Lint:

```bash
npm run lint
```

Type check:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

## Firestore Rules and Indexes

This repo contains:

- `firestore.rules`
- `firestore.indexes.json`

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

Deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

Important: if local code works but production fails with `permission-denied`, verify that updated rules were deployed to the target Firebase project.

## Monthly Rollover

`Start New Month` in Settings performs the following:

1. Verifies admin password.
2. Archives live `expenses`, `contributions`, and `messages` into `monthArchives`.
3. Updates period metadata in `config/app`.
4. Clears live-month collections.
5. Prunes archives older than retention window (currently 365 days).

If rollover fails in production, deploy latest Firestore rules first.

## Deployment Notes

For Vercel (or similar), configure all required environment variables in project settings for Production and Preview environments.

Recommended pre-deploy checklist:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. Deploy Firestore rules and indexes

## Production Readiness Check (2026-03-18)

This repository was validated with the following checks:

- `npm run lint` -> passed
- `npm run typecheck` -> passed
- `npm run build` -> passed (all app routes generated)

Additional dependency security check:

- `npm audit --omit=dev` -> reported low/moderate issues in transitive dependencies (not build-blocking)

Recommended actions:

1. Run `npm audit fix` and retest (`lint`, `typecheck`, `build`).
2. Keep Next.js and Firebase ecosystem dependencies updated regularly.
3. Continue enforcing Firebase App Check + Firestore rules in production.

Operational notes:

- `Start New Month` requires deployed `firestore.rules` that allow archive/write + live collection cleanup.
- If production behavior differs from local, deploy rules/indexes first, then retest.

## Scripts

- `npm run dev` - start app locally on port 9002
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks

## License

Private project. Add a license section if distribution scope changes.
