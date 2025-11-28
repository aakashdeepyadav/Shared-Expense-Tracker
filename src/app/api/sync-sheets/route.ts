
// src/app/api/sync-sheets/route.ts
import { NextResponse } from 'next/server';
import { archiveDataToSheet } from '@/lib/sheets';
import { headers } from 'next/headers';
import { loadEnv } from '@/lib/env-loader';


/**
 * API route to sync Firestore data to Google Sheets.
 * This is intended to be called by a trusted service like Cloud Scheduler.
 *
 * It can be secured in two ways:
 * 1. (Recommended) If using Cloud Scheduler with OIDC authentication, the request will
 *    contain a Google-signed identity token in the Authorization header. You would
 *    typically use the `google-auth-library` to verify this token.
 * 2. (Simpler) A shared secret passed in the Authorization header.
 *
 * This example uses the simple shared secret method.
 */
export async function POST(request: Request) {
  const env = loadEnv();
  const SYNC_SECRET = env.SYNC_SECRET;
  
  const authorization = headers().get('Authorization');
  const secret = authorization?.split('Bearer ')[1];

  if (!SYNC_SECRET || secret !== SYNC_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // We pass `false` to indicate this is a sync, not a "start new month" reset.
    // The `archiveDataToSheet` function will handle this.
    await archiveDataToSheet(false);
    return NextResponse.json({ success: true, message: 'Data synced to Google Sheets successfully.' });
  } catch (error: any) {
    console.error('Error during scheduled sync:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unknown error occurred during sync.' }, { status: 500 });
  }
}

// Add a GET handler to check if the route is set up, for easier debugging.
export async function GET() {
    return NextResponse.json({ message: "Sync endpoint is active. Use POST with valid authentication to trigger a sync." });
}
