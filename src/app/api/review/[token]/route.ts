import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const reviewLink = await prisma.reviewLink.findUnique({
      where: { token },
    });

    if (!reviewLink) {
      return NextResponse.json(
        { error: "Reviewlink niet gevonden" },
        { status: 404 }
      );
    }

    if (reviewLink.revoked) {
      return NextResponse.json(
        { error: "Deze reviewlink is ingetrokken" },
        { status: 403 }
      );
    }

    if (reviewLink.expiresAt && reviewLink.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Deze reviewlink is verlopen" },
        { status: 403 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: reviewLink.documentId },
      select: { id: true, title: true, content: true, targetKeyword: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document niet gevonden" },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { documentId: reviewLink.documentId, status: "open" },
      orderBy: { startOffset: "asc" },
    });

    return NextResponse.json({ document, comments });
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { error: "Fout bij het ophalen van de review" },
      { status: 500 }
    );
  }
}
