import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { document: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Opmerking niet gevonden" },
        { status: 404 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "Je krijgt een tekstfragment uit een groter artikel, plus een opmerking van een reviewer.\n" +
        "Herschrijf alleen dit fragment zodat het de opmerking verwerkt. Behoud toon, stijl en\n" +
        "lengte zoveel mogelijk gelijk aan het origineel. Geef uitsluitend de herschreven tekst\n" +
        "terug, zonder aanhalingstekens of toelichting.",
      messages: [
        {
          role: "user",
          content:
            `Volledige context van het artikel:\n${comment.document.content}\n\n` +
            `Fragment om te herschrijven:\n${comment.selectedText}\n\n` +
            `Opmerking van de reviewer:\n${comment.commentText}`,
        },
      ],
    });

    const proposedText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const aiRevision = await prisma.aiRevision.create({
      data: {
        commentId: id,
        originalText: comment.selectedText,
        proposedText,
        status: "pending",
      },
    });

    return NextResponse.json(aiRevision, { status: 201 });
  } catch (error) {
    console.error("Error creating AI revision:", error);
    return NextResponse.json(
      { error: "Fout bij het genereren van de AI-revisie" },
      { status: 500 }
    );
  }
}
