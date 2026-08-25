import { resolveCompanyIdentity } from "../lib/company-identity";

// Mêmes règles de nettoyage que la route webhook.
const sanitizers = {
  sanitizeString: (value: unknown, maxLength = 1000): string | null =>
    value === null || value === undefined || value === "" ? null : String(value).slice(0, maxLength),
  sanitizeUrl: (value: unknown): string | null => {
    if (!value) return null;
    const str = String(value).trim();
    try {
      const url = new URL(str);
      return url.protocol === "https:" || url.protocol === "http:" ? str : null;
    } catch {
      return null;
    }
  },
};

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`✗ ${name}\n    attendu ${e}\n    obtenu  ${a}`); }
  else console.log(`✓ ${name}`);
}

// Ligne réelle de l'export Mantiks : Solar People (cabinet) recrute pour See You Sun (client).
const leadCabinet = {
  company_name: "Solar People",
  company_linkedin: "https://www.linkedin.com/company/solar-people",
  company_website: "",
  reverse_company_name: "See You Sun",
  reverse_company_linkedin: "https://www.linkedin.com/company/see-you-sun",
  reverse_company_website: "https://www.seeyousun.fr",
};

const cabinet = resolveCompanyIdentity(leadCabinet, true, sanitizers);
check("le cabinet part dans son champ", cabinet.agencyName, "Solar People");
check("l'entreprise devient le client final", cabinet.company, "See You Sun");
check("le LinkedIn suit le client", cabinet.linkedinPage, "https://www.linkedin.com/company/see-you-sun");
check("le site web suit le client", cabinet.website, "https://www.seeyousun.fr");

// Hors cabinet : aucun changement, même si des champs reverse traînent.
const direct = resolveCompanyIdentity(leadCabinet, false, sanitizers);
check("hors cabinet, l'entreprise reste celle d'origine", direct.company, "Solar People");
check("hors cabinet, aucun nom de cabinet", direct.agencyName, null);
check("hors cabinet, le LinkedIn reste celui d'origine", direct.linkedinPage, "https://www.linkedin.com/company/solar-people");

// Cabinet sans entreprise cliente identifiée : on ne vide jamais l'entreprise.
const sansReverse = resolveCompanyIdentity(
  { company_name: "Groupe Interaction", company_linkedin: "https://www.linkedin.com/company/interaction" },
  true,
  sanitizers
);
check("sans reverse, l'entreprise est conservée", sansReverse.company, "Groupe Interaction");
check("sans reverse, pas de nom de cabinet inventé", sansReverse.agencyName, null);

// Reverse partiel : le nom bascule, le LinkedIn retombe sur l'original.
const partiel = resolveCompanyIdentity(
  {
    company_name: "Solar People",
    company_linkedin: "https://www.linkedin.com/company/solar-people",
    reverse_company_name: "See You Sun",
  },
  true,
  sanitizers
);
check("reverse partiel : le client prend la place", partiel.company, "See You Sun");
check("reverse partiel : LinkedIn retombe sur l'original", partiel.linkedinPage, "https://www.linkedin.com/company/solar-people");

// Orthographe alternative des clés (en-têtes bruts du CSV).
const entetesCsv = resolveCompanyIdentity(
  { company_name: "Solar People", "Reverse Company name": "See You Sun", "Reverse Company Website": "https://www.seeyousun.fr" },
  true,
  sanitizers
);
check("en-têtes CSV bruts reconnus", entetesCsv.company, "See You Sun");
check("site web depuis l'en-tête brut", entetesCsv.website, "https://www.seeyousun.fr");

// Champ reverse vide : traité comme absent.
const reverseVide = resolveCompanyIdentity(
  { company_name: "Solar People", reverse_company_name: "   " },
  true,
  sanitizers
);
check("un reverse vide n'écrase pas l'entreprise", reverseVide.company, "Solar People");

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
