import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Opmerking niet gevonden" },
        { status: 404 }
      );
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { status: "resolved" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error resolving comment:", error);
    return NextResponse.json(
      { error: "Fout bij het oplossen van de opmerking" },
      { status: 500 }
    );
  }
}
