import { NextResponse } from "next/server";

export async function GET() {
  const anthropicConfigured =
    !!process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY.length > 10;

  return NextResponse.json({
    status: "ok",
    anthropicConfigured,
    timestamp: new Date().toISOString(),
  });
}
