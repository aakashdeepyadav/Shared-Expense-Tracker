
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error: 'Google Sheets sync is disabled in Firebase-only mode.',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: 'Google Sheets sync endpoint is disabled in Firebase-only mode.',
    },
    { status: 410 }
  );
}
