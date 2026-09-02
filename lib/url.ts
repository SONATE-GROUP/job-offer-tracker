/**
 * Normalise une URL d'offre pour détecter les doublons à l'import : le
 * protocole, le « www. », la casse et un éventuel slash final sont ignorés,
 * pour que deux URL pointant vers la même offre produisent la même clé.
 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}
