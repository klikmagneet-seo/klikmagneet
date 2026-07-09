import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleAuth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth is niet geconfigureerd. Stel GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in.' },
      { status: 500 }
    );
  }

  const { clientId } = await params;
  const authUrl = getAuthUrl(clientId);
  return NextResponse.redirect(authUrl);
}
