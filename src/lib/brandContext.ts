import { prisma } from "@/lib/prisma";

/**
 * Fetches brand settings and style examples for a given clientId and returns
 * an additional system prompt block. Returns an empty string if no relevant
 * brand context exists.
 */
export async function getBrandContextBlock(clientId: string): Promise<string> {
  const [settings, styleExamples] = await Promise.all([
    prisma.brandSettings.findUnique({ where: { clientId } }),
    prisma.styleExample.findMany({
      where: { clientId },
      select: { title: true, aiStyleSummary: true },
    }),
  ]);

  const lines: string[] = [];

  if (settings) {
    const preferredWords = JSON.parse(settings.preferredWords) as string[];
    const forbiddenWords = JSON.parse(settings.forbiddenWords) as string[];

    const styleLines: string[] = [];

    if (settings.toneOfVoice.trim()) {
      styleLines.push(`Tone of voice: ${settings.toneOfVoice.trim()}`);
    }
    if (preferredWords.length > 0) {
      styleLines.push(`Voorkeurswoorden: ${preferredWords.join(", ")}`);
    }
    if (forbiddenWords.length > 0) {
      styleLines.push(
        `Verboden woorden (gebruik deze NOOIT): ${forbiddenWords.join(", ")}`
      );
    }
    if (settings.styleRules.trim()) {
      styleLines.push(`Schrijfregels: ${settings.styleRules.trim()}`);
    }

    if (styleLines.length > 0) {
      lines.push("SCHRIJFSTIJL VOOR DEZE KLANT:");
      lines.push(...styleLines);
    }
  }

  const examplesWithSummary = styleExamples.filter(
    (e): e is { title: string; aiStyleSummary: string } =>
      e.aiStyleSummary !== null && e.aiStyleSummary !== undefined
  );
  if (examplesWithSummary.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("STIJLVOORBEELDEN:");
    for (const ex of examplesWithSummary) {
      lines.push(`- ${ex.title}: ${ex.aiStyleSummary}`);
    }
  }

  if (lines.length === 0) return "";

  return "\n\n" + lines.join("\n");
}
