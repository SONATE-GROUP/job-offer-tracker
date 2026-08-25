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

// Payload réel du webhook Mantiks : l'entreprise cliente est imbriquée dans
// `reverse_company`, dont les clés reprennent celles d'une entreprise ordinaire.
const leadCabinet = {
  company_name: "Samsic Emploi",
  company_linkedin: "https://www.linkedin.com/company/samsic-emploi-sa",
  company_website: "https://www.samsic-emploi.fr",
  reverse_company: {
    company_name: "Olga",
    company_website: "https://www.olga.fr",
    company_linkedin: "https://www.linkedin.com/company/olga-triballat-noyal",
    company_siret: "70920030700011",
    probability: 0.7,
  },
};

const cabinet = resolveCompanyIdentity(leadCabinet, true, sanitizers);
check("le cabinet part dans son champ", cabinet.agencyName, "Samsic Emploi");
check("l'entreprise devient le client final", cabinet.company, "Olga");
check("le LinkedIn suit le client", cabinet.linkedinPage, "https://www.linkedin.com/company/olga-triballat-noyal");
check("le site web suit le client", cabinet.website, "https://www.olga.fr");

// Hors cabinet : aucun changement, même si des champs reverse traînent.
const direct = resolveCompanyIdentity(leadCabinet, false, sanitizers);
check("hors cabinet, l'entreprise reste celle d'origine", direct.company, "Samsic Emploi");
check("hors cabinet, aucun nom de cabinet", direct.agencyName, null);
check("hors cabinet, le LinkedIn reste celui d'origine", direct.linkedinPage, "https://www.linkedin.com/company/samsic-emploi-sa");

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
    company_name: "Samsic Emploi",
    company_linkedin: "https://www.linkedin.com/company/samsic-emploi-sa",
    reverse_company: { company_name: "Olga" },
  },
  true,
  sanitizers
);
check("reverse partiel : le client prend la place", partiel.company, "Olga");
check("reverse partiel : LinkedIn retombe sur l'original", partiel.linkedinPage, "https://www.linkedin.com/company/samsic-emploi-sa");

// Orthographe alternative des clés (en-têtes bruts du CSV).
const entetesCsv = resolveCompanyIdentity(
  { company_name: "Samsic Emploi", "Reverse Company name": "Olga", "Reverse Company Website": "https://www.olga.fr" },
  true,
  sanitizers
);
check("repli sur les en-têtes CSV à plat", entetesCsv.company, "Olga");
check("site web depuis l'en-tête brut", entetesCsv.website, "https://www.olga.fr");

// Champ reverse vide : traité comme absent.
const reverseVide = resolveCompanyIdentity(
  { company_name: "Samsic Emploi", reverse_company: { company_name: "   " } },
  true,
  sanitizers
);
check("un reverse vide n'écrase pas l'entreprise", reverseVide.company, "Samsic Emploi");

// Les 4 leads réels du rapport « [ATOUTS] Industrie (reverse) ».
const rapportReel: [string, string][] = [
  ["Samsic Emploi", "Olga"],
  ["Axia Groupe", "Groupe Tanguy Matériaux"],
  ["JOB&BOX", "Cordon Electronics"],
  ["Job Direct", "BALDESCHI"],
];
for (const [agence, client] of rapportReel) {
  const r = resolveCompanyIdentity(
    { company_name: agence, reverse_company: { company_name: client } },
    true,
    sanitizers
  );
  check(`rapport réel : ${agence} -> ${client}`, [r.company, r.agencyName], [client, agence]);
}

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
