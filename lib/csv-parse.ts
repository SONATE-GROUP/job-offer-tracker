/**
 * Analyse un CSV en tenant compte des guillemets, y compris lorsqu'un champ
 * contient des retours à la ligne — cas courant des descriptions d'offres.
 *
 * Le texte est parcouru caractère par caractère plutôt que découpé au préalable
 * sur les sauts de ligne : découper d'abord casserait tout champ multiligne,
 * dont les fragments deviendraient de fausses lignes.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function detectSeparator(text: string): string {
  // Le séparateur est déduit de la ligne d'en-têtes, hors guillemets.
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') index++;
      else inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === "\n") break;
    if (char === ";") semicolons++;
    else if (char === ",") commas++;
  }

  return semicolons > commas ? ";" : ",";
}

/** Découpe le texte en enregistrements, un tableau de cellules par ligne logique. */
export function parseCsvRecords(text: string, separator: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  records.push(row);

  // Une ligne entièrement vide (fin de fichier, ligne blanche) n'est pas une donnée.
  return records.filter((record) => record.some((value) => value.trim() !== ""));
}

export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.trim() === "") return { headers: [], rows: [] };

  const separator = detectSeparator(normalized);
  const records = parseCsvRecords(normalized, separator);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((header) => header.trim()).filter(Boolean);
  if (headers.length === 0) return { headers: [], rows: [] };

  const rows = records.slice(1).map((cells) =>
    headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = (cells[index] ?? "").trim();
      return acc;
    }, {})
  );

  return { headers, rows };
}
