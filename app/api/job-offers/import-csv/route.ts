import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRecruitingAgencyColumn } from "@/lib/job-offer-schema";
import { resolveWorkspaceId } from "@/lib/workspace-access";
import {
  cleanString,
  cleanUrl,
  mappedValue,
  normalizeCivility,
  parseBoolean,
  parseDate,
  type CsvRow,
  type FieldMapping,
} from "@/lib/csv-import";

const MAX_IMPORT_ROWS = 2_000;

type ImportBody = {
  rows?: CsvRow[];
  mapping?: FieldMapping;
  customMapping?: Record<string, string>;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const workspaceId = resolveWorkspaceId(session, req, "targetWorkspaceId");
  if (!workspaceId) return NextResponse.json({ error: "Workspace requis" }, { status: 400 });

  await ensureRecruitingAgencyColumn();

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "Aucune ligne CSV à importer" }, { status: 400 });
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Import limité à ${MAX_IMPORT_ROWS} lignes à la fois` }, { status: 400 });
  }

  const mapping = body.mapping ?? {};
  const customMapping = body.customMapping ?? {};
  const customFields = await prisma.customFieldDef.findMany({ where: { workspaceId } });
  const customFieldNames = new Set(customFields.map((field) => field.name));

  const data = rows.map((row) => {
    const customValues: Record<string, unknown> = {};
    for (const [fieldName, column] of Object.entries(customMapping)) {
      if (!customFieldNames.has(fieldName) || !column) continue;
      const value = row[column];
      if (value != null && String(value).trim() !== "") customValues[fieldName] = value;
    }

    return {
      workspaceId,
      title: cleanString(mappedValue(row, mapping, "title"), 500) ?? "Sans titre",
      description: cleanString(mappedValue(row, mapping, "description"), 10000),
      url: cleanUrl(mappedValue(row, mapping, "url")),
      company: cleanString(mappedValue(row, mapping, "company"), 500) ?? "Inconnu",
      linkedinPage: cleanUrl(mappedValue(row, mapping, "linkedinPage")),
      website: cleanUrl(mappedValue(row, mapping, "website")),
      phone: cleanString(mappedValue(row, mapping, "phone"), 50),
      headquarters: cleanString(mappedValue(row, mapping, "headquarters"), 500),
      offerLocation: cleanString(mappedValue(row, mapping, "offerLocation"), 500),
      source: cleanString(mappedValue(row, mapping, "source"), 200) ?? "Import CSV",
      publishedAt: parseDate(mappedValue(row, mapping, "publishedAt")),
      leadCivility: normalizeCivility(mappedValue(row, mapping, "leadCivility")),
      leadFirstName: cleanString(mappedValue(row, mapping, "leadFirstName"), 100),
      leadLastName: cleanString(mappedValue(row, mapping, "leadLastName"), 100),
      leadEmail: cleanString(mappedValue(row, mapping, "leadEmail"), 254),
      leadJobTitle: cleanString(mappedValue(row, mapping, "leadJobTitle"), 200),
      leadLinkedin: cleanUrl(mappedValue(row, mapping, "leadLinkedin")),
      leadPhone: cleanString(mappedValue(row, mapping, "leadPhone"), 50),
      toContact: parseBoolean(mappedValue(row, mapping, "toContact")),
      doNotContact: parseBoolean(mappedValue(row, mapping, "doNotContact")),
      recruitingAgency: parseBoolean(mappedValue(row, mapping, "recruitingAgency")),
      agencyName: cleanString(mappedValue(row, mapping, "agencyName"), 500),
      callRequested: parseBoolean(mappedValue(row, mapping, "callRequested")),
      phoneLookupRequested: parseBoolean(mappedValue(row, mapping, "phoneLookupRequested")),
      enrichedPhone: cleanString(mappedValue(row, mapping, "enrichedPhone"), 50),
      customValues: JSON.stringify(customValues),
    };
  });

  const result = await prisma.jobOffer.createMany({ data });
  return NextResponse.json({ imported: result.count });
}
