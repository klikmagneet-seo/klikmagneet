import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const { startOffset, endOffset, selectedText, commentText, authorName } = body;

    if (
      typeof startOffset !== "number" ||
      typeof endOffset !== "number" ||
      !selectedText ||
      !commentText
    ) {
      return NextResponse.json(
        { error: "Verplichte velden ontbreken" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        documentId: reviewLink.documentId,
        reviewLinkId: reviewLink.id,
        startOffset,
        endOffset,
        selectedText,
        commentText,
        authorName: authorName || null,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Fout bij het plaatsen van de opmerking" },
      { status: 500 }
    );
  }
}
