import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const aiRevision = await prisma.aiRevision.findUnique({
      where: { id },
      include: {
        comment: {
          include: {
            document: {
              include: {
                versions: {
                  orderBy: { versionNumber: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!aiRevision) {
      return NextResponse.json(
        { error: "AI-revisie niet gevonden" },
        { status: 404 }
      );
    }

    const { comment } = aiRevision;
    const { document } = comment;

    // Create a version snapshot before modifying
    const lastVersionNumber = document.versions[0]?.versionNumber ?? 0;
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        content: document.content,
        versionNumber: lastVersionNumber + 1,
      },
    });

    // Replace first occurrence of originalText with proposedText
    const updatedContent = document.content.replace(
      aiRevision.originalText,
      aiRevision.proposedText
    );

    // Update document content, AiRevision status, and Comment status in a transaction
    const [updatedDoc] = await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: { content: updatedContent },
      }),
      prisma.aiRevision.update({
        where: { id },
        data: { status: "accepted" },
      }),
      prisma.comment.update({
        where: { id: comment.id },
        data: { status: "resolved" },
      }),
    ]);

    return NextResponse.json({ success: true, document: updatedDoc });
  } catch (error) {
    console.error("Error accepting AI revision:", error);
    return NextResponse.json(
      { error: "Fout bij het accepteren van de AI-revisie" },
      { status: 500 }
    );
  }
}
