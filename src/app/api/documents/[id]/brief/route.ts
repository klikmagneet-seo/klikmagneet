import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { getBrandContextBlock } from "@/lib/brandContext";

const LENGTH_BRIEF: Record<string, { subtopics: string; questions: string; structure: string }> = {
  kort:   { subtopics: "3-5", questions: "4-6",  structure: "6-8 elementen (beknopte opbouw)" },
  medium: { subtopics: "5-8", questions: "6-10", structure: "8-12 elementen" },
  lang:   { subtopics: "8-12", questions: "10-15", structure: "12-18 elementen (uitgebreide opbouw)" },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const length: string = body.length ?? "medium";
    const lc = LENGTH_BRIEF[length] ?? LENGTH_BRIEF.medium;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document niet gevonden" },
        { status: 404 }
      );
    }

    const brandContext = await getBrandContextBlock(document.clientId);

    const systemPrompt = `Je bent een expert SEO-contentstrateeg en contentplanner.
Je taak is om een gedetailleerde contentbrief te maken voor SEO-artikelen in het Nederlands.
Je antwoord moet altijd valide JSON zijn zonder extra tekst of markdown.${brandContext}`;

    const userPrompt = `Maak een contentbrief voor een SEO-artikel over het zoekwoord: "${document.targetKeyword}"
Gewenste artikellengte: ${length === "kort" ? "beknopt (600-800 woorden)" : length === "lang" ? "uitgebreid en diepgaand (2000-2500 woorden)" : "uitgebreid (1200-1500 woorden)"}

Analyseer de zoekintentie en maak een brief met de volgende structuur als JSON:

{
  "subtopics": ["array van ${lc.subtopics} relevante subtopics"],
  "questions": ["array van ${lc.questions} vragen die de doelgroep heeft"],
  "structure": ["array van ${lc.structure} H2/H3-kopjes inclusief intro en conclusie"],
  "intent": "beschrijving van de zoekintentie en wat de lezer wil bereiken"
}

Zorg dat de brief gericht is op Nederlandstalige gebruikers en actuele SEO-best practices volgt.
Geef alleen de JSON terug, geen extra tekst.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Geen tekstreactie ontvangen van AI");
    }

    let brief;
    try {
      // Strip potential markdown code blocks
      const cleanedText = textContent.text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      brief = JSON.parse(cleanedText);
    } catch {
      throw new Error("AI heeft geen valide JSON teruggegeven");
    }

    // Validate the brief structure
    if (!brief.subtopics || !brief.questions || !brief.structure || !brief.intent) {
      throw new Error("Brief heeft niet de juiste structuur");
    }

    // Save the brief to the document (store as JSON string since SQLite doesn't support Json type)
    await prisma.document.update({
      where: { id },
      data: {
        brief: JSON.stringify(brief),
        status: "draft",
      },
    });

    return NextResponse.json(brief);
  } catch (error) {
    console.error("Error generating brief:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Er is een fout opgetreden bij het genereren van de brief",
      },
      { status: 500 }
    );
  }
}
