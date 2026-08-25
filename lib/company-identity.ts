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
}

export interface IdentitySanitizers {
  sanitizeString: (value: unknown, maxLength?: number) => string | null;
  sanitizeUrl: (value: unknown) => string | null;
}

/** Orthographes acceptées pour chaque champ reverse, du plus probable au moins. */
const REVERSE_NAME_KEYS = ["reverse_company_name", "reverse_company_names", "Reverse Company name"];
const REVERSE_LINKEDIN_KEYS = ["reverse_company_linkedin", "Reverse Company LinkedIn"];
const REVERSE_WEBSITE_KEYS = ["reverse_company_website", "Reverse Company Website"];

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
  const unchanged: CompanyIdentity = { agencyName: null, company: companyName, linkedinPage, website };

  if (!recruitingAgency) return unchanged;

  const clientName = sanitizeString(pickField(lead, REVERSE_NAME_KEYS), 500);
  if (!clientName) return unchanged;

  return {
    agencyName: companyName,
    company: clientName,
    linkedinPage: sanitizeUrl(pickField(lead, REVERSE_LINKEDIN_KEYS)) ?? linkedinPage,
    website: sanitizeUrl(pickField(lead, REVERSE_WEBSITE_KEYS)) ?? website,
  };
}
