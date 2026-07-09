import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  // Last 30 days date range
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 31);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  const rows = await prisma.searchPerformance.findMany({
    where: {
      clientId,
      date: {
        gte: startDateStr,
        lte: endDateStr,
      },
    },
  });

  // Top queries (aggregate by query)
  const queryMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>();
  for (const row of rows) {
    const existing = queryMap.get(row.query);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.ctr += row.ctr;
      existing.position += row.position;
      existing.count += 1;
    } else {
      queryMap.set(row.query, {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        count: 1,
      });
    }
  }

  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.ctr / data.count,
      position: data.position / data.count,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  // Top pages (aggregate by pageUrl)
  const pageMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>();
  for (const row of rows) {
    const existing = pageMap.get(row.pageUrl);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.ctr += row.ctr;
      existing.position += row.position;
      existing.count += 1;
    } else {
      pageMap.set(row.pageUrl, {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        count: 1,
      });
    }
  }

  const topPages = Array.from(pageMap.entries())
    .map(([pageUrl, data]) => ({
      pageUrl,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.ctr / data.count,
      position: data.position / data.count,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  // Clicks over time (group by date)
  const dateMap = new Map<string, number>();
  for (const row of rows) {
    const existing = dateMap.get(row.date) ?? 0;
    dateMap.set(row.date, existing + row.clicks);
  }

  const clicksOverTime = Array.from(dateMap.entries())
    .map(([date, clicks]) => ({ date, clicks }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Totals and averages
  const totalClicks = rows.reduce((sum: number, r) => sum + r.clicks, 0);
  const totalImpressions = rows.reduce((sum: number, r) => sum + r.impressions, 0);
  const avgCtr = rows.length > 0 ? rows.reduce((sum: number, r) => sum + r.ctr, 0) / rows.length : 0;
  const avgPosition = rows.length > 0 ? rows.reduce((sum: number, r) => sum + r.position, 0) / rows.length : 0;

  return NextResponse.json({
    topQueries,
    topPages,
    clicksOverTime,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  });
}
