/**
 * Catalogue des filtres du tableau d'offres et construction de la clause Prisma
 * correspondante. Partagé par le panneau de filtres et l'API : un seul endroit
 * décrit ce qui est filtrable, avec quel contrôle et selon quelle sémantique.
 *
 * Encodage dans l'URL : un paramètre par filtre, préfixé `f_`.
 *   booléen   f_recruitingAgency=yes|no
 *   présence  f_url=empty|filled
 *   texte     f_company=rennes
 *   liste     f_source=linkedin
 *   date      f_receivedAt_from=2026-01-01  f_receivedAt_to=2026-01-31
 */

export type OfferFilterType = "boolean" | "presence" | "text" | "enum" | "date";

export interface OfferFilterDef {
  field: string;
  label: string;
  type: OfferFilterType;
  /** Regroupement dans le panneau. */
  group: "Statuts" | "Offre" | "Entreprise" | "Lead" | "Dates";
}

export const FILTER_PARAM_PREFIX = "f_";

export const OFFER_FILTERS: OfferFilterDef[] = [
  { field: "recruitingAgency", label: "Cabinet recrutement", type: "boolean", group: "Statuts" },
  { field: "callRequested", label: "Appel demandé", type: "boolean", group: "Statuts" },
  { field: "lgmSent", label: "Envoi dans LGM", type: "boolean", group: "Statuts" },
  { field: "phoneLookupRequested", label: "Chercher téléphone", type: "boolean", group: "Statuts" },

  { field: "title", label: "Offre d'emploi", type: "text", group: "Offre" },
  { field: "description", label: "Description", type: "text", group: "Offre" },
  { field: "offerLocation", label: "Localisation", type: "text", group: "Offre" },
  { field: "source", label: "Source", type: "enum", group: "Offre" },
  { field: "url", label: "URL de l'offre", type: "presence", group: "Offre" },

  { field: "company", label: "Entreprise", type: "text", group: "Entreprise" },
  { field: "agencyName", label: "Nom du cabinet", type: "text", group: "Entreprise" },
  { field: "headquarters", label: "Siège social", type: "text", group: "Entreprise" },
  { field: "linkedinPage", label: "LinkedIn entreprise", type: "presence", group: "Entreprise" },
  { field: "website", label: "Site web", type: "presence", group: "Entreprise" },
  { field: "phone", label: "Tél. entreprise", type: "presence", group: "Entreprise" },

  { field: "leadJobTitle", label: "Métier lead", type: "text", group: "Lead" },
  { field: "leadEmail", label: "Email lead", type: "presence", group: "Lead" },
  { field: "leadLinkedin", label: "LinkedIn lead", type: "presence", group: "Lead" },
  { field: "enrichedPhone", label: "Téléphone enrichi", type: "presence", group: "Lead" },

  { field: "receivedAt", label: "Date de réception", type: "date", group: "Dates" },
  { field: "publishedAt", label: "Date de publication", type: "date", group: "Dates" },
];

export const FILTER_GROUPS = ["Statuts", "Offre", "Entreprise", "Lead", "Dates"] as const;

/** Un champ « vide » couvre aussi bien NULL que la chaîne vide. */
function presenceClause(field: string, value: string): Record<string, unknown> | null {
  if (value === "empty") return { OR: [{ [field]: null }, { [field]: "" }] };
  if (value === "filled") return { AND: [{ [field]: { not: null } }, { [field]: { not: "" } }] };
  return null;
}

function parseDate(value: string, endOfDay: boolean): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

type ParamSource = { get(key: string): string | null };

/**
 * Traduit les paramètres `f_*` en clauses Prisma, une par filtre actif.
 * Les clauses sont destinées à être combinées en AND : chaque filtre restreint
 * le résultat, aucun n'en élargit un autre.
 */
export function buildOfferFilterClauses(params: ParamSource): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];

  for (const filter of OFFER_FILTERS) {
    if (filter.type === "date") {
      const from = params.get(`${FILTER_PARAM_PREFIX}${filter.field}_from`)?.trim();
      const to = params.get(`${FILTER_PARAM_PREFIX}${filter.field}_to`)?.trim();
      const range: Record<string, Date> = {};
      const fromDate = from ? parseDate(from, false) : null;
      const toDate = to ? parseDate(to, true) : null;
      if (fromDate) range.gte = fromDate;
      if (toDate) range.lte = toDate;
      if (Object.keys(range).length > 0) clauses.push({ [filter.field]: range });
      continue;
    }

    const value = params.get(`${FILTER_PARAM_PREFIX}${filter.field}`)?.trim();
    if (!value) continue;

    switch (filter.type) {
      case "boolean":
        if (value === "yes") clauses.push({ [filter.field]: true });
        else if (value === "no") clauses.push({ [filter.field]: false });
        break;
      case "presence": {
        const clause = presenceClause(filter.field, value);
        if (clause) clauses.push(clause);
        break;
      }
      case "text":
        clauses.push({ [filter.field]: { contains: value } });
        break;
      case "enum":
        clauses.push({ [filter.field]: value });
        break;
    }
  }

  return clauses;
}

/** Nombre de filtres actifs, pour la pastille du bouton « Filtres ». */
export function countActiveFilters(values: Record<string, string>): number {
  return Object.values(values).filter((value) => value != null && value.trim() !== "").length;
}
