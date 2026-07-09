import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyzeSeo,
  markdownToHtml,
  markdownToText,
  extractMetaTitle,
  extractMetaDescription,
} from "@/lib/seoAnalysis";

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

    const md = document.content || "";
    const result = analyzeSeo({
      bodyText: markdownToText(md),
      bodyHtml: markdownToHtml(md),
      metaTitle: extractMetaTitle(md),
      metaDescription: extractMetaDescription(md),
      targetKeyword: document.targetKeyword || "",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("SEO check error:", error);
    return NextResponse.json(
      { error: "Fout bij de SEO-analyse" },
      { status: 500 }
    );
  }
}
