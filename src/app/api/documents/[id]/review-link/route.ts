import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
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

    let body: { expiresInDays?: number } = {};
    try {
      body = await request.json();
    } catch {
      // body is optional
    }

    const token = crypto.randomBytes(9).toString("base64url");

    let expiresAt: Date | null = null;
    if (body.expiresInDays && body.expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);
    }

    const reviewLink = await prisma.reviewLink.create({
      data: {
        documentId: id,
        token,
        expiresAt,
      },
    });

    return NextResponse.json(reviewLink, { status: 201 });
  } catch (error) {
    console.error("Error creating review link:", error);
    return NextResponse.json(
      { error: "Fout bij het aanmaken van de reviewlink" },
      { status: 500 }
    );
  }
}
