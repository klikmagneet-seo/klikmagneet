import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 10,
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...document,
      brief: document.brief ? JSON.parse(document.brief) : null,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Fout bij het ophalen van het document" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, title, status, brief } = body;

    const existingDoc = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!existingDoc) {
      return NextResponse.json(
        { error: "Document niet gevonden" },
        { status: 404 }
      );
    }

    const updateData: {
      content?: string;
      title?: string;
      status?: string;
      brief?: string;
    } = {};

    if (content !== undefined) updateData.content = content;
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (brief !== undefined) updateData.brief = JSON.stringify(brief);

    if (content !== undefined && content !== existingDoc.content) {
      const lastVersionNumber = existingDoc.versions[0]?.versionNumber ?? 0;
      await prisma.documentVersion.create({
        data: {
          documentId: id,
          content: existingDoc.content || "",
          versionNumber: lastVersionNumber + 1,
        },
      });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      brief: updated.brief ? JSON.parse(updated.brief) : null,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Fout bij het opslaan van het document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Fout bij het verwijderen van het document" },
      { status: 500 }
    );
  }
}
