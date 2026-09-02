import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { callAIProvider } from "@/lib/ai-generate";
import { normalizeLinkedinUrl } from "@/lib/linkedin";
import { resolveCompanyIdentity } from "@/lib/company-identity";
import { normalizeUrl } from "@/lib/url";

// Simple in-memory rate limiter: max 60 requests per minute per token
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(token);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

function sanitizeUrl(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  try {
    const url = new URL(str);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return str;
  } catch {
    return null;
  }
}

function sanitizeString(value: unknown, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).slice(0, maxLength);
}

function toPersonNameCase(value: unknown, maxLength = 100): string | null {
  const sanitized = sanitizeString(value, maxLength);
  if (!sanitized) return null;

  return sanitized
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'])\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr-FR"));
}

function normalizeCivility(value: unknown): string | null {
  const sanitized = sanitizeString(value, 20);
  if (!sanitized) return null;

  const lower = sanitized.trim().toLocaleLowerCase("fr-FR");
  if (["m", "m.", "mr", "mr.", "monsieur"].includes(lower)) return "Monsieur";
  if (["mme", "madame", "ms", "ms.", "mrs", "mrs."].includes(lower)) return "Madame";
  return null;
}

function isRecruitingAgencySearch(value: unknown): boolean {
  const searchName = sanitizeString(value, 500);
  return searchName?.toLocaleLowerCase("fr-FR").includes("reverse") ?? false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { webhookToken: token },
    select: {
      id: true,
      aiProvider: true,
      claudeApiKey: true,
      geminiApiKey: true,
      groqApiKey: true,
      openaiApiKey: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Le fournisseur envoie { leads: [...] }
  const leads: Record<string, unknown>[] = Array.isArray(body.leads)
    ? body.leads
    : Array.isArray(body)
    ? body
    : [body];

  const defaultRecruitingAgency = isRecruitingAgencySearch(body.search_name);

  // Offres déjà en base avec une URL : sert à ignorer les leads dont l'offre
  // a déjà été importée, plutôt que de créer un doublon.
  const existingUrlOffers = await prisma.jobOffer.findMany({
    where: { workspaceId: workspace.id, url: { not: null } },
    select: { url: true },
  });
  const seenUrls = new Set(existingUrlOffers.map((o) => normalizeUrl(o.url as string)));

  const created: Awaited<ReturnType<typeof prisma.jobOffer.create>>[] = [];

  for (const lead of leads) {
    const offerUrl = sanitizeUrl(lead.job_offer_url);
    if (offerUrl) {
      const normalizedOfferUrl = normalizeUrl(offerUrl);
      if (seenUrls.has(normalizedOfferUrl)) continue; // offre déjà importée, on ignore ce lead
      seenUrls.add(normalizedOfferUrl);
    }

    const leadLinkedin = sanitizeUrl(lead.lead_linkedin);
    const recruitingAgency =
      "search_name" in lead ? isRecruitingAgencySearch(lead.search_name) : defaultRecruitingAgency;
    const identity = resolveCompanyIdentity(lead, recruitingAgency, { sanitizeString, sanitizeUrl });

    let duplicateWarning: string | null = null;
    if (leadLinkedin) {
      const normalized = normalizeLinkedinUrl(leadLinkedin);
      // SQLite doesn't support case-insensitive URL comparison, so filter in JS
      const existingOffers = await prisma.jobOffer.findMany({
        where: { workspaceId: workspace.id, leadLinkedin: { not: null } },
        select: { toContact: true, contactedAt: true, doNotContact: true, leadLinkedin: true },
      });
      const match = existingOffers.find(
        (o) => o.leadLinkedin && normalizeLinkedinUrl(o.leadLinkedin) === normalized
      );
      if (match) {
        if (match.doNotContact) duplicateWarning = "do_not_contact";
        else if (match.toContact || match.contactedAt) duplicateWarning = "contacted";
        else duplicateWarning = "imported";
      }
    }

    const offer = await prisma.jobOffer.create({
      data: {
        workspaceId: workspace.id,
        title: sanitizeString(lead.job_offer_title) ?? "Sans titre",
        description: sanitizeString(lead.job_offer_description, 10000),
        url: offerUrl,
        company: identity.company ?? "Inconnu",
        agencyName: identity.agencyName,
        linkedinPage: identity.linkedinPage,
        website: identity.website,
        phone: sanitizeString(lead.company_phone, 50),
        headquarters: identity.headquarters,
        offerLocation: sanitizeString(lead.job_offer_location, 500),
        source: sanitizeString(lead.job_offer_source, 200),
        publishedAt: lead.job_creation_date
          ? new Date(String(lead.job_creation_date))
          : null,
        leadCivility: normalizeCivility(lead.lead_civility),
        leadFirstName: toPersonNameCase(lead.lead_first_name),
        leadLastName: toPersonNameCase(lead.lead_last_name),
        leadEmail: sanitizeString(lead.lead_email, 254),
        leadJobTitle: sanitizeString(lead.lead_job_title, 200),
        leadLinkedin,
        leadPhone: sanitizeString(lead.lead_phones, 50),
        recruitingAgency,
        duplicateWarning,
      },
    });
    created.push(offer);
  }

  // Auto-fill IA : exécuté APRÈS la réponse via after() pour ne pas bloquer le
  // webhook, tout en garantissant que la plateforme ne tue pas le traitement
  // (contrairement à un fire-and-forget classique).
  const autoFillFields = await prisma.customFieldDef.findMany({
    where: { workspaceId: workspace.id, type: "AI", autoFill: true },
  });

  if (autoFillFields.length > 0) {
    after(async () => {
      // Concurrence bornée pour ne pas saturer le fournisseur IA (rate-limits)
      // sur les gros imports.
      const CONCURRENCY = 5;
      for (let i = 0; i < created.length; i += CONCURRENCY) {
        const batch = created.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async (offer) => {
            // Une seule lecture/écriture de customValues par offre : on remplit
            // les champs séquentiellement pour éviter d'écraser les autres.
            let customValues: Record<string, unknown> = {};
            try { customValues = JSON.parse(offer.customValues || "{}"); } catch {}
            let changed = false;
            for (const field of autoFillFields) {
              if (!field.formula) continue;
              try {
                customValues[field.name] = await callAIProvider(workspace, field.formula, offer);
                changed = true;
              } catch (e) {
                console.error(`Auto-fill IA [${field.name}] offre ${offer.id}:`, e);
              }
            }
            if (changed) {
              await prisma.jobOffer.update({
                where: { id: offer.id },
                data: { customValues: JSON.stringify(customValues) },
              });
            }
          })
        );
      }
    });
  }

  return NextResponse.json({ received: created.length }, { status: 201 });
}

// Endpoint GET pour vérifier que le webhook est actif
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { webhookToken: token },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  return NextResponse.json({ status: "ok" });
}
