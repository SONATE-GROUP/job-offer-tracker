import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-access";

const ALLOWED_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "FORMULA", "AI"] as const;
type FieldType = (typeof ALLOWED_TYPES)[number];
const LGM_ATTRIBUTES = Array.from({ length: 10 }, (_, i) => `customAttribute${i + 1}`);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req);
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  const fields = await prisma.customFieldDef.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req);
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  const { label, type, formula, lgmAttribute, emeliAttribute, autoFill } = await req.json();
  if (!label || typeof label !== "string" || label.trim() === "") {
    return NextResponse.json({ error: "Label requis" }, { status: 400 });
  }

  const fieldType: FieldType = ALLOWED_TYPES.includes(type) ? type : "TEXT";
  if ((fieldType === "FORMULA" || fieldType === "AI") && !formula) {
    return NextResponse.json({ error: fieldType === "FORMULA" ? "Formule requise" : "Prompt IA requis" }, { status: 400 });
  }
  if (lgmAttribute && !LGM_ATTRIBUTES.includes(lgmAttribute)) {
    return NextResponse.json({ error: "Attribut LGM invalide" }, { status: 400 });
  }

  const name = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");

  const existing = await prisma.customFieldDef.findFirst({ where: { workspaceId, name } });
  if (existing) return NextResponse.json({ error: "Un champ avec ce nom existe déjà. Choisissez un label différent." }, { status: 409 });

  if (typeof emeliAttribute === "string" && emeliAttribute.trim()) {
    const others = await prisma.customFieldDef.findMany({ where: { workspaceId }, select: { label: true, emeliAttribute: true } });
    const clash = others.find((f) => f.emeliAttribute?.toLowerCase() === emeliAttribute.trim().toLowerCase());
    if (clash) {
      return NextResponse.json(
        { error: `La clé Emelia "${emeliAttribute}" est déjà utilisée par le champ "${clash.label}". Une seule colonne par clé, sinon l'une écrase l'autre.` },
        { status: 409 }
      );
    }
  }

  const count = await prisma.customFieldDef.count({ where: { workspaceId } });

  const field = await prisma.customFieldDef.create({
    data: { workspaceId, name, label, type: fieldType, formula: formula ?? null, lgmAttribute: lgmAttribute ?? null, emeliAttribute: typeof emeliAttribute === "string" && emeliAttribute.trim() ? emeliAttribute.trim() : null, autoFill: autoFill === true, order: count },
  });

  return NextResponse.json(field, { status: 201 });
}
