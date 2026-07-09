import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const settings = await prisma.brandSettings.findUnique({
      where: { clientId },
    });

    if (!settings) {
      return NextResponse.json({
        toneOfVoice: "",
        preferredWords: [],
        forbiddenWords: [],
        styleRules: "",
      });
    }

    return NextResponse.json({
      toneOfVoice: settings.toneOfVoice,
      preferredWords: JSON.parse(settings.preferredWords) as string[],
      forbiddenWords: JSON.parse(settings.forbiddenWords) as string[],
      styleRules: settings.styleRules,
    });
  } catch (error) {
    console.error("Error fetching brand settings:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het ophalen van de instellingen" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const body = await request.json() as {
      toneOfVoice?: string;
      preferredWords?: string[];
      forbiddenWords?: string[];
      styleRules?: string;
    };

    const { toneOfVoice, preferredWords, forbiddenWords, styleRules } = body;

    const settings = await prisma.brandSettings.upsert({
      where: { clientId },
      update: {
        ...(toneOfVoice !== undefined && { toneOfVoice }),
        ...(preferredWords !== undefined && {
          preferredWords: JSON.stringify(preferredWords),
        }),
        ...(forbiddenWords !== undefined && {
          forbiddenWords: JSON.stringify(forbiddenWords),
        }),
        ...(styleRules !== undefined && { styleRules }),
      },
      create: {
        clientId,
        toneOfVoice: toneOfVoice ?? "",
        preferredWords: JSON.stringify(preferredWords ?? []),
        forbiddenWords: JSON.stringify(forbiddenWords ?? []),
        styleRules: styleRules ?? "",
      },
    });

    return NextResponse.json({
      toneOfVoice: settings.toneOfVoice,
      preferredWords: JSON.parse(settings.preferredWords) as string[],
      forbiddenWords: JSON.parse(settings.forbiddenWords) as string[],
      styleRules: settings.styleRules,
    });
  } catch (error) {
    console.error("Error saving brand settings:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden bij het opslaan van de instellingen" },
      { status: 500 }
    );
  }
}
