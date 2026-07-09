import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.aiRevision.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "AI-revisie niet gevonden" },
        { status: 404 }
      );
    }

    await prisma.aiRevision.update({
      where: { id },
      data: { status: "rejected" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting AI revision:", error);
    return NextResponse.json(
      { error: "Fout bij het afwijzen van de AI-revisie" },
      { status: 500 }
    );
  }
}
