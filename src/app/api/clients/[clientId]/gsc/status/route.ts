import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (!configured) {
    return NextResponse.json({ connected: false, siteUrl: null, lastSync: null, notConfigured: true });
  }

  try {
    const connection = await prisma.searchConsoleConnection.findUnique({
      where: { clientId },
    });

    if (!connection) {
      return NextResponse.json({ connected: false, siteUrl: null, lastSync: null });
    }

    const lastEntry = await prisma.searchPerformance.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      connected: true,
      siteUrl: connection.siteUrl,
      lastSync: lastEntry ? lastEntry.createdAt.toISOString() : null,
    });
  } catch {
    return NextResponse.json({ connected: false, siteUrl: null, lastSync: null });
  }
}
