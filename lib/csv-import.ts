/**
 * Helpers partagés entre l'import CSV (création d'offres) et la mise à jour CSV
 * (remplissage de colonnes sur des offres existantes, rapprochées par leur id).
 */

export type JobOfferField =
  | "title"
  | "description"
  | "url"
  | "company"
  | "linkedinPage"
  | "website"
  | "phone"
  | "headquarters"
  | "offerLocation"
  | "source"
  | "publishedAt"
  | "leadCivility"
  | "leadFirstName"
  | "leadLastName"
  | "leadEmail"
  | "leadJobTitle"
  | "leadLinkedin"
  | "leadPhone"
  | "toContact"
  | "doNotContact"
  | "recruitingAgency"
  | "agencyName"
  | "callRequested"
  | "phoneLookupRequested"
  | "enrichedPhone";

export type CsvRow = Record<string, unknown>;
export type FieldMapping = Partial<Record<JobOfferField, string>>;

/** Champs modifiables via une mise à jour CSV (tous sauf les clés d'identité). */
export const UPDATABLE_FIELDS: JobOfferField[] = [
  "title",
  "description",
  "url",
  "company",
  "linkedinPage",
  "website",
  "phone",
  "headquarters",
  "offerLocation",
  "source",
  "publishedAt",
  "leadCivility",
  "leadFirstName",
  "leadLastName",
  "leadEmail",
  "leadJobTitle",
  "leadLinkedin",
  "leadPhone",
  "toContact",
  "doNotContact",
  "recruitingAgency",
  "agencyName",
  "callRequested",
  "phoneLookupRequested",
  "enrichedPhone",
];

const BOOLEAN_FIELDS = new Set<JobOfferField>([
  "toContact",
  "doNotContact",
  "recruitingAgency",
  "callRequested",
  "phoneLookupRequested",
]);

export function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

export function cleanString(value: unknown, maxLength = 1000): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

/**
 * Nettoie une URL issue d'un CSV. Le schéma https:// est ajouté s'il manque,
 * comme à la saisie manuelle dans le tableau : sans lui, `example.com/offre`
 * serait rejeté alors que la valeur est exploitable. Un hôte sans point
 * (« N/A », « aucun »…) est refusé.
 */
export function cleanUrl(value: unknown): string | null {
  const text = cleanString(value, 2000);
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return withScheme;
  } catch {
    return null;
  }
}

export function parseBoolean(value: unknown): boolean {
  const text = cleanString(value, 50)?.toLowerCase();
  if (!text) return false;
  return ["1", "true", "vrai", "oui", "yes", "y", "x", "checked", "contact", "contacté", "a contacter", "à contacter"].includes(text);
}

export function parseDate(value: unknown): Date | null {
  const text = cleanString(value, 100);
  if (!text) return null;

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const frMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!frMatch) return null;

  const [, day, month, rawYear] = frMatch;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeCivility(value: unknown): string | null {
  const text = cleanString(value, 30);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (["m", "m.", "mr", "mr.", "monsieur"].includes(lower)) return "Monsieur";
  if (["mme", "madame", "ms", "ms.", "mrs", "mrs."].includes(lower)) return "Madame";
  return text;
}

export function mappedValue(row: CsvRow, mapping: FieldMapping, field: JobOfferField): unknown {
  const column = mapping[field];
  if (!column) return null;
  return row[column];
}

export function isBooleanField(field: JobOfferField): boolean {
  return BOOLEAN_FIELDS.has(field);
}

/** Convertit une cellule CSV brute vers la valeur typée attendue par Prisma. */
export function buildFieldValue(field: JobOfferField, raw: unknown): string | boolean | Date | null {
  switch (field) {
    case "title":
    case "company":
    case "agencyName":
    case "headquarters":
    case "offerLocation":
      return cleanString(raw, 500);
    case "description":
      return cleanString(raw, 10000);
    case "url":
    case "linkedinPage":
    case "website":
    case "leadLinkedin":
      return cleanUrl(raw);
    case "phone":
    case "leadPhone":
    case "enrichedPhone":
      return cleanString(raw, 50);
    case "source":
    case "leadJobTitle":
      return cleanString(raw, 200);
    case "publishedAt":
      return parseDate(raw);
    case "leadCivility":
      return normalizeCivility(raw);
    case "leadFirstName":
    case "leadLastName":
      return cleanString(raw, 100);
    case "leadEmail":
      return cleanString(raw, 254);
    case "toContact":
    case "doNotContact":
    case "recruitingAgency":
    case "callRequested":
    case "phoneLookupRequested":
      return parseBoolean(raw);
  }
}

export interface OfferSnapshot {
  id: string;
  customValues?: string | null;
  [field: string]: unknown;
}

export interface UpdatePlanInput {
  rows: CsvRow[];
  mapping: FieldMapping;
  customMapping: Record<string, string>;
  customFieldNames: Set<string>;
  idColumn: string;
  onlyEmpty: boolean;
  offers: OfferSnapshot[];
}

/** Ce qu'il advient d'une colonne donnée, ligne par ligne. */
export interface FieldStat {
  /** Sera écrite : la cellule du CSV a une valeur, celle de la base est vide. */
  toFill: number;
  /** Protégée : la base a déjà une valeur et « ne remplir que les cellules vides » est actif. */
  alreadyFilled: number;
  /** Ignorée : la cellule du CSV est vide, elle n'effacerait rien. */
  blankInCsv: number;
  /** Ignorée : le CSV répète la valeur déjà en base. */
  identical: number;
  /** Refusée : valeur inexploitable (URL invalide, date illisible…). */
  invalid: number;
}

export interface UpdatePlan {
  updates: { id: string; data: Record<string, unknown> }[];
  ids: string[];
  summary: {
    rows: number;
    matched: number;
    toUpdate: number;
    notFound: number;
    unchanged: number;
    skippedFilled: number;
    invalidValues: number;
    missingId: number;
    duplicateId: number;
    samples: { id: string; fields: string[] }[];
    /** Détail par colonne associée, sur les seules lignes rapprochées. */
    fieldStats: Record<string, FieldStat>;
  };
}

/** Une valeur est « vide » si elle est nulle, une chaîne vide ou un booléen false. */
export function isBlankFieldValue(value: unknown): boolean {
  if (typeof value === "boolean") return value === false;
  return isBlank(value);
}

function valuesEqual(current: unknown, next: unknown): boolean {
  if (next instanceof Date) {
    return current instanceof Date && current.getTime() === next.getTime();
  }
  return current === next;
}

/**
 * Indexe les lignes du CSV par identifiant. En cas de doublon, la dernière
 * ligne l'emporte — et le doublon est compté pour être signalé à l'utilisateur.
 */
export function indexRowsById(rows: CsvRow[], idColumn: string): {
  rowsById: Map<string, CsvRow>;
  missingId: number;
  duplicateId: number;
} {
  const rowsById = new Map<string, CsvRow>();
  let missingId = 0;
  let duplicateId = 0;

  for (const row of rows) {
    const id = cleanString(row[idColumn], 200);
    if (!id) {
      missingId++;
      continue;
    }
    if (rowsById.has(id)) duplicateId++;
    rowsById.set(id, row);
  }

  return { rowsById, missingId, duplicateId };
}

/**
 * Calcule, sans rien écrire, la liste des mises à jour à appliquer.
 * Règles : une cellule CSV vide n'écrase jamais une valeur existante, un champ
 * non associé n'est jamais touché, et `onlyEmpty` protège les valeurs déjà
 * renseignées en base.
 */
export function planOfferUpdates(input: UpdatePlanInput): UpdatePlan {
  const { rows, mapping, customMapping, customFieldNames, idColumn, onlyEmpty, offers } = input;

  const { rowsById, missingId, duplicateId } = indexRowsById(rows, idColumn);
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));

  const mappedFields = UPDATABLE_FIELDS.filter((field) => mapping[field]);
  const mappedCustom = Object.entries(customMapping).filter(
    ([name, column]) => column && customFieldNames.has(name)
  );

  const updates: UpdatePlan["updates"] = [];
  const samples: { id: string; fields: string[] }[] = [];
  let notFound = 0;
  let unchanged = 0;
  let skippedFilled = 0;
  let invalidValues = 0;

  const fieldStats: Record<string, FieldStat> = {};
  function stat(key: string): FieldStat {
    return (fieldStats[key] ??= { toFill: 0, alreadyFilled: 0, blankInCsv: 0, identical: 0, invalid: 0 });
  }
  for (const field of mappedFields) stat(field);
  for (const [name] of mappedCustom) stat(name);

  for (const [id, row] of rowsById) {
    const offer = offersById.get(id);
    if (!offer) {
      notFound++;
      continue;
    }

    const data: Record<string, unknown> = {};
    let rowSkippedFilled = false;
    let rowInvalid = false;

    for (const field of mappedFields) {
      const raw = row[mapping[field] as string];
      if (isBlank(raw)) {
        stat(field).blankInCsv++;
        continue;
      }

      if (onlyEmpty && !isBlankFieldValue(offer[field])) {
        stat(field).alreadyFilled++;
        rowSkippedFilled = true;
        continue;
      }

      const value = buildFieldValue(field, raw);
      if (value === null) {
        stat(field).invalid++;
        rowInvalid = true;
        continue;
      }
      if (valuesEqual(offer[field], value)) {
        stat(field).identical++;
        continue;
      }

      stat(field).toFill++;
      data[field] = value;
    }

    if (mappedCustom.length > 0) {
      let customValues: Record<string, unknown> = {};
      try {
        customValues = JSON.parse(offer.customValues ?? "{}");
      } catch {
        customValues = {};
      }

      let customChanged = false;
      for (const [name, column] of mappedCustom) {
        const raw = row[column];
        if (isBlank(raw)) {
          stat(name).blankInCsv++;
          continue;
        }
        if (onlyEmpty && !isBlank(customValues[name])) {
          stat(name).alreadyFilled++;
          rowSkippedFilled = true;
          continue;
        }
        if (String(customValues[name] ?? "") === String(raw)) {
          stat(name).identical++;
          continue;
        }
        stat(name).toFill++;
        customValues[name] = raw;
        customChanged = true;
      }

      if (customChanged) data.customValues = JSON.stringify(customValues);
    }

    if (Object.keys(data).length === 0) {
      if (rowInvalid) invalidValues++;
      else if (rowSkippedFilled) skippedFilled++;
      else unchanged++;
      continue;
    }

    updates.push({ id, data });
    if (samples.length < 5) samples.push({ id, fields: Object.keys(data) });
  }

  return {
    updates,
    ids: [...rowsById.keys()],
    summary: {
      rows: rows.length,
      matched: rowsById.size - notFound,
      toUpdate: updates.length,
      notFound,
      unchanged,
      skippedFilled,
      invalidValues,
      missingId,
      duplicateId,
      samples,
      fieldStats,
    },
  };
}
