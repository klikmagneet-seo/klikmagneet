import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string; exampleId: string }> }
) {
  try {
    const { clientId, exampleId } = await params;

    // Verify the example belongs to this client
    const example = await prisma.styleExample.findUnique({
      where: { id: exampleId },
    });

    if (!example) {
      return NextResponse.json(
        { error: "Voorbeeldtekst niet gevonden" },
        { status: 404 }
      );
    }

    if (example.clientId !== clientId) {
      return NextResponse.json(
        { error: "Geen toegang tot deze voorbeeldtekst" },
        { status: 403 }
      );
    }

    await prisma.styleExample.delete({
      where: { id: exampleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting style example:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het verwijderen van de voorbeeldtekst" },
      { status: 500 }
    );
  }
}
