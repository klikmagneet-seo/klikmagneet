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
    const body = await request.json().catch(() => ({}));
    const length: string = body.length ?? "medium";

    const lengthInstructions: Record<string, { words: string; maxTokens: number }> = {
      kort:   { words: "600-800",    maxTokens: 2048 },
      medium: { words: "1200-1500",  maxTokens: 4096 },
      lang:   { words: "2000-2500+", maxTokens: 8192 },
    };
    const lc = lengthInstructions[length] ?? lengthInstructions.medium;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return new Response(
        JSON.stringify({ error: "Document niet gevonden" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!document.brief) {
      return new Response(
        JSON.stringify({
          error: "Genereer eerst een brief voordat je de tekst genereert",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse brief from JSON string (stored as String in SQLite)
    const brief = JSON.parse(document.brief) as {
      subtopics: string[];
      questions: string[];
      structure: string[];
      intent: string;
    };

    const brandContext = await getBrandContextBlock(document.clientId);

    const systemPrompt = `Je bent een professionele SEO-copywriter die artikelen schrijft in het Nederlands.
Je schrijft goed gestructureerde artikelen die hoog scoren in zoekmachines.
Gebruik correcte markdown-koppen (# H1, ## H2, ### H3), schrijf informatief en boeiend, en zorg voor een logische opbouw.${brandContext}`;

    const userPrompt = `Schrijf een SEO-artikel van ${lc.words} woorden over: "${document.targetKeyword}"

Gebruik de volgende contentbrief als basis:

ZOEKINTENTIE:
${brief.intent}

SUBTOPICS OM TE BEHANDELEN:
${brief.subtopics.map((s, i) => `${i + 1}. ${s}`).join("\n")}

VRAGEN VAN DE DOELGROEP OM TE BEANTWOORDEN:
${brief.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

VOORGESTELDE ARTIKELSTRUCTUUR:
${brief.structure.map((s) => `- ${s}`).join("\n")}

RICHTLIJNEN:
- Schrijf de volledige artikeltitel als H1
- Gebruik de structuur hierboven met H2 en H3 kopjes
- Schrijf een pakkende introductie (2-3 alinea's)
- Beantwoord alle vragen van de doelgroep
- Behandel alle subtopics${length === "kort" ? " beknopt" : length === "lang" ? " uitgebreid en diepgaand" : " uitgebreid"}
- Eindig met een duidelijke conclusie
- Schrijf in correct Nederlands
- Streef naar ${lc.words} woorden
- Gebruik markdown-opmaak (# voor H1, ## voor H2, ### voor H3)

Begin nu met het schrijven van het artikel:`;

    // Create a streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: lc.maxTokens,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userPrompt,
              },
            ],
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

          // Save the generated content to the database
          const existingDoc = await prisma.document.findUnique({
            where: { id },
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          });

          if (existingDoc && existingDoc.content) {
            const lastVersionNumber =
              existingDoc.versions[0]?.versionNumber ?? 0;
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
            data: {
              content: fullContent,
              status: "in_review",
            },
          });

          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);
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
    console.error("Error generating content:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Er is een fout opgetreden bij het genereren van de tekst",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
