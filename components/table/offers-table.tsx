"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { AddCustomFieldModal } from "@/components/forms/add-custom-field-modal";
import { EditCustomFieldPromptModal } from "@/components/forms/edit-custom-field-prompt-modal";
import { ImportCsvModal } from "@/components/forms/import-csv-modal";

interface CustomField {
  id: string;
  name: string;
  label: string;
  type: string;
  formula?: string | null;
  lgmAttribute?: string | null;
  autoFill?: boolean;
}

interface JobOffer {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  company: string;
  linkedinPage: string | null;
  website: string | null;
  phone: string | null;
  headquarters: string | null;
  offerLocation: string | null;
  source: string | null;
  publishedAt: string | null;
  receivedAt: string;
  leadCivility: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadEmail: string | null;
  leadJobTitle: string | null;
  leadLinkedin: string | null;
  leadPhone: string | null;
  toContact: boolean;
  recruitingAgency: boolean;
  doNotContact: boolean;
  contactedAt: string | null;
  lgmSent: boolean;
  lgmSentAt: string | null;
  lgmAudience: string | null;
  phoneLookupRequested: boolean;
  enrichedPhone: string | null;
  apolloEnrichmentStatus: string;
  lgmMessagesSent: number | null;
  callRequested: boolean;
  lgmEmailOpened: number | null;
  lgmConnectionSentAt: string | null;
  lgmConnectionAcceptedAt: string | null;
  lgmMessage1SentAt: string | null;
  lgmRepliedAt: string | null;
  lgmReplyContent: string | null;
  customValues: Record<string, unknown>;
  duplicateWarning: string | null;
}

interface Stats {
  all: number;
  toContact: number;
  doNotContact: number;
  qualify: number;
}

interface OffersTableProps {
  customFields: CustomField[];
  targetWorkspaceId?: string;
  campaigns: string[];
}

const FIXED_COLUMNS = [
  { key: "toContact", label: "CONTACTER", defaultWidth: 160 },
  { key: "recruitingAgency", label: "Cabinet recrutement", defaultWidth: 150 },
  { key: "title", label: "Offre d'emploi", defaultWidth: 220 },
  { key: "url", label: "URL de l'offre", defaultWidth: 220 },
  { key: "description", label: "Description", defaultWidth: 250 },
  { key: "company", label: "Entreprise", defaultWidth: 180 },
  { key: "linkedinPage", label: "LinkedIn entreprise", defaultWidth: 150 },
  { key: "website", label: "Site web", defaultWidth: 150 },
  { key: "phone", label: "Tél. entreprise", defaultWidth: 130 },
  { key: "headquarters", label: "Siège social", defaultWidth: 150 },
  { key: "offerLocation", label: "Localisation", defaultWidth: 130 },
  { key: "source", label: "Source", defaultWidth: 100 },
  { key: "publishedAt", label: "Date offre", defaultWidth: 110 },
  { key: "receivedAt", label: "Date réception", defaultWidth: 130 },
  { key: "leadName", label: "Lead", defaultWidth: 150 },
  { key: "leadCivility", label: "Civilité", defaultWidth: 90 },
  { key: "leadFirstName", label: "Prénom lead", defaultWidth: 120 },
  { key: "leadLastName", label: "Nom lead", defaultWidth: 120 },
  { key: "leadEmail", label: "Email lead", defaultWidth: 180 },
  { key: "leadJobTitle", label: "Métier lead", defaultWidth: 140 },
  { key: "leadLinkedin", label: "LinkedIn lead", defaultWidth: 150 },
  { key: "leadPhone", label: "Tél. lead", defaultWidth: 130 },
  { key: "phoneLookupRequested", label: "Chercher tél.", defaultWidth: 120 },
  { key: "enrichedPhone", label: "Numéro de téléphone", defaultWidth: 170 },
  { key: "lgmSent", label: "Envoi dans LGM", defaultWidth: 140 },
  { key: "callRequested", label: "Appeler 📞", defaultWidth: 130 },
  { key: "lgmMessagesSent", label: "Messages envoyés", defaultWidth: 130 },
  { key: "lgmEmailOpened", label: "Ouvertures email", defaultWidth: 130 },
  { key: "lgmConnectionSentAt", label: "Connexion envoyée", defaultWidth: 150 },
  { key: "lgmConnectionAcceptedAt", label: "Connexion acceptée", defaultWidth: 155 },
  { key: "lgmMessage1SentAt", label: "Message 1 envoyé", defaultWidth: 150 },
  { key: "lgmRepliedAt", label: "Réponse reçue", defaultWidth: 140 },
  { key: "lgmReplyContent", label: "Contenu réponse", defaultWidth: 220 },
];

// Colonnes cachées par défaut (nouvelles colonnes Mantiks)
const DEFAULT_HIDDEN_COLS = new Set([
  "url", "description", "linkedinPage", "website", "phone", "headquarters",
  "receivedAt", "leadCivility", "leadFirstName", "leadLastName", "leadLinkedin", "leadPhone", "lgmSent",
  "lgmConnectionSentAt", "lgmConnectionAcceptedAt", "lgmMessage1SentAt", "lgmRepliedAt", "lgmReplyContent",
]);
const HIDDEN_COL_VERSION = "v1";

const CUSTOM_FIELD_DEFAULT_WIDTH = 130;

function toProperCase(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  return str.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normalizeCivility(civility: string | null | undefined): string | null {
  if (!civility) return null;
  const lower = civility.trim().toLowerCase();
  if (lower === "m" || lower === "m." || lower === "mr" || lower === "mr." || lower === "monsieur") return "Monsieur";
  if (lower === "mme" || lower === "madame" || lower === "ms" || lower === "ms." || lower === "mrs" || lower === "mrs.") return "Madame";
  return civility;
}

function stickyBg(offer: JobOffer): string {
  if (offer.doNotContact) return "#fef2f2"; // red-50 opaque
  if (offer.toContact) return "#e9f8ec"; // brand-green/10 over white, opaque
  return "#ffffff";
}

function evalFormula(formula: string, offer: JobOffer): string {
  return formula.replace(/\{(\w+)\}/g, (_, key) => {
    const val = (offer as unknown as Record<string, unknown>)[key];
    if (val == null) return "";
    if (key === "publishedAt" && typeof val === "string") {
      return new Date(val).toLocaleDateString("fr-FR");
    }
    return String(val);
  });
}

export function OffersTable({ customFields: initialCustomFields, targetWorkspaceId, campaigns }: OffersTableProps) {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialCustomFields);
  const [showAddField, setShowAddField] = useState(false);
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [editingPromptField, setEditingPromptField] = useState<CustomField | null>(null);
  const [urlError, setUrlError] = useState<Record<string, string>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState<Set<string>>(new Set());
  const [syncingLgm, setSyncingLgm] = useState(false);

  // Sort & filter
  const [sortBy, setSortBy] = useState("receivedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());

  // Column visibility & widths — loaded from localStorage on mount
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const LIMIT = 50;

  // Load preferences from localStorage
  useEffect(() => {
    const savedHidden = localStorage.getItem("jot_hidden_cols");
    const savedVersion = localStorage.getItem("jot_hidden_cols_v");
    if (savedHidden && savedVersion === HIDDEN_COL_VERSION) {
      setHiddenColumns(new Set(JSON.parse(savedHidden)));
    } else {
      // Première visite ou nouvelle version : fusionner avec les défauts
      const base = savedHidden ? new Set<string>(JSON.parse(savedHidden)) : new Set<string>();
      setHiddenColumns(new Set([...base, ...DEFAULT_HIDDEN_COLS]));
      localStorage.setItem("jot_hidden_cols_v", HIDDEN_COL_VERSION);
    }
    const savedWidths = localStorage.getItem("jot_col_widths");
    if (savedWidths) setColWidths(JSON.parse(savedWidths));
  }, []);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem("jot_hidden_cols", JSON.stringify([...hiddenColumns]));
  }, [hiddenColumns]);

  useEffect(() => {
    localStorage.setItem("jot_col_widths", JSON.stringify(colWidths));
  }, [colWidths]);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu) return;
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnMenu]);

  const fetchOffers = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        sortBy,
        sortDir,
        ...(search ? { search } : {}),
        ...(filterStatuses.size > 0 ? { filterStatus: [...filterStatuses].join(",") } : {}),
        ...(targetWorkspaceId ? { targetWorkspaceId } : {}),
      });
      const res = await fetch(`/api/job-offers?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setOffers(json.data ?? []);
      setTotal(json.total ?? 0);
      setStats(json.stats ?? null);
    } catch {
      if (!silent) {
        setOffers([]);
        setTotal(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, search, sortBy, sortDir, filterStatuses, targetWorkspaceId]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Polling pour les enrichissements Apollo en cours
  useEffect(() => {
    const hasPending = offers.some((o) => o.apolloEnrichmentStatus === "pending");
    if (!hasPending) return;
    const interval = setInterval(() => { void fetchOffers({ silent: true }); }, 10000);
    return () => clearInterval(interval);
  }, [offers, fetchOffers]);

  async function setContactStatus(id: string, status: "qualify" | "contact" | "doNotContact", audience?: string) {
    const prevOffer = offers.find((o) => o.id === id);
    if (!prevOffer) return;

    const prevStatus = prevOffer.doNotContact ? "doNotContact" : prevOffer.toContact ? "contact" : "qualify";

    // Update optimiste immédiat
    setOffers((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              toContact: status === "contact",
              doNotContact: status === "doNotContact",
              lgmAudience: status === "contact" ? (audience ?? null) : null,
            }
          : o
      )
    );
    if (stats && prevStatus !== status) {
      setStats({
        ...stats,
        toContact: stats.toContact + (status === "contact" ? 1 : 0) - (prevStatus === "contact" ? 1 : 0),
        doNotContact: stats.doNotContact + (status === "doNotContact" ? 1 : 0) - (prevStatus === "doNotContact" ? 1 : 0),
        qualify: stats.qualify + (status === "qualify" ? 1 : 0) - (prevStatus === "qualify" ? 1 : 0),
      });
    }

    // Appel API en arrière-plan
    const res = await fetch(`/api/job-offers/${id}/contact`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, audience }),
    });

    // Revert si erreur
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      setOffers((prev) => prev.map((o) => (o.id === id ? prevOffer : o)));
      if (stats) setStats(stats);
      if (errorData?.error) {
        alert(String(errorData.error));
      }
    }
  }

  async function updateCustomValue(offerId: string, fieldName: string, value: unknown) {
    await fetch(`/api/job-offers/${offerId}/custom-values`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, value }),
    });
    setOffers((prev) =>
      prev.map((o) =>
        o.id === offerId ? { ...o, customValues: { ...o.customValues, [fieldName]: value } } : o
      )
    );
  }

  async function updateLeadField(offerId: string, field: "leadCivility" | "leadFirstName" | "leadLastName", value: string | null) {
    await fetch(`/api/job-offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, [field]: value } : o))
    );
  }

  async function updateOfferUrl(offerId: string, value: string, input: HTMLInputElement) {
    const current = offers.find((o) => o.id === offerId)?.url ?? "";
    const trimmed = value.trim();
    if (trimmed === current) return;

    const res = await fetch(`/api/job-offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!res.ok) {
      setUrlError((prev) => ({ ...prev, [offerId]: "URL invalide" }));
      input.value = current;
      return;
    }

    const updated = await res.json();
    setUrlError((prev) => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });
    input.value = updated.url ?? "";
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, url: updated.url ?? null } : o))
    );
  }

  async function generateAIValue(offerId: string, field: CustomField) {
    const key = `${offerId}-${field.id}`;
    setAiGenerating((prev) => new Set([...prev, key]));
    try {
      const res = await fetch(`/api/job-offers/${offerId}/ai-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: field.id, prompt: field.formula }),
      });
      if (res.ok) {
        const { value } = await res.json();
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId
              ? { ...o, customValues: { ...o.customValues, [field.name]: value } }
              : o
          )
        );
      }
    } finally {
      setAiGenerating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function updatePhoneEnrichment(offerId: string, payload: { phoneLookupRequested?: boolean; enrichedPhone?: string | null }) {
    const res = await fetch(`/api/job-offers/${offerId}/phone-enrichment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;

    const updated = await res.json();
    setOffers((prev) =>
      prev.map((o) =>
        o.id === offerId
          ? {
              ...o,
              phoneLookupRequested:
                typeof updated.phoneLookupRequested === "boolean"
                  ? updated.phoneLookupRequested
                  : o.phoneLookupRequested,
              enrichedPhone:
                updated.enrichedPhone !== undefined ? updated.enrichedPhone : o.enrichedPhone,
              apolloEnrichmentStatus: updated.apolloEnrichmentStatus ?? o.apolloEnrichmentStatus,
            }
          : o
      )
    );

    // Déclencher l'enrichissement Apollo si la case vient d'être cochée
    if (payload.phoneLookupRequested === true) {
      setOffers((prev) =>
        prev.map((o) => o.id === offerId ? { ...o, apolloEnrichmentStatus: "pending" } : o)
      );
      fetch(`/api/job-offers/${offerId}/enrich-phone`, { method: "POST" }).catch(() => {
        setOffers((prev) =>
          prev.map((o) => o.id === offerId ? { ...o, apolloEnrichmentStatus: "failed" } : o)
        );
      });
    }
  }

  async function updateRecruitingAgency(offerId: string, value: boolean) {
    setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, recruitingAgency: value } : o));
    await fetch(`/api/job-offers/${offerId}/boolean-field`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "recruitingAgency", value }),
    });
  }

  async function deleteCustomField(fieldId: string) {
    if (!confirm("Supprimer ce champ ? Les données associées seront perdues.")) return;
    const res = await fetch(`/api/custom-fields/${fieldId}`, { method: "DELETE" });
    if (res.ok) setCustomFields((prev) => prev.filter((f) => f.id !== fieldId));
  }

  async function handleCsvImported(count: number, mode: "create" | "update") {
    setShowImportCsv(false);
    setPage(1);
    await fetchOffers({ silent: true });
    alert(
      mode === "update"
        ? `${count} offre${count > 1 ? "s" : ""} mise${count > 1 ? "s" : ""} à jour.`
        : `${count} ligne${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}.`
    );
  }

  async function syncLgmStats() {
    setSyncingLgm(true);
    try {
      await fetch("/api/lgm/sync-stats", { method: "POST" });
      await fetchOffers({ silent: true });
    } finally {
      setSyncingLgm(false);
    }
  }

  async function deleteOffer(id: string) {
    if (!confirm("Supprimer cette offre ?")) return;
    const res = await fetch(`/api/job-offers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOffers((prev) => prev.filter((o) => o.id !== id));
      setTotal((t) => t - 1);
    }
  }

  function handleExportCsv() {
    // N'exporter que les colonnes visibles, dans le même ordre que le tableau.
    const visibleColumnKeys = [
      ...FIXED_COLUMNS.filter((c) => !hiddenColumns.has(c.key)).map((c) => c.key),
      ...customFields.filter((f) => !hiddenColumns.has(f.id)).map((f) => f.id),
    ];
    const params = new URLSearchParams({
      format: "csv",
      sortBy,
      sortDir,
      columns: visibleColumnKeys.join(","),
      ...(search ? { search } : {}),
      ...(filterStatuses.size > 0 ? { filterStatus: [...filterStatuses].join(",") } : {}),
      ...(targetWorkspaceId ? { targetWorkspaceId } : {}),
    });
    window.open(`/api/job-offers?${params}`, "_blank");
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleResizeMouseDown(e: React.MouseEvent<HTMLDivElement>, colKey: string) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement as HTMLTableCellElement;
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveE: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (moveE.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function getColWidth(key: string, defaultWidth: number): number {
    return colWidths[key] ?? defaultWidth;
  }

  const totalPages = Math.ceil(total / LIMIT);

  const visibleFixed = FIXED_COLUMNS.filter((c) => !hiddenColumns.has(c.key));
  const visibleCustom = customFields.filter((f) => !hiddenColumns.has(f.id));
  const visibleCount = visibleFixed.length + visibleCustom.length + 1; // +1 for delete col

  const allColumnsForMenu = [
    ...FIXED_COLUMNS,
    ...customFields.map((f) => ({ key: f.id, label: f.label, defaultWidth: CUSTOM_FIELD_DEFAULT_WIDTH })),
  ];

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-4 flex-wrap">
          <StatBadge label="Total" value={stats.all} color="gray" />
          <StatBadge label="À qualifier" value={stats.qualify} color="gray" />
          <StatBadge label="Contacté" value={stats.toContact} color="green" />
          <StatBadge label="Ne pas contacter" value={stats.doNotContact} color="red" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher offre, entreprise, lead..."
            className="border border-gray-300 px-3 py-2 text-sm w-72 text-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-pink"
          />
          <button
            type="submit"
            className="bg-brand-pink text-brand-dark px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Rechercher
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="text-sm text-gray-500 hover:text-brand-dark px-2"
            >
              ✕
            </button>
          )}
        </form>

        {/* Filter: multi-select statuses */}
        <div className="flex items-center gap-3 border border-gray-300 px-3 py-2 bg-white text-sm text-brand-dark">
          <span className="text-gray-500 shrink-0">Filtre :</span>
          {[
            { key: "qualify", label: "À qualifier" },
            { key: "contact", label: "Contacté" },
            { key: "doNotContact", label: "Ne pas contacter" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={filterStatuses.has(key)}
                onChange={() => {
                  setFilterStatuses((prev) => {
                    const next = new Set(prev);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  });
                  setPage(1);
                }}
                style={{ accentColor: "#FFBEFA" }}
                className="w-3.5 h-3.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {total} offre{total > 1 ? "s" : ""}
          </span>

          {/* Column visibility menu */}
          <div className="relative" ref={columnMenuRef}>
            <button
              onClick={() => setShowColumnMenu((v) => !v)}
              className="text-sm border border-gray-300 px-3 py-2 hover:bg-white text-brand-dark flex items-center gap-1.5 transition-colors"
            >
              <span>⊞</span> Colonnes
              {hiddenColumns.size > 0 && (
                <span className="bg-brand-pink text-brand-dark text-xs w-4 h-4 flex items-center justify-center font-medium">
                  {hiddenColumns.size}
                </span>
              )}
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg p-3 z-20 min-w-[210px]">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Afficher / masquer
                </p>
                {allColumnsForMenu.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{ accentColor: "#FFBEFA" }}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-sm text-brand-dark">{col.label}</span>
                  </label>
                ))}
                {hiddenColumns.size > 0 && (
                  <button
                    onClick={() => setHiddenColumns(new Set())}
                    className="mt-2 w-full text-xs text-gray-500 hover:text-brand-dark text-left px-1"
                  >
                    Tout afficher
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowImportCsv(true)}
            className="text-sm border border-gray-300 px-3 py-2 hover:bg-white text-brand-dark flex items-center gap-1 transition-colors"
            title="Importer des offres depuis un fichier CSV"
          >
            ↑ Import CSV
          </button>

          <button
            onClick={() => setShowAddField(true)}
            className="text-sm border border-gray-300 px-3 py-2 hover:bg-white text-brand-dark flex items-center gap-1 transition-colors"
          >
            + Champ personnalisé
          </button>

          <button
            onClick={() => void syncLgmStats()}
            disabled={syncingLgm}
            className="text-sm border border-gray-300 px-3 py-2 hover:bg-white text-brand-dark flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Synchroniser les stats LGM (messages envoyés, ouvertures)"
          >
            {syncingLgm ? "Synchro…" : "↻ Stats LGM"}
          </button>

          <button
            onClick={handleExportCsv}
            className="text-sm border border-gray-300 px-3 py-2 hover:bg-white text-brand-dark flex items-center gap-1 transition-colors"
            title="Exporter le tableau en CSV"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 bg-white shadow-sm">
        <table
          className="text-sm border-collapse"
          style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
        >
          <thead>
            <tr className="bg-brand-dark border-b border-gray-800">
              {/* delete placeholder col */}
              <th
                style={{ width: 36, position: "sticky", left: 0, zIndex: 3, background: "#232323" }}
                className="px-1 py-3"
              />
              {visibleFixed.map((col) => {
                const sortable = ["title", "company", "offerLocation", "source", "publishedAt", "receivedAt"].includes(col.key);
                const active = sortBy === col.key;
                const isSticky = col.key === "toContact";
                return (
                  <th
                    key={col.key}
                    style={{
                      width: getColWidth(col.key, col.defaultWidth),
                      position: isSticky ? "sticky" : "relative",
                      left: isSticky ? 36 : undefined,
                      zIndex: isSticky ? 3 : undefined,
                      background: isSticky ? "#232323" : undefined,
                    }}
                    className="text-left px-3 py-3 font-medium text-white whitespace-nowrap select-none"
                  >
                    {sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-brand-pink transition-colors"
                      >
                        {col.label}
                        <span className="text-xs opacity-60">
                          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    ) : (
                      col.label
                    )}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-pink/60 transition-colors"
                    />
                  </th>
                );
              })}
              {visibleCustom.map((field) => (
                <th
                  key={field.id}
                  style={{
                    width: getColWidth(field.id, CUSTOM_FIELD_DEFAULT_WIDTH),
                    position: "relative",
                  }}
                  className="text-left px-3 py-3 font-medium text-white whitespace-nowrap select-none"
                >
                  <span className="flex items-center gap-1 pr-3">
                    {field.type === "AI" && <span title="Champ IA">⚡</span>}
                    {field.type === "FORMULA" && <span title="Champ formule">ƒ</span>}
                    {field.label}
                    {(field.type === "AI" || field.type === "FORMULA") && (
                      <button
                        onClick={() => setEditingPromptField(field)}
                        className="text-white/30 hover:text-white ml-1 text-xs"
                        title={field.type === "AI" ? "Modifier le prompt IA" : "Modifier la formule"}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      onClick={() => deleteCustomField(field.id)}
                      className="text-white/30 hover:text-red-400 ml-1 text-xs"
                      title="Supprimer ce champ"
                    >
                      ✕
                    </button>
                  </span>
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, field.id)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-pink/60 transition-colors"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleCount} className="px-3 py-8 text-center text-gray-400">
                  Chargement...
                </td>
              </tr>
            ) : offers.length === 0 ? (
              <tr>
                <td colSpan={visibleCount} className="px-3 py-8 text-center text-gray-400">
                  Aucune offre. Les données arrivent via votre webhook.
                </td>
              </tr>
            ) : (
              offers.map((offer) => (
                <>
                  <tr
                    key={offer.id}
                    className={cn(
                      "group border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer",
                      offer.toContact && "bg-[#26B743]/10",
                      offer.doNotContact && "bg-red-50"
                    )}
                    onClick={() => setExpandedRow(expandedRow === offer.id ? null : offer.id)}
                  >
                    {/* Delete button */}
                    <td
                      className="px-1 py-3 text-center"
                      style={{ position: "sticky", left: 0, zIndex: 2, background: stickyBg(offer) }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => deleteOffer(offer.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xs w-5 h-5 flex items-center justify-center"
                        title="Supprimer cette offre"
                      >
                        ✕
                      </button>
                    </td>

                    {/* toContact — audience dropdown (sticky) */}
                    {!hiddenColumns.has("toContact") && (
                      <td
                        className="px-3 py-3"
                        style={{ position: "sticky", left: 36, zIndex: 2, background: stickyBg(offer) }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AudienceDropdownCell
                          offer={offer}
                          campaigns={campaigns}
                          onSet={setContactStatus}
                        />
                      </td>
                    )}

                    {/* recruitingAgency */}
                    {!hiddenColumns.has("recruitingAgency") && (
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={offer.recruitingAgency}
                          onChange={(e) => {
                            void updateRecruitingAgency(offer.id, e.target.checked);
                          }}
                          className="w-4 h-4 cursor-pointer"
                          style={{ accentColor: "#FFBEFA" }}
                        />
                      </td>
                    )}

                    {/* Title */}
                    {!hiddenColumns.has("title") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("title", 220) }}>
                        <div className="font-medium text-brand-dark truncate">{offer.title}</div>
                        {offer.url && (
                          <a
                            href={offer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-brand-dark underline hover:text-brand-pink"
                          >
                            Voir l&apos;offre
                          </a>
                        )}
                      </td>
                    )}

                    {/* url */}
                    {!hiddenColumns.has("url") && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            defaultValue={offer.url ?? ""}
                            onBlur={(e) => updateOfferUrl(offer.id, e.target.value, e.target)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = offer.url ?? "";
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="—"
                            title={urlError[offer.id] ?? offer.url ?? undefined}
                            className={cn(
                              "border rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:outline-none focus:ring-1 w-full min-w-0",
                              urlError[offer.id]
                                ? "border-red-400 focus:border-red-500 focus:ring-red-400"
                                : "border-transparent hover:border-gray-300 focus:border-brand-pink focus:ring-brand-pink"
                            )}
                          />
                          {offer.url && (
                            <a
                              href={offer.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ouvrir l'offre"
                              aria-label="Ouvrir l'offre"
                              className="text-gray-400 hover:text-brand-pink shrink-0 leading-none"
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5"
                              >
                                <path d="M7 17 17 7" />
                                <path d="M8 7h9v9" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                    )}

                    {/* description */}
                    {!hiddenColumns.has("description") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("description", 250) }}>
                        <span className="text-xs text-gray-600 block truncate" title={offer.description ?? undefined}>
                          {offer.description ? offer.description.slice(0, 120) + (offer.description.length > 120 ? "…" : "") : "—"}
                        </span>
                      </td>
                    )}

                    {/* Company */}
                    {!hiddenColumns.has("company") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("company", 180) }}>
                        <div className="font-medium truncate text-brand-dark">{offer.company}</div>
                        <div className="flex gap-2 mt-0.5">
                          {offer.linkedinPage && (
                            <a
                              href={offer.linkedinPage}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-brand-dark underline hover:text-brand-pink"
                            >
                              LinkedIn
                            </a>
                          )}
                          {offer.website && (
                            <a
                              href={offer.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-brand-dark underline hover:text-brand-pink"
                            >
                              Site
                            </a>
                          )}
                        </div>
                      </td>
                    )}

                    {/* linkedinPage */}
                    {!hiddenColumns.has("linkedinPage") && (
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {offer.linkedinPage ? (
                          <a href={offer.linkedinPage} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-dark underline hover:text-brand-pink">
                            LinkedIn
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    )}

                    {/* website */}
                    {!hiddenColumns.has("website") && (
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {offer.website ? (
                          <a href={offer.website} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-dark underline hover:text-brand-pink">
                            Site
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    )}

                    {/* phone */}
                    {!hiddenColumns.has("phone") && (
                      <td className="px-3 py-3 text-gray-600 truncate">{offer.phone ?? "—"}</td>
                    )}

                    {/* headquarters */}
                    {!hiddenColumns.has("headquarters") && (
                      <td className="px-3 py-3 text-gray-600 truncate">{offer.headquarters ?? "—"}</td>
                    )}

                    {/* offerLocation */}
                    {!hiddenColumns.has("offerLocation") && (
                      <td className="px-3 py-3 text-gray-600 truncate">
                        {offer.offerLocation ?? "—"}
                      </td>
                    )}

                    {/* source */}
                    {!hiddenColumns.has("source") && (
                      <td className="px-3 py-3 text-gray-600 truncate">{offer.source ?? "—"}</td>
                    )}

                    {/* publishedAt */}
                    {!hiddenColumns.has("publishedAt") && (
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                        {offer.publishedAt
                          ? new Date(offer.publishedAt).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                    )}

                    {/* receivedAt */}
                    {!hiddenColumns.has("receivedAt") && (
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(offer.receivedAt).toLocaleDateString("fr-FR")}
                      </td>
                    )}

                    {/* leadName */}
                    {!hiddenColumns.has("leadName") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("leadName", 150) }}>
                        {offer.leadFirstName || offer.leadLastName ? (
                          <div>
                            <div className="font-medium truncate text-brand-dark">
                              {[toProperCase(offer.leadFirstName), toProperCase(offer.leadLastName)]
                                .filter(Boolean)
                                .join(" ")}
                            </div>
                            <div className="mt-0.5">
                              {offer.leadLinkedin && (
                                <a
                                  href={offer.leadLinkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block text-xs text-brand-dark underline hover:text-brand-pink"
                                >
                                  LinkedIn
                                </a>
                              )}
                              {offer.duplicateWarning && (
                                <div className="flex justify-center mt-0.5">
                                  <DuplicateBadge warning={offer.duplicateWarning} />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}

                    {/* leadCivility */}
                    {!hiddenColumns.has("leadCivility") && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {!normalizeCivility(offer.leadCivility) && (
                            <span
                              className="text-red-600 text-xs"
                              title="Civilité manquante"
                              aria-label="Civilité manquante"
                            >
                              ⚠️
                            </span>
                          )}
                          <select
                            value={normalizeCivility(offer.leadCivility) ?? ""}
                            onChange={(e) => updateLeadField(offer.id, "leadCivility", e.target.value || null)}
                            className="border border-transparent hover:border-gray-300 focus:border-brand-pink rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-pink w-full"
                          >
                            <option value="">—</option>
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                          </select>
                        </div>
                      </td>
                    )}

                    {/* leadFirstName */}
                    {!hiddenColumns.has("leadFirstName") && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          defaultValue={offer.leadFirstName ?? ""}
                          onBlur={(e) => updateLeadField(offer.id, "leadFirstName", e.target.value || null)}
                          placeholder="—"
                          className="border border-transparent hover:border-gray-300 focus:border-brand-pink rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-pink w-full"
                        />
                      </td>
                    )}

                    {/* leadLastName */}
                    {!hiddenColumns.has("leadLastName") && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          defaultValue={offer.leadLastName ?? ""}
                          onBlur={(e) => updateLeadField(offer.id, "leadLastName", e.target.value || null)}
                          placeholder="—"
                          className="border border-transparent hover:border-gray-300 focus:border-brand-pink rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-pink w-full"
                        />
                      </td>
                    )}

                    {/* leadEmail */}
                    {!hiddenColumns.has("leadEmail") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("leadEmail", 180) }}>
                        <div className="truncate text-gray-600">
                          {offer.leadEmail ? (
                            <a
                              href={`mailto:${offer.leadEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline hover:text-brand-pink"
                            >
                              {offer.leadEmail}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </td>
                    )}

                    {/* leadJobTitle */}
                    {!hiddenColumns.has("leadJobTitle") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("leadJobTitle", 140) }}>
                        <div className="truncate text-gray-600">{offer.leadJobTitle ?? "—"}</div>
                      </td>
                    )}

                    {/* leadLinkedin */}
                    {!hiddenColumns.has("leadLinkedin") && (
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {offer.leadLinkedin ? (
                          <a href={offer.leadLinkedin} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-dark underline hover:text-brand-pink">
                            LinkedIn
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    )}

                    {/* leadPhone */}
                    {!hiddenColumns.has("leadPhone") && (
                      <td className="px-3 py-3" style={{ maxWidth: getColWidth("leadPhone", 130) }}>
                        <div className="truncate text-gray-600">{offer.leadPhone ?? "—"}</div>
                      </td>
                    )}

                    {/* phoneLookupRequested */}
                    {!hiddenColumns.has("phoneLookupRequested") && (
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={offer.phoneLookupRequested}
                          onChange={(e) => {
                            void updatePhoneEnrichment(offer.id, { phoneLookupRequested: e.target.checked });
                          }}
                          className="w-4 h-4 cursor-pointer"
                          style={{ accentColor: "#FFBEFA" }}
                        />
                      </td>
                    )}

                    {/* enrichedPhone */}
                    {!hiddenColumns.has("enrichedPhone") && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {offer.apolloEnrichmentStatus === "pending" ? (
                          <span className="text-xs text-amber-600 font-medium animate-pulse">Recherche en cours…</span>
                        ) : offer.apolloEnrichmentStatus === "failed" && !offer.enrichedPhone ? (
                          <span className="text-xs text-red-400">Non trouvé</span>
                        ) : (
                          <input
                            type="text"
                            defaultValue={offer.enrichedPhone ?? ""}
                            placeholder="Numéro enrichi"
                            onBlur={(e) => {
                              void updatePhoneEnrichment(offer.id, { enrichedPhone: e.target.value || null });
                            }}
                            className="border border-gray-300 px-2 py-1 text-sm w-full text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-pink"
                          />
                        )}
                      </td>
                    )}

                    {/* lgmSent */}
                    {!hiddenColumns.has("lgmSent") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmSent ? (
                          <span className="text-xs text-brand-green font-semibold whitespace-nowrap">
                            {new Date(offer.lgmSentAt ?? offer.contactedAt ?? "").toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* callRequested */}
                    {!hiddenColumns.has("callRequested") && (
                      <td className="px-3 py-3 text-center">
                        {offer.callRequested ? (
                          <span className="text-lg">📞</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmMessagesSent */}
                    {!hiddenColumns.has("lgmMessagesSent") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmMessagesSent != null ? (
                          <span className="text-sm font-semibold text-brand-dark">{offer.lgmMessagesSent}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmEmailOpened */}
                    {!hiddenColumns.has("lgmEmailOpened") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmEmailOpened != null ? (
                          <span className="text-sm font-semibold text-brand-dark">{offer.lgmEmailOpened}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmConnectionSentAt */}
                    {!hiddenColumns.has("lgmConnectionSentAt") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmConnectionSentAt ? (
                          <span className="text-xs text-blue-600 font-semibold whitespace-nowrap">
                            {new Date(offer.lgmConnectionSentAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmConnectionAcceptedAt */}
                    {!hiddenColumns.has("lgmConnectionAcceptedAt") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmConnectionAcceptedAt ? (
                          <span className="text-xs text-blue-700 font-semibold whitespace-nowrap">
                            {new Date(offer.lgmConnectionAcceptedAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmMessage1SentAt */}
                    {!hiddenColumns.has("lgmMessage1SentAt") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmMessage1SentAt ? (
                          <span className="text-xs text-indigo-600 font-semibold whitespace-nowrap">
                            {new Date(offer.lgmMessage1SentAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmRepliedAt */}
                    {!hiddenColumns.has("lgmRepliedAt") && (
                      <td className="px-3 py-3 text-center">
                        {offer.lgmRepliedAt ? (
                          <span className="text-xs text-brand-green font-semibold whitespace-nowrap">
                            {new Date(offer.lgmRepliedAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* lgmReplyContent */}
                    {!hiddenColumns.has("lgmReplyContent") && (
                      <td className="px-3 py-3 max-w-xs">
                        {offer.lgmReplyContent ? (
                          <span className="text-xs text-gray-700 line-clamp-2">{offer.lgmReplyContent}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    {/* Custom fields */}
                    {visibleCustom.map((field) => (
                      <td
                        key={field.id}
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CustomFieldCell
                          field={field}
                          offer={offer}
                          value={offer.customValues?.[field.name]}
                          aiLoading={aiGenerating.has(`${offer.id}-${field.id}`)}
                          onChange={(val) => updateCustomValue(offer.id, field.name, val)}
                          onGenerate={() => generateAIValue(offer.id, field)}
                        />
                      </td>
                    ))}
                  </tr>

                  {/* Expanded row */}
                  {expandedRow === offer.id && (
                    <tr key={`${offer.id}-expanded`} className="bg-[#FFBEFA]/10 border-b border-gray-200">
                      <td colSpan={visibleCount} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                          {offer.description && (
                            <div className="col-span-full">
                              <span className="font-medium text-brand-dark">Description : </span>
                              <p className="text-gray-600 mt-1 whitespace-pre-wrap">{offer.description}</p>
                            </div>
                          )}
                          <Detail label="Siège entreprise" value={offer.headquarters} />
                          <Detail label="Téléphone entreprise" value={offer.phone} />
                          <Detail label="Téléphone lead" value={offer.leadPhone} />
                          <Detail label="Reçu le" value={new Date(offer.receivedAt).toLocaleString("fr-FR")} />
                        </div>

                        <LgmTimeline offer={offer} />
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 disabled:opacity-40 hover:bg-white text-brand-dark transition-colors"
          >
            ← Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 disabled:opacity-40 hover:bg-white text-brand-dark transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}

      {showImportCsv && (
        <ImportCsvModal
          workspaceId={targetWorkspaceId}
          customFields={customFields}
          onClose={() => setShowImportCsv(false)}
          onImported={(count, mode) => { void handleCsvImported(count, mode); }}
        />
      )}

      {showAddField && (
        <AddCustomFieldModal
          workspaceId={targetWorkspaceId}
          onClose={() => setShowAddField(false)}
          onCreated={(field) => {
            setCustomFields((prev) => [...prev, field]);
            setShowAddField(false);
          }}
          existingCustomFields={customFields.map((f) => ({ name: f.name, label: f.label }))}
        />
      )}

      {editingPromptField && (
        <EditCustomFieldPromptModal
          field={editingPromptField}
          existingCustomFields={customFields.map((f) => ({ name: f.name, label: f.label }))}
          onClose={() => setEditingPromptField(null)}
          onUpdated={(updated) => {
            setCustomFields((prev) =>
              prev.map((f) => (f.id === updated.id ? { ...f, formula: updated.formula } : f))
            );
            setEditingPromptField(null);
          }}
        />
      )}
    </div>
  );
}

function DuplicateBadge({ warning }: { warning: string }) {
  const config = {
    imported: { label: "déjà importé", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    contacted: { label: "déjà contacté", className: "bg-blue-100 text-blue-700 border-blue-200" },
    do_not_contact: { label: "ne pas contacter", className: "bg-red-100 text-red-600 border-red-200" },
  }[warning] ?? { label: "doublon", className: "bg-gray-100 text-gray-500 border-gray-200" };

  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border mt-0.5 mb-0.5 ${config.className}`}>
      {config.label}
    </span>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: "gray" | "green" | "red" }) {
  const colorClass =
    color === "green"
      ? "bg-[#26B743]/10 text-[#26B743] border-[#26B743]/20"
      : color === "red"
      ? "bg-red-50 text-red-500 border-red-100"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <div className={`flex items-center gap-2 border px-3 py-1.5 text-sm ${colorClass}`}>
      <span className="font-semibold text-base">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function AudienceDropdownCell({
  offer,
  campaigns,
  onSet,
}: {
  offer: JobOffer;
  campaigns: string[];
  onSet: (id: string, status: "qualify" | "contact" | "doNotContact", audience?: string) => void;
}) {
  const multipleAudiences = campaigns.length > 1;

  const currentValue = offer.doNotContact
    ? "doNotContact"
    : offer.toContact
    ? (multipleAudiences && offer.lgmAudience ? offer.lgmAudience : "__contact__")
    : "qualify";

  function handleChange(val: string) {
    if (val === "qualify") {
      onSet(offer.id, "qualify");
    } else if (val === "doNotContact") {
      onSet(offer.id, "doNotContact");
    } else if (val === "__contact__") {
      // 1 audience : on l'utilise automatiquement
      onSet(offer.id, "contact", campaigns[0]);
    } else {
      onSet(offer.id, "contact", val);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "text-xs border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-pink bg-white",
          offer.doNotContact
            ? "border-red-200 text-red-500"
            : offer.toContact
            ? "border-[#26B743]/30 text-[#26B743]"
            : "border-gray-200 text-gray-500"
        )}
      >
        <option value="qualify">— À qualifier</option>
        <option value="doNotContact">✗ Ne pas contacter</option>
        {!multipleAudiences && (
          <option value="__contact__">✓ Contacter</option>
        )}
        {multipleAudiences && campaigns.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        {/* Fallback si contacté avec une audience supprimée depuis (utile seulement en multi-campagnes) */}
        {multipleAudiences && offer.toContact && offer.lgmAudience && !campaigns.includes(offer.lgmAudience) && (
          <option value={offer.lgmAudience}>{offer.lgmAudience}</option>
        )}
      </select>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium text-brand-dark">{label} : </span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}

function LgmTimeline({ offer }: { offer: JobOffer }) {
  const events: { date: string; label: string; content?: string | null; type: "sent" | "received" | "neutral" }[] = [];

  if (offer.lgmConnectionSentAt)
    events.push({ date: offer.lgmConnectionSentAt, label: "Demande de connexion envoyée", type: "sent" });
  if (offer.lgmConnectionAcceptedAt)
    events.push({ date: offer.lgmConnectionAcceptedAt, label: "Connexion acceptée", type: "neutral" });
  if (offer.lgmMessage1SentAt)
    events.push({ date: offer.lgmMessage1SentAt, label: "Message envoyé", type: "sent" });
  if (offer.lgmRepliedAt)
    events.push({ date: offer.lgmRepliedAt, label: "Réponse reçue", content: offer.lgmReplyContent, type: "received" });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) return null;

  return (
    <div className="mt-4 border-t border-brand-pink/20 pt-4">
      <p className="text-xs font-medium text-brand-dark mb-3">Conversation LGM</p>
      <div className="space-y-2">
        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5 w-28 shrink-0">
              {new Date(ev.date).toLocaleDateString("fr-FR")}
            </span>
            <div className={cn(
              "flex-1 text-xs px-3 py-1.5 border-l-2",
              ev.type === "sent" && "border-l-brand-dark text-brand-dark",
              ev.type === "received" && "border-l-[#26B743] text-[#26B743]",
              ev.type === "neutral" && "border-l-gray-300 text-gray-500",
            )}>
              <span className="font-medium">{ev.label}</span>
              {ev.content && (
                <p className="text-gray-600 mt-0.5 font-normal">{ev.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomFieldCell({
  field,
  offer,
  value,
  aiLoading,
  onChange,
  onGenerate,
}: {
  field: CustomField;
  offer: JobOffer;
  value: unknown;
  aiLoading: boolean;
  onChange: (val: unknown) => void;
  onGenerate: () => void;
}) {
  // Formula: computed client-side, read-only
  if (field.type === "FORMULA") {
    const result = field.formula ? evalFormula(field.formula, offer) : "—";
    return <span className="text-sm text-gray-600">{result || "—"}</span>;
  }

  // AI: editable stored value + generate button
  if (field.type === "AI") {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          type="text"
          defaultValue={value != null ? String(value) : ""}
          onBlur={(e) => onChange(e.target.value || null)}
          placeholder="—"
          className="border border-transparent hover:border-gray-300 focus:border-brand-pink rounded px-1 py-0.5 text-sm text-gray-600 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-pink flex-1 min-w-0"
        />
        <button
          onClick={onGenerate}
          disabled={aiLoading}
          className="text-brand-pink hover:opacity-70 disabled:opacity-40 text-base shrink-0"
          title="Générer avec l'IA"
        >
          {aiLoading ? (
            <span className="text-xs text-gray-400">...</span>
          ) : (
            "⚡"
          )}
        </button>
      </div>
    );
  }

  if (field.type === "BOOLEAN") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: "#FFBEFA" }}
      />
    );
  }

  if (field.type === "NUMBER") {
    return (
      <input
        type="number"
        defaultValue={value != null ? String(value) : ""}
        onBlur={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="border border-gray-300 px-2 py-1 text-sm w-24 text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-pink"
      />
    );
  }

  return (
    <input
      type={field.type === "DATE" ? "date" : "text"}
      defaultValue={value != null ? String(value) : ""}
      onBlur={(e) => onChange(e.target.value || null)}
      className="border border-gray-300 px-2 py-1 text-sm w-full text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-pink"
    />
  );
}
