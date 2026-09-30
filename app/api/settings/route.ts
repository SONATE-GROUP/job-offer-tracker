import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-access";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req);
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      webhookToken: true,
      lgmApiKey: true,
      lgmCampaignId: true,
      lgmAudiences: true,
      aiProvider: true,
      claudeApiKey: true,
      geminiApiKey: true,
      groqApiKey: true,
      openaiApiKey: true,
      openrouterApiKey: true,
      openrouterModel: true,
      mantiksApiKey: true,
      apolloApiKey: true,
      phoneEnrichmentProvider: true,
      derrickApiKey: true,
      prospectingProvider: true,
      emeliApiKey: true,
      emeliaCampaigns: true,
    },
  });

  return NextResponse.json(workspace);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req);
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  const {
    lgmApiKey, lgmAudiences,
    aiProvider, claudeApiKey, geminiApiKey, groqApiKey, openaiApiKey,
    openrouterApiKey, openrouterModel,
    mantiksApiKey,
    apolloApiKey, phoneEnrichmentProvider, derrickApiKey,
    prospectingProvider, emeliApiKey, emeliaCampaigns,
  } = await req.json();

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      lgmApiKey,
      lgmAudiences: Array.isArray(lgmAudiences) ? JSON.stringify(lgmAudiences) : lgmAudiences,
      aiProvider,
      claudeApiKey,
      geminiApiKey,
      groqApiKey,
      openaiApiKey,
      openrouterApiKey,
      openrouterModel,
      mantiksApiKey,
      apolloApiKey,
      phoneEnrichmentProvider,
      derrickApiKey,
      prospectingProvider,
      emeliApiKey,
      emeliaCampaigns: Array.isArray(emeliaCampaigns) ? JSON.stringify(emeliaCampaigns) : emeliaCampaigns,
    },
    select: {
      lgmApiKey: true,
      lgmAudiences: true,
      aiProvider: true,
      claudeApiKey: true,
      geminiApiKey: true,
      groqApiKey: true,
      openaiApiKey: true,
      openrouterApiKey: true,
      openrouterModel: true,
      mantiksApiKey: true,
      apolloApiKey: true,
      phoneEnrichmentProvider: true,
      derrickApiKey: true,
      prospectingProvider: true,
      emeliApiKey: true,
      emeliaCampaigns: true,
    },
  });

  return NextResponse.json(workspace);
}
