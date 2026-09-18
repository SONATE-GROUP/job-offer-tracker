import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-access";
import { cleanString, cleanUrl, parseBoolean } from "@/lib/csv-import";
import { ensureRecruitingAgencyColumn } from "@/lib/job-offer-schema";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const workspaceId = resolveWorkspaceId(session, req, "targetWorkspaceId");
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  await ensureRecruitingAgencyColumn();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const recruitingAgency = parseBoolean(body.recruitingAgency);

  const offer = await prisma.jobOffer.create({
    data: {
      workspaceId,
      title: cleanString(body.title, 500) ?? "Sans titre",
      company: cleanString(body.company, 500) ?? "Inconnu",
      url: cleanUrl(body.url),
      offerLocation: cleanString(body.offerLocation, 500),
      source: cleanString(body.source, 200) ?? "Ajout manuel",
      leadFirstName: cleanString(body.leadFirstName, 100),
      leadLastName: cleanString(body.leadLastName, 100),
      leadEmail: cleanString(body.leadEmail, 254),
      leadPhone: cleanString(body.leadPhone, 50),
      leadLinkedin: cleanUrl(body.leadLinkedin),
      leadJobTitle: cleanString(body.leadJobTitle, 200),
      recruitingAgency,
      agencyName: recruitingAgency ? cleanString(body.agencyName, 500) : null,
    },
  });

  return NextResponse.json(offer, { status: 201 });
}
