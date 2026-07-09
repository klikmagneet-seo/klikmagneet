import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json(
        { error: "Document niet gevonden" },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      include: {
        aiRevisions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Fout bij het ophalen van opmerkingen" },
      { status: 500 }
    );
  }
}
