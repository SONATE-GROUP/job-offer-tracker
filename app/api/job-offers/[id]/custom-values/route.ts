import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setCustomValue } from "@/lib/custom-values";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { fieldName, value } = await req.json();

  if (!fieldName || typeof fieldName !== "string" || fieldName.trim() === "") {
    return NextResponse.json({ error: "fieldName invalide" }, { status: 400 });
  }

  const offer = await prisma.jobOffer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (session.user.role !== "ADMIN" && offer.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Écriture atomique : évite qu'une valeur écrite en parallèle en écrase une autre.
  await setCustomValue(id, fieldName, value);
  const updated = await prisma.jobOffer.findUniqueOrThrow({ where: { id } });

  let updatedCustomValues: Record<string, unknown> = {};
  try { updatedCustomValues = JSON.parse(updated.customValues ?? "{}"); } catch {}

  return NextResponse.json({ ...updated, customValues: updatedCustomValues });
}
