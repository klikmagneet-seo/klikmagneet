export interface SeoCheckResult {
  passed: boolean;
  label: string;
}

export interface SeoAnalysis {
  score: number;
  checks: SeoCheckResult[];
}

function countSyllables(word: string): number {
  const matches = word.toLowerCase().match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
}

function calculateReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;

  // Douma/Flesch-variant voor Nederlandse tekst
  const score = 206.84 - 0.93 * wordsPerSentence - 77 * syllablesPerWord;
  return Math.round(score);
}

function checkHeadingStructure(html: string): boolean {
  const headings = [...html.matchAll(/<h([1-3])/gi)].map((m) =>
    parseInt(m[1], 10)
  );
  const h1Count = headings.filter((h) => h === 1).length;
  if (h1Count !== 1) return false;

  let seenH2 = false;
  for (const level of headings) {
    if (level === 1) {
      seenH2 = false;
      continue;
    }
    if (level === 2) {
      seenH2 = true;
      continue;
    }
    if (level === 3 && !seenH2) return false;
  }
  return true;
}

function checkMetaLength(text: string, min: number, max: number) {
  const length = text.length;
  return { ok: length >= min && length <= max, length };
}

function calculateKeywordDensity(text: string, keyword: string): number {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const keywordLower = keyword.toLowerCase();
  const occurrences = words.filter((w) => w.includes(keywordLower)).length;
  return words.length > 0 ? (occurrences / words.length) * 100 : 0;
}

function checkAltTexts(html: string) {
  const imgTags = [...html.matchAll(/<img[^>]*>/gi)];
  const missing = imgTags.filter((tag) => !/alt="[^"]+"/.test(tag[0])).length;
  return { missing, total: imgTags.length };
}

export function analyzeSeo(params: {
  bodyText: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  targetKeyword: string;
}): SeoAnalysis {
  const checks: SeoCheckResult[] = [];

  const readability = calculateReadability(params.bodyText);
  checks.push({
    passed: readability >= 50,
    label:
      readability >= 70
        ? `Leesbaarheid: goed (${readability})`
        : readability >= 50
          ? `Leesbaarheid: gemiddeld (${readability})`
          : `Leesbaarheid: moeilijk (${readability})`,
  });

  const headingsOk = checkHeadingStructure(params.bodyHtml);
  checks.push({
    passed: headingsOk,
    label: headingsOk
      ? "Kopstructuur correct"
      : "Kopstructuur: check H1/H2/H3-volgorde",
  });

  const titleCheck = checkMetaLength(params.metaTitle, 50, 60);
  checks.push({
    passed: titleCheck.ok,
    label: titleCheck.ok
      ? "Metatitel binnen 50-60 tekens"
      : `Metatitel ${titleCheck.length} tekens (ideaal 50-60)`,
  });

  const descCheck = checkMetaLength(params.metaDescription, 120, 158);
  checks.push({
    passed: descCheck.ok,
    label: descCheck.ok
      ? "Meta-beschrijving binnen 120-158 tekens"
      : `Meta-beschrijving ${descCheck.length} tekens (ideaal 120-158)`,
  });

  const density = calculateKeywordDensity(params.bodyText, params.targetKeyword);
  const densityOk = density >= 0.5 && density <= 2.5;
  checks.push({
    passed: densityOk,
    label: densityOk
      ? `Keyword-dichtheid gezond (${density.toFixed(1)}%)`
      : `Keyword-dichtheid ${density.toFixed(1)}% (ideaal 0,5-2,5%)`,
  });

  const altCheck = checkAltTexts(params.bodyHtml);
  const altOk = altCheck.missing === 0;
  checks.push({
    passed: altOk,
    label: altOk
      ? "Alle afbeeldingen hebben alt-tekst"
      : `Alt-tekst ontbreekt bij ${altCheck.missing} van ${altCheck.total} afbeelding(en)`,
  });

  const score = Math.round(
    (checks.filter((c) => c.passed).length / checks.length) * 100
  );
  return { score, checks };
}

// --- Markdown conversion helpers (used by the API route) ---

export function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      return line;
    })
    .join("\n")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
}

export function markdownToText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

export function extractMetaTitle(md: string): string {
  const match = md.match(/^# (.+)$/m);
  return match ? match[1].trim() : "";
}

export function extractMetaDescription(md: string): string {
  const lines = md.split("\n");
  let pastH1 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^# /.test(line)) {
      pastH1 = true;
      continue;
    }
    if (!pastH1) continue;
    if (!trimmed || /^#{1,6} /.test(line)) continue;
    return trimmed.replace(/[*_`]/g, "");
  }
  return "";
}
