import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { proposedText } = await request.json();

    if (!proposedText?.trim()) {
      return NextResponse.json({ error: "Geen aangepaste tekst opgegeven" }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        document: {
          include: {
            versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Opmerking niet gevonden" }, { status: 404 });
    }

    const { document } = comment;

    // Snapshot before modifying
    const lastVersionNumber = document.versions[0]?.versionNumber ?? 0;
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        content: document.content,
        versionNumber: lastVersionNumber + 1,
      },
    });

    const updatedContent = document.content.replace(comment.selectedText, proposedText);

    const [updatedDoc] = await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: { content: updatedContent },
      }),
      prisma.comment.update({
        where: { id },
        data: { status: "resolved" },
      }),
    ]);

    return NextResponse.json({ success: true, document: updatedDoc });
  } catch (error) {
    console.error("Error applying manual edit:", error);
    return NextResponse.json({ error: "Fout bij het toepassen van de aanpassing" }, { status: 500 });
  }
}
