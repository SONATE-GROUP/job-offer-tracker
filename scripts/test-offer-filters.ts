import { buildOfferFilterClauses, countActiveFilters } from "../lib/offer-filters";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`✗ ${name}\n    attendu ${e}\n    obtenu  ${a}`); }
  else console.log(`✓ ${name}`);
}

const params = (init: Record<string, string>) => new URLSearchParams(init);

// 1. Le cas demandé : cabinet de recrutement coché
check("cabinet = oui", buildOfferFilterClauses(params({ f_recruitingAgency: "yes" })), [{ recruitingAgency: true }]);
check("cabinet = non", buildOfferFilterClauses(params({ f_recruitingAgency: "no" })), [{ recruitingAgency: false }]);
check("valeur inconnue ignorée", buildOfferFilterClauses(params({ f_recruitingAgency: "peut-être" })), []);
check("aucun filtre", buildOfferFilterClauses(params({})), []);

// 2. Présence : vide couvre NULL et chaîne vide
check("url vide", buildOfferFilterClauses(params({ f_url: "empty" })), [{ OR: [{ url: null }, { url: "" }] }]);
check("url renseignée", buildOfferFilterClauses(params({ f_url: "filled" })),
  [{ AND: [{ url: { not: null } }, { url: { not: "" } }] }]);

// 3. Texte
check("entreprise contient", buildOfferFilterClauses(params({ f_company: "sun" })), [{ company: { contains: "sun" } }]);
check("espaces seuls ignorés", buildOfferFilterClauses(params({ f_company: "   " })), []);

// 4. Liste
check("source exacte", buildOfferFilterClauses(params({ f_source: "linkedin" })), [{ source: "linkedin" }]);

// 5. Dates — la borne haute couvre la journée entière
const bornes = buildOfferFilterClauses(params({ f_receivedAt_from: "2026-01-01", f_receivedAt_to: "2026-01-31" }));
check("une seule clause de date", bornes.length, 1);
const range = (bornes[0] as { receivedAt: { gte: Date; lte: Date } }).receivedAt;
check("borne basse au début du jour", range.gte.toISOString().slice(0, 10), "2026-01-01");
check("borne haute au dernier jour", range.lte.toISOString().slice(0, 10), "2026-01-31");
check("borne haute en fin de journée", range.lte.getHours() === 23 && range.lte.getMinutes() === 59, true);
check("borne basse seule", buildOfferFilterClauses(params({ f_publishedAt_from: "2026-02-01" })).length, 1);
check("date illisible ignorée", buildOfferFilterClauses(params({ f_receivedAt_from: "n'importe quoi" })), []);

// 6. Combinaison : chaque filtre ajoute sa propre clause, à combiner en AND
const combine = buildOfferFilterClauses(params({
  f_recruitingAgency: "yes",
  f_url: "empty",
  f_company: "groupe",
  f_source: "hellowork",
}));
check("quatre filtres, quatre clauses", combine.length, 4);

// 7. Un paramètre hors catalogue n'est jamais traduit en clause
check("champ non filtrable ignoré", buildOfferFilterClauses(params({ f_customValues: "x", f_workspaceId: "autre" })), []);

// 8. Compteur de filtres actifs
check("compteur", countActiveFilters({ f_recruitingAgency: "yes", f_company: "", f_url: "empty" }), 2);

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
