import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const examples = await prisma.styleExample.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(examples);
  } catch (error) {
    console.error("Error fetching style examples:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het ophalen van de voorbeeldteksten" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const body = await request.json() as { title: string; content: string };
    const { title, content } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Titel is verplicht" },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Inhoud is verplicht" },
        { status: 400 }
      );
    }

    // Create the style example first
    const example = await prisma.styleExample.create({
      data: {
        clientId,
        title: title.trim(),
        content: content.trim(),
      },
    });

    // Generate AI style summary
    let aiStyleSummary: string | null = null;
    try {
      const truncatedContent = content.slice(0, 2000);
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Analyseer de schrijfstijl van deze tekst. Beschrijf in maximaal 100 woorden: de toon, de zinslengte, typerende uitdrukkingen of woordkeuzes, en het niveau (formeel/informeel). Geef alleen de samenvatting, geen inleiding.\nTekst: ${truncatedContent}`,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        aiStyleSummary = textContent.text;
      }
    } catch (aiError) {
      console.error("Error generating AI style summary:", aiError);
      // Continue without AI summary rather than failing the whole request
    }

    // Update the record with the AI summary
    const updatedExample = await prisma.styleExample.update({
      where: { id: example.id },
      data: { aiStyleSummary },
    });

    return NextResponse.json(updatedExample, { status: 201 });
  } catch (error) {
    console.error("Error creating style example:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het opslaan van de voorbeeldtekst" },
      { status: 500 }
    );
  }
}
