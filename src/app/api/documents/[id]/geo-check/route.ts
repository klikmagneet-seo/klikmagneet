import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function getFirstNonHeadingParagraph(content: string): string {
  const lines = content.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (line === "") continue;
    if (/^#{1,6} /.test(line)) continue;
    const cleaned = stripMarkdown(line);
    if (cleaned.length > 20) return cleaned.slice(0, 500);
  }
  return "";
}

function hasStatistics(content: string): boolean {
  // Numbers with %, source citations, research references
  return /\d+\s*%|\d+,\d+\s*%|\d+\.\d+\s*%/.test(content);
}

function hasSourceReferences(content: string): boolean {
  return /(bron:|volgens\s|onderzoek\s|onderzoek:|studie:|https?:\/\/|www\.)/i.test(
    content
  );
}

function getFreshnessInfo(updatedAt: Date): {
  score: number;
  status: "fresh" | "aging" | "stale" | "outdated";
  daysSinceUpdate: number;
} {
  const now = new Date();
  const diff = now.getTime() - updatedAt.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  let score: number;
  let status: "fresh" | "aging" | "stale" | "outdated";

  if (days < 30) {
    score = 100;
    status = "fresh";
  } else if (days < 90) {
    score = 70;
    status = "aging";
  } else if (days < 180) {
    score = 40;
    status = "stale";
  } else {
    score = 10;
    status = "outdated";
  }

  return { score, status, daysSinceUpdate: days };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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
    const targetKeyword = document.targetKeyword || "";

    // --- Code-based checks ---
    const statistics = hasStatistics(content);
    const sourceRefs = hasSourceReferences(content);
    const { score: freshnessScore, status: freshnessStatus, daysSinceUpdate } =
      getFreshnessInfo(document.updatedAt);

    // --- AI-based: direct answer check ---
    const openingParagraph = getFirstNonHeadingParagraph(content);

    const aiPrompt = `Beoordeel of de openingsalinea van dit artikel de hoofdvraag direct beantwoordt.
Hoofdkeyword: ${targetKeyword}
Openingsalinea: ${openingParagraph}
Geef een score van 0-100 en één zin feedback.
Antwoord in JSON: {"score": number, "feedback": "string"}`;

    let directAnswerScore = 50;
    let directAnswerFeedback = "Kon directe beantwoording niet analyseren.";

    try {
      const aiResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: aiPrompt }],
      });

      const rawText =
        aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

      // Extract JSON even if wrapped in markdown code block
      const jsonMatch = rawText.match(/\{[\s\S]*"score"[\s\S]*"feedback"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          score: number;
          feedback: string;
        };
        directAnswerScore = Math.max(0, Math.min(100, Number(parsed.score) || 50));
        directAnswerFeedback = parsed.feedback || directAnswerFeedback;
      }
    } catch (aiError) {
      console.error("AI direct answer check failed:", aiError);
      // Keep defaults
    }

    const directAnswerStatus: "good" | "average" | "poor" =
      directAnswerScore >= 70
        ? "good"
        : directAnswerScore >= 40
        ? "average"
        : "poor";

    // --- GEO score (weighted) ---
    const statisticsScore = statistics ? 100 : 0;
    const sourcesScore = sourceRefs ? 100 : 0;
    const geoScore = Math.round(
      directAnswerScore * 0.4 +
        statisticsScore * 0.2 +
        sourcesScore * 0.2 +
        freshnessScore * 0.2
    );

    // --- Suggestions ---
    const suggestions: string[] = [];
    if (directAnswerStatus !== "good") {
      suggestions.push(
        "Beantwoord de hoofdvraag direct in de eerste alinea, bij voorkeur in de eerste twee zinnen."
      );
    }
    if (!statistics) {
      suggestions.push(
        "Voeg statistieken of cijfers toe (bijv. percentages) om de inhoud geloofwaardiger te maken."
      );
    }
    if (!sourceRefs) {
      suggestions.push(
        'Verwijs naar betrouwbare bronnen met zinnen als "Volgens onderzoek..." of "Bron: ...".'
      );
    }
    if (freshnessStatus === "stale" || freshnessStatus === "outdated") {
      suggestions.push(
        "Werk het artikel bij met actuele informatie; verouderde content scoort minder goed in AI-zoekopdrachten."
      );
    }
    if (suggestions.length === 0) {
      suggestions.push(
        "Voeg een FAQ-sectie toe met veelgestelde vragen om de GEO-score verder te verbeteren."
      );
    }

    return NextResponse.json({
      directAnswerScore,
      directAnswerStatus,
      directAnswerFeedback,
      hasStatistics: statistics,
      hasSourceReferences: sourceRefs,
      freshnessScore,
      freshnessStatus,
      daysSinceUpdate,
      geoScore,
      suggestions: suggestions.slice(0, 4),
    });
  } catch (error) {
    console.error("GEO check error:", error);
    return NextResponse.json(
      { error: "Fout bij de GEO-analyse" },
      { status: 500 }
    );
  }
}
