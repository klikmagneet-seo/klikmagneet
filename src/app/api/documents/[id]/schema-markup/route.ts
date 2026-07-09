import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

export async function POST(
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

    const content = document.content || "";

    const prompt = `Genereer geldige JSON-LD schema markup voor dit artikel.
Maak twee objecten:
1. Article schema met headline, description, datePublished
2. FAQPage schema op basis van de vragen in de tekst (max 5 Q&A paren)
Geef ALLEEN valide JSON-LD terug als array, geen uitleg.

Artikel:
${content.slice(0, 4000)}`;

    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "[]";

    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    // Validate it's parseable JSON
    let schemaMarkup: string;
    try {
      const parsed: unknown = JSON.parse(cleaned);
      schemaMarkup = JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if parsing fails
      schemaMarkup = cleaned;
    }

    return NextResponse.json({ schemaMarkup });
  } catch (error) {
    console.error("Schema markup error:", error);
    return NextResponse.json(
      { error: "Fout bij het genereren van schema markup" },
      { status: 500 }
    );
  }
}
