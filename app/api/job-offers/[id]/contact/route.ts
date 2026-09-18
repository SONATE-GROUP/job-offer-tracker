import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedinUrl } from "@/lib/linkedin";

type ContactStatus = "qualify" | "contact" | "doNotContact" | "badContact";

function extractEmeliaCampaignId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Accept direct campaign id
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed;

  // Accept full app URL, e.g. https://app.emelia.io/advanced/<id>/settings
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/advanced\/([a-f0-9]{24})(?:\/|$)/i);
    if (match?.[1]) return match[1];
  } catch {
    // ignore parse errors
  }

  return null;
}

/** Emelia ne renvoie pas toujours l'erreur sous la même clé selon l'endpoint. */
function extractEmeliaErrorMessage(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  const candidate = d.message ?? d.error ?? d.errors;
  if (candidate == null) return null;
  if (Array.isArray(candidate)) {
    const parts = candidate.map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>).message ?? c : c));
    return parts.map(String).join(" ; ");
  }
  if (typeof candidate === "object") return JSON.stringify(candidate);
  return String(candidate);
}

const BAD_CONTACT_NOTIFICATION_EMAIL = "clotilde.mares@sonate.group";
const DASHBOARD_URL = "https://job-offer-tracker.vercel.app/dashboard";

/** Alerte email quand un lead est marqué « Mauvais contact », pour aller en chercher un autre. */
async function notifyBadContact(offer: { leadFirstName: string | null; leadLastName: string | null }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY absente, notification « Mauvais contact » non envoyée.");
    return;
  }

  const fullName = [offer.leadFirstName, offer.leadLastName].filter(Boolean).join(" ") || "Contact inconnu";
  const text = `Mauvais contact : ${fullName}\nIdentifier le bon contact : ${DASHBOARD_URL}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: "Job Offer Tracker <onboarding@resend.dev>",
        to: BAD_CONTACT_NOTIFICATION_EMAIL,
        subject: `Mauvais contact : ${fullName}`,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      console.error(`[Resend] Erreur HTTP ${res.status}:`, detail);
    }
  } catch (err) {
    console.error("[Resend] Erreur de connexion:", err);
  }
}

type EmeliaCampaignInfo = { id: string; provider: string; isAdvanced: boolean } | null;

async function resolveEmeliaCampaign(apiKey: string, nameOrIdOrUrl: string): Promise<EmeliaCampaignInfo> {
  const directId = extractEmeliaCampaignId(nameOrIdOrUrl);
  const inputIsAdvancedUrl = /\/advanced\//i.test(nameOrIdOrUrl);
  const needle = nameOrIdOrUrl.trim().toLowerCase();

  // 1. Try GraphQL all_campaigns (email / LinkedIn campaigns)
  try {
    const res = await fetch("https://graphql.emelia.io/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": apiKey },
      body: JSON.stringify({ query: "query { all_campaigns { _id name provider } }" }),
    });
    if (res.ok) {
      const json = await res.json();
      const campaigns: Array<{ _id?: string; name?: string; provider?: string }> =
        json?.data?.all_campaigns ?? [];
      const match =
        (directId ? campaigns.find((c) => c._id === directId) : null) ??
        campaigns.find((c) => c.name?.trim().toLowerCase() === needle);
      if (match?._id) {
        const provider = match.provider?.toLowerCase() ?? "email";
        const isAdvanced = inputIsAdvancedUrl || provider.includes("advanced");
        return { id: match._id, provider, isAdvanced };
      }
    }
  } catch { /* ignore, try next */ }

  // 2. Try REST advanced campaigns (not returned by GraphQL)
  try {
    const res = await fetch("https://api.emelia.io/advanced/campaigns", {
      headers: { "Authorization": apiKey },
    });
    if (res.ok) {
      const json = await res.json();
      const campaigns: Array<{ _id?: string; name?: string }> = json?.campaigns ?? [];
      const match =
        (directId ? campaigns.find((c) => c._id === directId) : null) ??
        campaigns.find((c) => c.name?.trim().toLowerCase() === needle);
      if (match?._id) {
        return { id: match._id, provider: "advanced", isAdvanced: true };
      }
    }
  } catch { /* ignore */ }

  // 3. Fallback: use direct ID if available
  if (directId) {
    return { id: directId, provider: "unknown", isAdvanced: inputIsAdvancedUrl };
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { status, audience }: { status: ContactStatus; audience?: string } = await req.json();

  if (!["qualify", "contact", "doNotContact", "badContact"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const offer = await prisma.jobOffer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (session.user.role !== "ADMIN" && offer.workspaceId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const updated = await prisma.jobOffer.update({
    where: { id },
    data: {
      toContact: status === "contact",
      doNotContact: status === "doNotContact",
      badContact: status === "badContact",
      contactedAt: status === "contact" ? new Date() : null,
      lgmAudience: status === "contact" ? (audience ?? null) : null,
    },
  });

  if (status === "contact" && !offer.lgmSent) {
    const [workspace, customFields] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: offer.workspaceId } }),
      prisma.customFieldDef.findMany({ where: { workspaceId: offer.workspaceId } }),
    ]);

    const prospectingProvider = workspace?.prospectingProvider ?? "lgm";

    let targetAudience = audience ?? null;
    let providerError: string | null = null;

    if (prospectingProvider === "emelia") {
      if (!targetAudience && workspace?.emeliaCampaigns) {
        try {
          const camps: string[] = JSON.parse(workspace.emeliaCampaigns);
          if (camps.length > 0) targetAudience = camps[0];
        } catch {}
      }

      const campaign = targetAudience && workspace?.emeliApiKey
        ? await resolveEmeliaCampaign(workspace.emeliApiKey, targetAudience)
        : null;

      if (!workspace?.emeliApiKey) {
        providerError = "Clé API Emelia manquante dans les paramètres workspace.";
      } else if (!targetAudience) {
        providerError = "Aucune campagne Emelia configurée dans les paramètres workspace.";
      } else if (!campaign) {
        providerError = `Campagne Emelia introuvable : "${targetAudience}". Vérifiez le nom, l'ID ou l'URL dans les paramètres.`;
      } else {
        const campaignId = campaign.id;

        // Build custom fields
        const customValues = JSON.parse(offer.customValues || "{}");
        const emeliCustom: Record<string, string> = {};
        // Entreprise and Civilite come from offer fields — reserve them to avoid duplicates
        const emeliaReservedCustomFields = new Set(["Entreprise", "Civilite"]);
        for (const field of customFields) {
          if (!field.emeliAttribute) continue;
          const val = customValues[field.name];
          if (val == null || val === "") continue;
          if (emeliaReservedCustomFields.has(field.emeliAttribute)) continue;
          emeliCustom[field.emeliAttribute] = String(val);
        }
        if (offer.company) emeliCustom.Entreprise = offer.company;
        if (offer.leadCivility) emeliCustom.Civilite = offer.leadCivility;

        try {
          if (campaign.isAdvanced) {
            // Advanced campaign: REST endpoint POST /advanced/campaign/contacts
            // Rules confirmed by production tests:
            // - id (not campaignId) at root
            // - linkedinUrlProfile (not linkedinUrl)
            // - custom fields flat inside contact (no nested customFields object)
            console.log(`[Emelia] Envoi contact (advanced) — campagne: ${campaignId}`);

            const contact: Record<string, unknown> = {
              ...(offer.leadFirstName && { firstName: offer.leadFirstName }),
              ...(offer.leadLastName && { lastName: offer.leadLastName }),
              ...(offer.leadEmail && { email: offer.leadEmail }),
              ...(offer.leadLinkedin && { linkedinUrlProfile: offer.leadLinkedin }),
              // Custom fields flat at contact root (nested customFields object causes API error)
              ...emeliCustom,
            };

            const res = await fetch("https://api.emelia.io/advanced/campaign/contacts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": workspace.emeliApiKey,
              },
              body: JSON.stringify({ id: campaignId, contact }),
            });

            if (res.ok) {
              const json = await res.json().catch(() => null);
              const emeliContactId = json?.id ? String(json.id) : undefined;
              await prisma.jobOffer.update({
                where: { id },
                data: { lgmSent: true, lgmSentAt: new Date(), ...(emeliContactId ? { lgmLeadId: emeliContactId } : {}) },
              });
            } else {
              const detail = await res.json().catch(() => null);
              console.error(`[Emelia Advanced] Erreur HTTP ${res.status}:`, detail);
              const detailMessage = extractEmeliaErrorMessage(detail);
              providerError = detailMessage
                ? `Emelia: ${detailMessage}`
                : `Emelia a répondu avec une erreur HTTP ${res.status}.`;
            }
          } else {
            // Email or LinkedIn campaign: GraphQL
            const isLinkedin = campaign.provider === "linkedin";
            const mutationName = isLinkedin ? "addContactToLinkedInCampaignHook" : "addContactToCampaignHook";

            console.log(`[Emelia] Envoi contact — campagne: ${campaignId} (provider: ${campaign.provider}, mutation: ${mutationName})`);

            const contactPayload: Record<string, unknown> = {
              ...(offer.leadFirstName && { firstName: offer.leadFirstName }),
              ...(offer.leadLastName && { lastName: offer.leadLastName }),
              ...(offer.leadEmail && { email: offer.leadEmail }),
              ...(offer.leadLinkedin && { linkedinUrlProfile: offer.leadLinkedin }),
              ...(offer.leadLinkedin && { linkedinUrl: offer.leadLinkedin }),
              ...(Object.keys(emeliCustom).length > 0 && { custom: emeliCustom }),
            };

            const res = await fetch("https://graphql.emelia.io/graphql", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": workspace.emeliApiKey,
              },
              body: JSON.stringify({
                query: `mutation emeliaMutation($id: ID!, $contact: JSON!) { ${mutationName}(id: $id, contact: $contact) }`,
                variables: { id: campaignId, contact: contactPayload },
              }),
            });

            if (res.ok) {
              let emeliContactId: string | undefined;
              try {
                const json = await res.json();
                if (Array.isArray(json?.errors) && json.errors.length > 0) {
                  const firstError = json.errors[0]?.message;
                  const errorMsg = firstError ? String(firstError) : "";
                  const isEmailError = /invalid.?email|email.?invalid|email.?required/i.test(errorMsg);
                  if (isEmailError && !offer.leadEmail) {
                    console.warn("[Emelia] Email absent ignoré — lead marqué envoyé sans email.");
                  } else {
                    providerError = errorMsg ? `Emelia: ${errorMsg}` : "Emelia a renvoyé une erreur GraphQL.";
                  }
                } else if (json?.data?.[mutationName]) {
                  emeliContactId = String(json.data[mutationName]);
                }
              } catch {}
              if (!providerError) {
                await prisma.jobOffer.update({
                  where: { id },
                  data: { lgmSent: true, lgmSentAt: new Date(), ...(emeliContactId ? { lgmLeadId: emeliContactId } : {}) },
                });
              }
            } else {
              const detail = await res.json().catch(() => null);
              console.error(`[Emelia] Erreur HTTP ${res.status}:`, detail);
              const detailMessage = extractEmeliaErrorMessage(detail);
              providerError = detailMessage
                ? `Emelia: ${detailMessage}`
                : `Emelia a répondu avec une erreur HTTP ${res.status}.`;
            }
          }
        } catch (err) {
          console.error("[Emelia] Erreur de connexion:", err);
          providerError = "Erreur de connexion à Emelia.";
        }
      }
    } else {
      // Provider: lgm (default)
      if (!targetAudience && workspace?.lgmAudiences) {
        try {
          const audiences: string[] = JSON.parse(workspace.lgmAudiences);
          if (audiences.length > 0) targetAudience = audiences[0];
        } catch {}
      }
      if (!targetAudience) targetAudience = workspace?.lgmCampaignId ?? null;

      if (workspace?.lgmApiKey && targetAudience) {
        try {
          const body = new URLSearchParams();
          body.set("audience", targetAudience);
          if (offer.leadFirstName) body.set("firstname", offer.leadFirstName);
          if (offer.leadLastName) body.set("lastname", offer.leadLastName);
          if (offer.leadCivility) {
            const lower = offer.leadCivility.trim().toLowerCase();
            const gender = (lower === "mme" || lower === "madame") ? "woman" : "man";
            body.set("gender", gender);
          }
          if (offer.leadEmail) body.set("proEmail", offer.leadEmail);
          if (offer.leadPhone) body.set("phone", offer.leadPhone);
          if (offer.leadLinkedin) body.set("linkedinUrl", offer.leadLinkedin);
          if (offer.leadJobTitle) body.set("jobTitle", offer.leadJobTitle);
          if (offer.company) body.set("companyName", offer.company);
          if (offer.website) body.set("companyUrl", offer.website);

          if (customFields.length > 0) {
            const customValues = JSON.parse(offer.customValues || "{}");
            for (const field of customFields) {
              const val = customValues[field.name];
              if (val != null && val !== "" && field.lgmAttribute) body.set(field.lgmAttribute, String(val));
            }
          }

          const res = await fetch(`https://apiv2.lagrowthmachine.com/flow/leads?apikey=${encodeURIComponent(workspace.lgmApiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });

          if (res.ok) {
            let lgmLeadId: string | undefined;
            try {
              const json = await res.json();
              if (json?.id) lgmLeadId = String(json.id);
            } catch {}
            await prisma.jobOffer.update({
              where: { id },
              data: { lgmSent: true, lgmSentAt: new Date(), ...(lgmLeadId ? { lgmLeadId } : {}) },
            });
          }
        } catch (err) {
          console.error("Erreur LGM:", err);
        }
      }
    }

    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 502 });
    }
  }

  if (status === "badContact") {
    await notifyBadContact(offer);
  }

  // Cascade duplicateWarning to all offers sharing the same linkedinUrl
  if (offer.leadLinkedin) {
    const normalized = normalizeLinkedinUrl(offer.leadLinkedin);
    const candidates = await prisma.jobOffer.findMany({
      where: { workspaceId: offer.workspaceId, leadLinkedin: { not: null } },
      select: { id: true, leadLinkedin: true, toContact: true, doNotContact: true, contactedAt: true },
    });
    const group = candidates.filter(
      (o) => o.leadLinkedin && normalizeLinkedinUrl(o.leadLinkedin) === normalized
    );
    if (group.length > 1) {
      await Promise.all(
        group.map((o) => {
          const siblings = group.filter((s) => s.id !== o.id);
          let warning: string | null = null;
          if (siblings.some((s) => s.doNotContact)) warning = "do_not_contact";
          else if (siblings.some((s) => s.toContact || s.contactedAt)) warning = "contacted";
          else warning = "imported";
          return prisma.jobOffer.update({ where: { id: o.id }, data: { duplicateWarning: warning } });
        })
      );
    }
  }

  return NextResponse.json(updated);
}
