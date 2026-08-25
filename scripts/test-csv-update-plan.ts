import { planOfferUpdates, cleanUrl, type OfferSnapshot } from "../lib/csv-import";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`✗ ${name}\n    attendu ${e}\n    obtenu  ${a}`); }
  else console.log(`✓ ${name}`);
}

const offers: OfferSnapshot[] = [
  { id: "a1", url: null, title: "Chef d'équipe", customValues: "{}" },
  { id: "a2", url: "https://existant.com/offre", title: "Paysagiste", customValues: "{}" },
  { id: "a3", url: "", title: "Technicien", customValues: '{"note":"deja"}' },
];

const base = {
  mapping: { url: "URL" },
  customMapping: {},
  customFieldNames: new Set<string>(),
  idColumn: "id",
  onlyEmpty: true,
};

// 1. Cas nominal : remplit uniquement les URL vides
const r1 = planOfferUpdates({
  ...base,
  offers,
  rows: [
    { id: "a1", URL: "https://linkedin.com/jobs/1" },
    { id: "a2", URL: "https://backup.com/2" },
    { id: "a3", URL: "https://indeed.com/3" },
    { id: "inconnu", URL: "https://x.com/4" },
  ],
});
check("remplit les 2 URL vides (dont chaîne vide)", r1.summary.toUpdate, 2);
check("protège l'URL déjà remplie", r1.summary.skippedFilled, 1);
check("signale l'id introuvable", r1.summary.notFound, 1);
check("n'écrit que sur a1 et a3", r1.updates.map((u) => u.id), ["a1", "a3"]);

// 2. onlyEmpty désactivé : écrase
const r2 = planOfferUpdates({
  ...base, onlyEmpty: false, offers,
  rows: [{ id: "a2", URL: "https://backup.com/2" }],
});
check("onlyEmpty=false écrase la valeur existante", r2.summary.toUpdate, 1);

// 3. Cellule CSV vide : n'efface jamais
const r3 = planOfferUpdates({
  ...base, onlyEmpty: false, offers,
  rows: [{ id: "a2", URL: "" }, { id: "a2b", URL: "   " }],
});
check("une cellule vide n'efface pas", r3.summary.toUpdate, 0);

// 4. URL invalide comptée à part
const r4 = planOfferUpdates({
  ...base, offers,
  rows: [{ id: "a1", URL: "N/A" }],
});
check("URL inexploitable signalée", r4.summary.invalidValues, 1);
check("URL inexploitable non écrite", r4.summary.toUpdate, 0);

// 5. Doublons et lignes sans id
const r5 = planOfferUpdates({
  ...base, offers,
  rows: [
    { id: "a1", URL: "https://premier.com" },
    { id: "a1", URL: "https://dernier.com" },
    { id: "", URL: "https://sansid.com" },
  ],
});
check("doublon compté", r5.summary.duplicateId, 1);
check("ligne sans id comptée", r5.summary.missingId, 1);
check("dernière ligne gagnante", r5.updates[0].data.url, "https://dernier.com");

// 6. Champs non associés jamais touchés
const r6 = planOfferUpdates({
  ...base, offers,
  rows: [{ id: "a1", URL: "https://ok.com", Titre: "Nouveau titre" }],
});
check("le titre non mappé n'est pas écrit", Object.keys(r6.updates[0].data), ["url"]);

// 7. Champs personnalisés
const r7 = planOfferUpdates({
  ...base,
  mapping: {},
  customMapping: { note: "Note" },
  customFieldNames: new Set(["note"]),
  offers,
  rows: [{ id: "a1", Note: "ajoutée" }, { id: "a3", Note: "ecrasee?" }],
});
check("champ perso rempli si vide", r7.summary.toUpdate, 1);
check("champ perso existant protégé", r7.summary.skippedFilled, 1);

// 8. Normalisation d'URL sans schéma
check("ajoute https:// si absent", cleanUrl("www.hellowork.com/offre"), "https://www.hellowork.com/offre");
check("rejette une valeur non-URL", cleanUrl("aucune"), null);
check("conserve une URL complète", cleanUrl("http://x.fr/a"), "http://x.fr/a");

// 9. Détail par colonne : le cas qui prêtait à confusion.
// URL vide en base, description déjà remplie, les deux colonnes associées.
const mixteOffers: OfferSnapshot[] = [
  { id: "b1", url: null, description: "Description existante", customValues: "{}" },
  { id: "b2", url: null, description: "Description existante", customValues: "{}" },
];
const r9 = planOfferUpdates({
  ...base,
  mapping: { url: "URL", description: "Description" },
  offers: mixteOffers,
  rows: [
    { id: "b1", URL: "https://a.fr/1", Description: "Autre texte" },
    { id: "b2", URL: "https://a.fr/2", Description: "Autre texte" },
  ],
});
check("les 2 URL vides sont bien à remplir", r9.summary.fieldStats.url.toFill, 2);
check("aucune URL n'est comptée déjà remplie", r9.summary.fieldStats.url.alreadyFilled, 0);
check("les 2 descriptions sont protégées", r9.summary.fieldStats.description.alreadyFilled, 2);
check("les descriptions ne sont pas écrites", r9.summary.fieldStats.description.toFill, 0);
check("les lignes comptent quand même comme à mettre à jour", r9.summary.toUpdate, 2);
check("seule l'url est écrite", Object.keys(r9.updates[0].data), ["url"]);

// 10. Colonne entièrement déjà remplie : rien à faire, et ça se voit par colonne.
const r10 = planOfferUpdates({
  ...base,
  mapping: { description: "Description" },
  offers: mixteOffers,
  rows: [
    { id: "b1", Description: "Autre texte" },
    { id: "b2", Description: "Autre texte" },
  ],
});
check("aucune offre à remplir", r10.summary.toUpdate, 0);
check("le compteur par colonne l'explique", r10.summary.fieldStats.description.alreadyFilled, 2);

// 11. Cellule vide du CSV distinguée d'une valeur déjà en base
const r11 = planOfferUpdates({
  ...base,
  mapping: { url: "URL" },
  offers: mixteOffers,
  rows: [{ id: "b1", URL: "" }, { id: "b2", URL: "https://a.fr/2" }],
});
check("cellule vide comptée à part", r11.summary.fieldStats.url.blankInCsv, 1);
check("l'autre ligne est à remplir", r11.summary.fieldStats.url.toFill, 1);

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
