/**
 * Répartition cabinet de recrutement / entreprise cliente.
 *
 * Sur une recherche « reverse », le fournisseur renvoie le cabinet de
 * recrutement dans les champs company_* et l'entreprise cliente réelle dans les
 * champs reverse_company_*. Sans ce rétablissement, l'app enregistrerait le
 * cabinet comme employeur, et le vrai client serait perdu.
 */

export interface CompanyIdentity {
  agencyName: string | null;
  company: string | null;
  linkedinPage: string | null;
  website: string | null;
  headquarters: string | null;
}

export interface IdentitySanitizers {
  sanitizeString: (value: unknown, maxLength?: number) => string | null;
  sanitizeUrl: (value: unknown) => string | null;
}

/**
 * Le fournisseur imbrique l'entreprise cliente dans un objet `reverse_company`,
 * dont les clés reprennent celles d'une entreprise ordinaire :
 *   { company_name, company_website, company_linkedin, probability, ... }
 */
const REVERSE_OBJECT_KEYS = ["reverse_company", "reverseCompany"];

/** Variantes à plat, conservées au cas où l'export CSV serait rejoué tel quel. */
const REVERSE_NAME_KEYS = ["reverse_company_name", "Reverse Company name"];
const REVERSE_LINKEDIN_KEYS = ["reverse_company_linkedin", "Reverse Company LinkedIn"];
const REVERSE_WEBSITE_KEYS = ["reverse_company_website", "Reverse Company Website"];
const REVERSE_HQ_KEYS = ["reverse_company_hq_location", "Reverse Company HQ Location"];

/** Renvoie l'objet entreprise cliente s'il est présent et exploitable. */
export function reverseCompanyOf(lead: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of REVERSE_OBJECT_KEYS) {
    const value = lead[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

/** Première clé présente et non vide parmi les orthographes possibles. */
export function pickField(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source && source[key] != null && String(source[key]).trim() !== "") return source[key];
  }
  return null;
}

/**
 * Renvoie l'identité d'entreprise à enregistrer pour un lead.
 *
 * Hors cabinet, rien ne change. En cabinet, le nom d'entreprise devient le nom
 * du cabinet et l'entreprise cliente prend sa place — LinkedIn et site web
 * suivent, en retombant sur les valeurs d'origine si le reverse ne les fournit
 * pas. Si l'entreprise cliente n'est pas identifiée, on conserve le
 * comportement d'origine plutôt que de vider l'entreprise : mieux vaut le nom
 * du cabinet que rien.
 */
export function resolveCompanyIdentity(
  lead: Record<string, unknown>,
  recruitingAgency: boolean,
  { sanitizeString, sanitizeUrl }: IdentitySanitizers
): CompanyIdentity {
  const companyName = sanitizeString(lead.company_name, 500);
  const linkedinPage = sanitizeUrl(lead.company_linkedin);
  const website = sanitizeUrl(lead.company_website);
  const headquarters = sanitizeString(lead.hq_location, 500);
  const unchanged: CompanyIdentity = {
    agencyName: null,
    company: companyName,
    linkedinPage,
    website,
    headquarters,
  };

  if (!recruitingAgency) return unchanged;

  const reverse = reverseCompanyOf(lead);

  // Le nettoyage injecté ne coupe pas les espaces : un nom composé uniquement
  // d'espaces doit être traité comme absent, pas écrit tel quel.
  const rawClientName =
    sanitizeString(reverse ? reverse.company_name : null, 500) ??
    sanitizeString(pickField(lead, REVERSE_NAME_KEYS), 500);
  const clientName = rawClientName?.trim() || null;
  if (!clientName) return unchanged;

  // Une fois l'entreprise remplacée par le client, les champs qui la décrivent
  // ne peuvent plus provenir du cabinet : un site web ou un siège hérités de
  // l'agence désigneraient la mauvaise société. Mieux vaut vide que trompeur.
  return {
    agencyName: companyName,
    company: clientName,
    linkedinPage:
      sanitizeUrl(reverse ? reverse.company_linkedin : null) ??
      sanitizeUrl(pickField(lead, REVERSE_LINKEDIN_KEYS)),
    website:
      sanitizeUrl(reverse ? reverse.company_website : null) ??
      sanitizeUrl(pickField(lead, REVERSE_WEBSITE_KEYS)),
    headquarters:
      sanitizeString(reverse ? reverse.hq_location : null, 500)?.trim() ||
      sanitizeString(pickField(lead, REVERSE_HQ_KEYS), 500)?.trim() ||
      null,
  };
}
