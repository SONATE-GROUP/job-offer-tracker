import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_TEXT_FIELDS = ["leadCivility", "leadFirstName", "leadLastName"] as const;
type AllowedTextField = typeof ALLOWED_TEXT_FIELDS[number];

type UpdatableField = AllowedTextField | "url";

/**
 * Normalise une URL saisie manuellement : ajoute le schéma https:// s'il manque
 * (sinon le href serait résolu comme un lien relatif) et vérifie qu'elle est valide.
 * Retourne `undefined` si la valeur n'est pas une URL exploitable.
 */
function normalizeUrl(raw: string): string | undefined {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const offer = await prisma.jobOffer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (session.user.role !== "ADMIN" && offer.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const data: Partial<Record<UpdatableField, string | null>> = {};

  for (const field of ALLOWED_TEXT_FIELDS) {
    if (field in body) {
      const val = body[field];
      data[field] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
    }
  }

  if ("url" in body) {
    const val = body.url;
    const trimmed = typeof val === "string" ? val.trim() : "";
    if (trimmed === "") {
      data.url = null;
    } else {
      const normalized = normalizeUrl(trimmed);
      if (!normalized) {
        return NextResponse.json({ error: "URL invalide" }, { status: 400 });
      }
      data.url = normalized;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide à mettre à jour" }, { status: 400 });
  }

  const updated = await prisma.jobOffer.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const offer = await prisma.jobOffer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (session.user.role !== "ADMIN" && offer.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.jobOffer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
