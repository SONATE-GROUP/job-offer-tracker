import { parseCsv } from "../lib/csv-parse";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`✗ ${name}\n    attendu ${e}\n    obtenu  ${a}`); }
  else console.log(`✓ ${name}`);
}

// 1. Le cas qui cassait : une description sur plusieurs lignes.
const multiline = [
  'id,title,description,url',
  'cmqr51ifd0002,Magasinier Cariste H/F,"Les missions du poste',
  '',
  'Festou Intérim est une entreprise qui recrute',
  'des profils qui bénéficient en priorité de nos offres.',
  '',
  'Rémunération et avantages Festou',
  '- 11% IFM",https://exemple.fr/offre',
  'cmqr51ifd0003,Chef d\'équipe,Description simple,https://exemple.fr/2',
].join("\n");

const r1 = parseCsv(multiline);
check("2 lignes, pas 8", r1.rows.length, 2);
check("id de la 1re ligne intact", r1.rows[0].id, "cmqr51ifd0002");
check("url de la 1re ligne intacte", r1.rows[0].url, "https://exemple.fr/offre");
check("id de la 2e ligne intact", r1.rows[1].id, "cmqr51ifd0003");
check("description multiligne conservée en entier",
  r1.rows[0].description.includes("Festou Intérim") && r1.rows[0].description.includes("11% IFM"), true);

// 2. Guillemets échappés
const quoted = 'id,title\n1,"Poste dit ""senior"" H/F"';
check("guillemets doublés décodés", parseCsv(quoted).rows[0].title, 'Poste dit "senior" H/F');

// 3. Séparateur point-virgule (export Excel FR)
const semi = 'id;title;url\n1;Cariste;https://x.fr/a';
check("séparateur ; détecté", parseCsv(semi).rows[0].url, "https://x.fr/a");

// 4. Virgule à l'intérieur d'un champ entre guillemets
const comma = 'id,title,url\n1,"Cariste, Magasinier",https://x.fr/a';
check("virgule protégée par les guillemets", parseCsv(comma).rows[0].title, "Cariste, Magasinier");
check("colonne suivante non décalée", parseCsv(comma).rows[0].url, "https://x.fr/a");

// 5. Fins de ligne Windows et ligne finale vide
const crlf = 'id,url\r\n1,https://x.fr/a\r\n';
check("CRLF géré, pas de ligne fantôme", parseCsv(crlf).rows.length, 1);
check("valeur non polluée par le \\r", parseCsv(crlf).rows[0].url, "https://x.fr/a");

// 6. Point-virgule dans une description, fichier séparé par des virgules
const mixed = 'id,description,url\n1,"a; b; c",https://x.fr/a';
check("séparateur déduit des en-têtes, pas du contenu", parseCsv(mixed).rows[0].description, "a; b; c");

// 7. Fichier vide ou sans en-têtes
check("texte vide", parseCsv("").rows.length, 0);
check("en-têtes seuls", parseCsv("id,url").rows.length, 0);

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
