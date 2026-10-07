import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LGM_ATTRIBUTES = Array.from({ length: 10 }, (_, i) => `customAttribute${i + 1}`);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const field = await prisma.customFieldDef.findUnique({ where: { id } });
  if (!field) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (session.user.role !== "ADMIN" && field.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const data: { formula?: string; emeliAttribute?: string | null; lgmAttribute?: string | null; autoFill?: boolean } = {};

  if (body.formula !== undefined) {
    if (typeof body.formula !== "string" || !body.formula.trim()) {
      return NextResponse.json({ error: "Le prompt ne peut pas être vide" }, { status: 400 });
    }
    data.formula = body.formula.trim();
  }

  if (body.emeliAttribute !== undefined) {
    const emeliAttribute = typeof body.emeliAttribute === "string" ? body.emeliAttribute.trim() : "";
    if (emeliAttribute) {
      const others = await prisma.customFieldDef.findMany({
        where: { workspaceId: field.workspaceId, NOT: { id } },
        select: { label: true, emeliAttribute: true },
      });
      const clash = others.find((f) => f.emeliAttribute?.toLowerCase() === emeliAttribute.toLowerCase());
      if (clash) {
        return NextResponse.json(
          { error: `La clé Emelia "${emeliAttribute}" est déjà utilisée par le champ "${clash.label}". Une seule colonne par clé, sinon l'une écrase l'autre.` },
          { status: 409 }
        );
      }
    }
    data.emeliAttribute = emeliAttribute || null;
  }

  if (body.lgmAttribute !== undefined) {
    const lgmAttribute = typeof body.lgmAttribute === "string" ? body.lgmAttribute : "";
    if (lgmAttribute && !LGM_ATTRIBUTES.includes(lgmAttribute)) {
      return NextResponse.json({ error: "Attribut LGM invalide" }, { status: 400 });
    }
    data.lgmAttribute = lgmAttribute || null;
  }

  if (body.autoFill !== undefined) data.autoFill = body.autoFill === true;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const updated = await prisma.customFieldDef.update({ where: { id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const field = await prisma.customFieldDef.findUnique({ where: { id } });
  if (!field) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (session.user.role !== "ADMIN" && field.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.customFieldDef.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
