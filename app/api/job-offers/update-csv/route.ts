import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRecruitingAgencyColumn } from "@/lib/job-offer-schema";
import { resolveWorkspaceId } from "@/lib/workspace-access";
import {
  cleanString,
  indexRowsById,
  planOfferUpdates,
  UPDATABLE_FIELDS,
  type CsvRow,
  type FieldMapping,
  type OfferSnapshot,
} from "@/lib/csv-import";

const MAX_UPDATE_ROWS = 5_000;
const UPDATE_CHUNK_SIZE = 20;

type UpdateBody = {
  rows?: CsvRow[];
  mapping?: FieldMapping;
  customMapping?: Record<string, string>;
  idColumn?: string;
  /** Ne remplir que les cellules actuellement vides (défaut : true). */
  onlyEmpty?: boolean;
  /** Simulation : calcule le résultat sans rien écrire. */
  dryRun?: boolean;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req, "targetWorkspaceId");
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  await ensureRecruitingAgencyColumn();

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "Aucune ligne CSV à traiter" }, { status: 400 });
  if (rows.length > MAX_UPDATE_ROWS) {
    return NextResponse.json({ error: `Mise à jour limitée à ${MAX_UPDATE_ROWS} lignes à la fois` }, { status: 400 });
  }

  const idColumn = cleanString(body.idColumn, 200);
  if (!idColumn) {
    return NextResponse.json({ error: "Indique la colonne CSV contenant l'identifiant de l'offre" }, { status: 400 });
  }

  const mapping = body.mapping ?? {};
  const customMapping = body.customMapping ?? {};
  const onlyEmpty = body.onlyEmpty !== false;
  const dryRun = body.dryRun === true;

  const customFields = await prisma.customFieldDef.findMany({ where: { workspaceId } });
  const customFieldNames = new Set(customFields.map((field) => field.name));

  const hasMappedField = UPDATABLE_FIELDS.some((field) => mapping[field]);
  const hasMappedCustom = Object.entries(customMapping).some(
    ([name, column]) => column && customFieldNames.has(name)
  );
  if (!hasMappedField && !hasMappedCustom) {
    return NextResponse.json({ error: "Associe au moins une colonne CSV à un champ à mettre à jour" }, { status: 400 });
  }

  const { rowsById } = indexRowsById(rows, idColumn);
  if (rowsById.size === 0) {
    return NextResponse.json(
      { error: `Aucun identifiant trouvé dans la colonne « ${idColumn} »` },
      { status: 400 }
    );
  }

  // Le filtre workspaceId est la garantie qu'un id du CSV ne peut pas
  // atteindre l'offre d'un autre workspace.
  const offers = await prisma.jobOffer.findMany({
    where: { workspaceId, id: { in: [...rowsById.keys()] } },
  });

  const plan = planOfferUpdates({
    rows,
    mapping,
    customMapping,
    customFieldNames,
    idColumn,
    onlyEmpty,
    offers: offers as unknown as OfferSnapshot[],
  });

  const summary = { ...plan.summary, onlyEmpty, dryRun };

  if (dryRun) return NextResponse.json({ ...summary, updated: 0 });

  let updated = 0;
  const failed: string[] = [];

  for (let index = 0; index < plan.updates.length; index += UPDATE_CHUNK_SIZE) {
    const chunk = plan.updates.slice(index, index + UPDATE_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((update) => prisma.jobOffer.update({ where: { id: update.id }, data: update.data }))
    );
    results.forEach((result, position) => {
      if (result.status === "fulfilled") updated++;
      else if (failed.length < 10) failed.push(chunk[position].id);
    });
  }

  return NextResponse.json({ ...summary, updated, failed });
}
