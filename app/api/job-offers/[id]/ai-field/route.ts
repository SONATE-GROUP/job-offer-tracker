import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAIProvider } from "@/lib/ai-generate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id: offerId } = await params;
  const { fieldId, prompt } = await req.json();
  if (!fieldId || !prompt) return NextResponse.json({ error: "fieldId et prompt requis" }, { status: 400 });

  const [offer, field] = await Promise.all([
    prisma.jobOffer.findUnique({ where: { id: offerId } }),
    prisma.customFieldDef.findUnique({ where: { id: fieldId } }),
  ]);

  if (!offer) return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  if (!field) return NextResponse.json({ error: "Champ introuvable" }, { status: 404 });
  if (offer.workspaceId !== field.workspaceId) return NextResponse.json({ error: "Incohérence workspace" }, { status: 400 });

  if (session.user.role !== "ADMIN" && offer.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: offer.workspaceId },
    select: { aiProvider: true, claudeApiKey: true, geminiApiKey: true, groqApiKey: true, openaiApiKey: true, openrouterApiKey: true, openrouterModel: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 });

  try {
    const value = await callAIProvider(workspace, prompt, offer);
    const customValues = JSON.parse(offer.customValues || "{}");
    customValues[field.name] = value;
    await prisma.jobOffer.update({ where: { id: offerId }, data: { customValues: JSON.stringify(customValues) } });
    return NextResponse.json({ value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur IA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
