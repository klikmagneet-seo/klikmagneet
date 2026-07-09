import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  const connection = await prisma.searchConsoleConnection.findUnique({
    where: { clientId },
  });

  if (!connection) {
    return NextResponse.json({ error: 'Geen Search Console koppeling gevonden.' }, { status: 404 });
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

  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.tokenExpiry.getTime(),
  });

  // Auto-refresh token and persist new tokens
  oauth2Client.on('tokens', async (tokens) => {
    const updateData: Record<string, string | Date> = {};
    if (tokens.access_token) updateData.accessToken = tokens.access_token;
    if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date) updateData.tokenExpiry = new Date(tokens.expiry_date);

    if (Object.keys(updateData).length > 0) {
      await prisma.searchConsoleConnection.update({
        where: { clientId },
        data: updateData,
      });
    }
  });

  // Date range: last 30 days (GSC has ~2 day delay so end = yesterday)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 31);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  const webmasters = google.webmasters({ version: 'v3', auth: oauth2Client });

  // Request page+query combined data
  const combinedResponse = await webmasters.searchanalytics.query({
    siteUrl: connection.siteUrl,
    requestBody: {
      startDate: startDateStr,
      endDate: endDateStr,
      dimensions: ['page', 'query'],
      rowLimit: 1000,
    },
  });

  const rows = combinedResponse.data.rows ?? [];

  // Delete existing data for this client in the date range
  await prisma.searchPerformance.deleteMany({
    where: {
      clientId,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
  });

  // Insert new rows
  const newRecords = rows.map((row) => {
    const keys = row.keys ?? [];
    return {
      clientId,
      date: endDateStr, // use end date as the period representative
      pageUrl: keys[0] ?? '',
      query: keys[1] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    };
  });

  if (newRecords.length > 0) {
    await prisma.searchPerformance.createMany({ data: newRecords });
  }

  return NextResponse.json({ success: true, rowsImported: newRecords.length });
}
