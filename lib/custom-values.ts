import { prisma } from "@/lib/prisma";

/**
 * Écrit une seule clé de JobOffer.customValues de façon atomique (json_set en SQL).
 *
 * Lire le JSON, le modifier puis le réécrire en entier perd des données quand
 * plusieurs champs sont écrits en parallèle (ex. deux champs IA générés en même
 * temps) : la dernière écriture écrase l'autre.
 */
export async function setCustomValue(offerId: string, fieldName: string, value: unknown): Promise<void> {
  const path = `$."${fieldName.replace(/["\\]/g, "")}"`;
  const json = JSON.stringify(value === undefined ? null : value);
  await prisma.$executeRawUnsafe(
    `UPDATE "JobOffer" SET "customValues" = json_set(CASE WHEN json_valid("customValues") THEN "customValues" ELSE '{}' END, ?, json(?)) WHERE "id" = ?`,
    path,
    json,
    offerId
  );
}
