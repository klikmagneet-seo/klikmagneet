import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json(
        { error: "Klant niet gevonden" },
        { status: 404 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { clientId },
      select: {
        id: true,
        title: true,
        targetKeyword: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        clientId: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching client documents:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het ophalen van documenten" },
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

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json(
        { error: "Klant niet gevonden" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { targetKeyword, title } = body;

    if (!targetKeyword) {
      return NextResponse.json(
        { error: "Doelzoekwoord is verplicht" },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        targetKeyword: targetKeyword.trim(),
        title: title?.trim() || targetKeyword.trim(),
        status: "draft",
        clientId,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het aanmaken van het document" },
      { status: 500 }
    );
  }
}
