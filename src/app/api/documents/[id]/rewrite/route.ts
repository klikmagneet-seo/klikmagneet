import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { getBrandContextBlock } from "@/lib/brandContext";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { existingText, lengthOption = "same" } = await request.json();
    const lengthInstructions: Record<string, string> = {
      same:   "Houd dezelfde lengte als de originele tekst",
      kort:   "Maak de tekst beknopt (600-800 woorden)",
      medium: "Schrijf een uitgebreide tekst (1200-1500 woorden)",
      lang:   "Schrijf een uitgebreid en diepgaand artikel (2000+ woorden)",
    };
    const lengthInstruction = lengthInstructions[lengthOption] ?? lengthInstructions.same;
    const rewriteMaxTokens = lengthOption === "lang" ? 8192 : lengthOption === "medium" ? 4096 : 2048;

    if (!existingText?.trim()) {
      return new Response(
        JSON.stringify({ error: "Geen tekst opgegeven om te herschrijven" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return new Response(
        JSON.stringify({ error: "Document niet gevonden" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const brief = document.brief
      ? (JSON.parse(document.brief) as {
          subtopics: string[];
          questions: string[];
          structure: string[];
          intent: string;
        })
      : null;

    const brandContext = await getBrandContextBlock(document.clientId);

    const systemPrompt = `Je bent een professionele SEO-copywriter. Je herschrijft bestaande teksten
tot betere, SEO-geoptimaliseerde content in het Nederlands. Behoud de kernboodschap en feiten,
maar verbeter de structuur, leesbaarheid en SEO-optimalisatie.
Gebruik markdown-opmaak (# H1, ## H2, ### H3).${brandContext}`;

    const userPrompt = `Herschrijf de onderstaande tekst voor het zoekwoord: "${document.targetKeyword}"

${
  brief
    ? `Gebruik deze contentbrief als richtlijn:
Zoekintentie: ${brief.intent}
Subtopics: ${brief.subtopics.slice(0, 4).join(", ")}
`
    : ""
}
RICHTLIJNEN:
- Behoud alle feitelijke informatie uit de originele tekst
- Verbeter de structuur met duidelijke H1, H2 en H3 kopjes
- Optimaliseer voor het zoekwoord "${document.targetKeyword}" (gebruik het natuurlijk, niet overdreven)
- Schrijf in correct, vlot Nederlands
- Verbeter leesbaarheid: kortere zinnen, duidelijke alinea's
- Voeg een pakkende introductie en duidelijke conclusie toe
- LENGTE: ${lengthInstruction}

ORIGINELE TEKST:
${existingText}

Begin nu met de herschreven versie:`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: rewriteMaxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          });

          let fullContent = "";

          anthropicStream.on("text", (text) => {
            fullContent += text;
            controller.enqueue(encoder.encode(text));
          });

          anthropicStream.on("error", (error) => {
            console.error("Streaming error:", error);
            controller.error(error);
          });

          await anthropicStream.finalMessage();

          const existingDoc = await prisma.document.findUnique({
            where: { id },
            include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
          });

          if (existingDoc?.content) {
            const lastVersionNumber = existingDoc.versions[0]?.versionNumber ?? 0;
            await prisma.documentVersion.create({
              data: {
                documentId: id,
                content: existingDoc.content,
                versionNumber: lastVersionNumber + 1,
              },
            });
          }

          await prisma.document.update({
            where: { id },
            data: { content: fullContent, status: "in_review" },
          });

          controller.close();
        } catch (error) {
          console.error("Error in rewrite stream:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error rewriting content:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Fout bij het herschrijven van de tekst",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
