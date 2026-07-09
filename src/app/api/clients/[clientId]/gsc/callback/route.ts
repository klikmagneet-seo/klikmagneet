import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Geen autorisatiecode ontvangen.' }, { status: 400 });
  }

  if (state && state !== clientId) {
    return NextResponse.json({ error: 'Ongeldige state parameter.' }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth is niet geconfigureerd.' },
      { status: 500 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/${clientId}/gsc/callback`;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get the list of sites from Search Console
  const webmasters = google.webmasters({ version: 'v3', auth: oauth2Client });
  const sitesResponse = await webmasters.sites.list();
  const sites = sitesResponse.data.siteEntry ?? [];
  const siteUrl = sites.length > 0 ? (sites[0].siteUrl ?? '') : '';

  const tokenExpiry = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await prisma.searchConsoleConnection.upsert({
    where: { clientId },
    create: {
      clientId,
      siteUrl,
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? '',
      tokenExpiry,
    },
    update: {
      siteUrl,
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? '',
      tokenExpiry,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.redirect(`${appUrl}/dashboard?gsc=connected`);
}
