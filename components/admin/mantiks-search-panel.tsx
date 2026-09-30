"use client";

import { useState, useEffect, useCallback } from "react";

const JOB_BOARDS = [
  { value: "", label: "Tous les job boards" },
  { value: "indeed", label: "Indeed" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "wttj", label: "Welcome to the Jungle" },
  { value: "glassdoor", label: "Glassdoor" },
];

const AGE_OPTIONS = [
  { value: 7, label: "7 derniers jours" },
  { value: 14, label: "14 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 60, label: "60 derniers jours" },
  { value: 90, label: "90 derniers jours" },
];

interface MantikJob {
  title: string;
  location?: string;
  job_board?: string;
  url?: string;
  published_at?: string;
}

interface MantikCompany {
  name: string;
  website?: string;
  linkedin?: string;
  industry?: string;
  employee_count?: string | number;
  jobs: MantikJob[];
}

interface MantikResult {
  companies: MantikCompany[];
  next_offset?: string | null;
  total?: number;
}

interface SavedSearch {
  id: string;
  name: string;
  createdAt: string;
  filters: SearchFilters;
}

interface SearchFilters {
  job_age_in_days: number;
  job_location_ids: number[];
  job_title: string[];
  job_title_include_all: boolean;
  job_title_excluded: string[];
  job_description: string[];
  job_description_include_all: boolean;
  job_description_excluded: string[];
  job_board: string;
  nb_min_job_posted?: number;
  nb_max_job_posted?: number;
  min_company_size?: number;
  max_company_size?: number;
  company_industry: string[];
  company_industry_excluded: string[];
  company_funding: boolean;
  limit: number;
}

// Reusable tag input
function TagInput({
  values,
  onAdd,
  onRemove,
  placeholder,
  numeric,
}: {
  values: (string | number)[];
  onAdd: (v: string) => void;
  onRemove: (v: string | number) => void;
  placeholder: string;
  numeric?: boolean;
}) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput("");
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type={numeric ? "number" : "text"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-sonate-ink whitespace-nowrap"
        >
          +
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-sonate-green text-sonate-ivory px-2 py-0.5 text-xs">
              {v}
              <button type="button" onClick={() => onRemove(v)} className="hover:text-sonate-orange ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_FILTERS: SearchFilters = {
  job_age_in_days: 30,
  job_location_ids: [],
  job_title: [],
  job_title_include_all: false,
  job_title_excluded: [],
  job_description: [],
  job_description_include_all: false,
  job_description_excluded: [],
  job_board: "",
  nb_min_job_posted: undefined,
  nb_max_job_posted: undefined,
  min_company_size: undefined,
  max_company_size: undefined,
  company_industry: [],
  company_industry_excluded: ["recruiting", "consulting"],
  company_funding: false,
  limit: 10,
};

export function MantikSearchPanel({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");

  // --- Filters ---
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  function setF<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // --- Save search ---
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Saved searches ---
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // --- Results ---
  const [results, setResults] = useState<MantikResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSavedSearches = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch(`/api/mantiks/searches?workspaceId=${workspaceId}`);
      if (res.ok) setSavedSearches(await res.json());
    } finally {
      setLoadingSaved(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) fetchSavedSearches();
  }, [open, fetchSavedSearches]);

  function buildBody(offset?: string) {
    return {
      ...filters,
      offset,
    };
  }

  async function handleSearch(filtersOverride?: SearchFilters, offset?: string) {
    const f = filtersOverride ?? filters;
    if (!offset) {
      setLoading(true);
      setError(null);
      setResults(null);
      setNextOffset(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await fetch(`/api/mantiks/search?workspaceId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, offset }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur inconnue"); return; }
      if (offset) {
        setResults((prev) => ({ ...data, companies: [...(prev?.companies ?? []), ...(data.companies ?? [])] }));
      } else {
        setResults(data);
        setActiveTab("search");
      }
      setNextOffset(data.next_offset ?? null);
    } catch { setError("Erreur réseau"); }
    finally { setLoading(false); setLoadingMore(false); }
  }

  async function handleSave() {
    if (!saveName.trim()) { setSaveError("Nom requis"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/mantiks/searches?workspaceId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), filters }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Erreur"); return; }
      setSavedSearches((prev) => [data, ...prev]);
      setSaveName("");
    } catch { setSaveError("Erreur réseau"); }
    finally { setSaving(false); }
  }

  function loadSearch(search: SavedSearch) {
    setFilters(search.filters);
    setActiveTab("search");
  }

  async function runSearch(search: SavedSearch) {
    setFilters(search.filters);
    setActiveTab("search");
    await handleSearch(search.filters);
  }

  async function deleteSearch(id: string) {
    await fetch(`/api/mantiks/searches/${id}?workspaceId=${workspaceId}`, { method: "DELETE" });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setResults(null);
    setError(null);
    setNextOffset(null);
  }

  return (
    <div className="border border-sonate-green-border bg-sonate-green-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-sonate-ink hover:bg-sonate-green-100 transition-colors"
      >
        <span>🔍 Recherche Mantiks</span>
        <span className="text-gray-400 text-xs">{open ? "▲ Réduire" : "▼ Ouvrir"}</span>
      </button>

      {open && (
        <div className="border-t border-sonate-green-border">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "search" ? "border-sonate-green text-sonate-ink" : "border-transparent text-gray-500 hover:text-sonate-green"}`}
            >
              Nouvelle recherche
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("saved"); fetchSavedSearches(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "saved" ? "border-sonate-green text-sonate-ink" : "border-transparent text-gray-500 hover:text-sonate-green"}`}
            >
              Recherches sauvegardées
              {savedSearches.length > 0 && (
                <span className="ml-1.5 bg-sonate-green text-sonate-ivory text-xs px-1.5 py-0.5">{savedSearches.length}</span>
              )}
            </button>
          </div>

          {/* ── TAB: NOUVELLE RECHERCHE ──────────────────────── */}
          {activeTab === "search" && (
            <div className="p-4 space-y-6">

              {/* ── OFFRES ─────────────────────────────────────── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Offres d&apos;emploi</legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Ancienneté <span className="text-red-400">*</span></label>
                    <select
                      value={filters.job_age_in_days}
                      onChange={(e) => setF("job_age_in_days", Number(e.target.value))}
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange bg-sonate-ivory-light"
                    >
                      {AGE_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Job board</label>
                    <select
                      value={filters.job_board}
                      onChange={(e) => setF("job_board", e.target.value)}
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange bg-sonate-ivory-light"
                    >
                      {JOB_BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Nb offres min par entreprise</label>
                    <input
                      type="number" min={1} value={filters.nb_min_job_posted ?? ""}
                      onChange={(e) => setF("nb_min_job_posted", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="ex: 2"
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Nb offres max par entreprise</label>
                    <input
                      type="number" min={1} value={filters.nb_max_job_posted ?? ""}
                      onChange={(e) => setF("nb_max_job_posted", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="ex: 10"
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Localisations <span className="text-red-400">*</span> <span className="text-gray-400 font-normal">(IDs Mantiks — ex: 2988507 = Paris)</span></label>
                  <TagInput
                    values={filters.job_location_ids}
                    onAdd={(v) => { const n = parseInt(v); if (!isNaN(n) && !filters.job_location_ids.includes(n)) setF("job_location_ids", [...filters.job_location_ids, n]); }}
                    onRemove={(v) => setF("job_location_ids", filters.job_location_ids.filter((x) => x !== v))}
                    placeholder="ex: 2988507"
                    numeric
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Mots-clés dans le titre</label>
                  <TagInput
                    values={filters.job_title}
                    onAdd={(v) => { if (!filters.job_title.includes(v)) setF("job_title", [...filters.job_title, v]); }}
                    onRemove={(v) => setF("job_title", filters.job_title.filter((x) => x !== v))}
                    placeholder="ex: sales, account manager..."
                  />
                  <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={filters.job_title_include_all} onChange={(e) => setF("job_title_include_all", e.target.checked)} className="accent-sonate-green" />
                    Logique AND (tous les mots-clés requis)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Mots-clés à exclure du titre</label>
                  <TagInput
                    values={filters.job_title_excluded}
                    onAdd={(v) => { if (!filters.job_title_excluded.includes(v)) setF("job_title_excluded", [...filters.job_title_excluded, v]); }}
                    onRemove={(v) => setF("job_title_excluded", filters.job_title_excluded.filter((x) => x !== v))}
                    placeholder="ex: intern, junior..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Mots-clés dans la description</label>
                  <TagInput
                    values={filters.job_description}
                    onAdd={(v) => { if (!filters.job_description.includes(v)) setF("job_description", [...filters.job_description, v]); }}
                    onRemove={(v) => setF("job_description", filters.job_description.filter((x) => x !== v))}
                    placeholder="ex: CRM, Salesforce..."
                  />
                  <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={filters.job_description_include_all} onChange={(e) => setF("job_description_include_all", e.target.checked)} className="accent-sonate-green" />
                    Logique AND (tous les mots-clés requis)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Mots-clés à exclure de la description</label>
                  <TagInput
                    values={filters.job_description_excluded}
                    onAdd={(v) => { if (!filters.job_description_excluded.includes(v)) setF("job_description_excluded", [...filters.job_description_excluded, v]); }}
                    onRemove={(v) => setF("job_description_excluded", filters.job_description_excluded.filter((x) => x !== v))}
                    placeholder="ex: CDI, stage..."
                  />
                </div>
              </fieldset>

              {/* ── ENTREPRISES ─────────────────────────────────── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Entreprises</legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Taille min (employés)</label>
                    <input
                      type="number" min={1} value={filters.min_company_size ?? ""}
                      onChange={(e) => setF("min_company_size", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="ex: 10"
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Taille max (employés)</label>
                    <input
                      type="number" min={1} value={filters.max_company_size ?? ""}
                      onChange={(e) => setF("max_company_size", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="ex: 500"
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Secteurs d&apos;activité inclus</label>
                  <TagInput
                    values={filters.company_industry}
                    onAdd={(v) => { if (!filters.company_industry.includes(v)) setF("company_industry", [...filters.company_industry, v]); }}
                    onRemove={(v) => setF("company_industry", filters.company_industry.filter((x) => x !== v))}
                    placeholder="ex: software, retail..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-sonate-ink mb-1">Secteurs exclus <span className="text-gray-400 font-normal">(défaut: recruiting, consulting)</span></label>
                  <TagInput
                    values={filters.company_industry_excluded}
                    onAdd={(v) => { if (!filters.company_industry_excluded.includes(v)) setF("company_industry_excluded", [...filters.company_industry_excluded, v]); }}
                    onRemove={(v) => setF("company_industry_excluded", filters.company_industry_excluded.filter((x) => x !== v))}
                    placeholder="ex: recruiting..."
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-sonate-ink cursor-pointer select-none">
                  <input type="checkbox" checked={filters.company_funding} onChange={(e) => setF("company_funding", e.target.checked)} className="accent-sonate-green" />
                  Entreprises avec levée de fonds uniquement
                </label>
              </fieldset>

              {/* ── ACTIONS ─────────────────────────────────────── */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Lancer / sauvegarder</legend>

                <div className="flex items-end gap-3">
                  <div className="w-28">
                    <label className="block text-xs font-medium text-sonate-ink mb-1">Limite</label>
                    <input
                      type="number" min={1} max={500} value={filters.limit}
                      onChange={(e) => setF("limit", e.target.value ? parseInt(e.target.value) : 10)}
                      className="w-full border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                    />
                  </div>
                  <div className="flex-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSearch()}
                      disabled={loading}
                      className="flex-1 bg-sonate-green text-sonate-ivory px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {loading ? "Recherche en cours..." : "Lancer la recherche"}
                    </button>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50 text-gray-600"
                      title="Réinitialiser les filtres"
                    >
                      ↺
                    </button>
                  </div>
                </div>

                {/* Save form */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                    placeholder="Nom de la recherche à sauvegarder..."
                    className="flex-1 border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 text-sm border border-sonate-green text-sonate-ink hover:bg-sonate-green hover:text-sonate-ivory disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {saving ? "..." : "Sauvegarder"}
                  </button>
                </div>
                {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              </fieldset>

              {/* Error */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</div>
              )}

              {/* Results */}
              {results && (
                <>
                  <p className="text-xs text-gray-500">
                    {results.companies?.length ?? 0} entreprise(s) affichée(s)
                    {results.total ? ` sur ${results.total}` : ""}
                  </p>

                  {results.companies?.length === 0 && (
                    <p className="text-sm text-gray-500">Aucun résultat pour ces critères.</p>
                  )}

                  <div className="space-y-3">
                    {results.companies?.map((company, ci) => (
                      <div key={ci} className="border border-gray-200 bg-sonate-ivory-light">
                        <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <div>
                            <p className="font-medium text-sm text-sonate-ink">{company.name}</p>
                            <div className="flex flex-wrap gap-x-3 mt-0.5">
                              {company.industry && <span className="text-xs text-gray-500">{company.industry}</span>}
                              {company.employee_count && <span className="text-xs text-gray-500">{company.employee_count} employés</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0 ml-3">
                            {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sonate-ink underline hover:no-underline">Site</a>}
                            {company.linkedin && <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-sonate-ink underline hover:no-underline">LinkedIn</a>}
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {company.jobs?.map((job, ji) => (
                            <div key={ji} className="px-4 py-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-sonate-ink truncate">{job.title}</p>
                                <div className="flex flex-wrap gap-x-2 mt-0.5">
                                  {job.location && <span className="text-xs text-gray-400">{job.location}</span>}
                                  {job.job_board && <span className="text-xs text-gray-400 capitalize">{job.job_board}</span>}
                                  {job.published_at && <span className="text-xs text-gray-400">{new Date(job.published_at).toLocaleDateString("fr-FR")}</span>}
                                </div>
                              </div>
                              {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sonate-ink underline hover:no-underline shrink-0">Voir</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {nextOffset && (
                      <button
                        type="button"
                        onClick={() => handleSearch(undefined, nextOffset)}
                        disabled={loadingMore}
                        className="w-full py-2 text-sm text-sonate-ink border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {loadingMore ? "Chargement..." : "Charger plus de résultats"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: RECHERCHES SAUVEGARDÉES ─────────────────── */}
          {activeTab === "saved" && (
            <div className="p-4">
              {loadingSaved ? (
                <p className="text-sm text-gray-400">Chargement...</p>
              ) : savedSearches.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune recherche sauvegardée. Configurez vos filtres et cliquez sur &quot;Sauvegarder&quot;.</p>
              ) : (
                <div className="space-y-2">
                  {savedSearches.map((search) => (
                    <div key={search.id} className="border border-gray-200 bg-sonate-ivory-light px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sonate-ink">{search.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Créée le {new Date(search.createdAt).toLocaleDateString("fr-FR")}
                          {search.filters.job_age_in_days && ` · ${search.filters.job_age_in_days}j`}
                          {search.filters.job_title?.length > 0 && ` · "${search.filters.job_title.join(", ")}"`}
                          {search.filters.job_location_ids?.length > 0 && ` · ${search.filters.job_location_ids.length} localisation(s)`}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => loadSearch(search)}
                          className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 text-sonate-ink"
                          title="Charger les filtres"
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          onClick={() => runSearch(search)}
                          className="px-3 py-1 text-xs bg-sonate-green text-sonate-ivory hover:opacity-90"
                          title="Exécuter la recherche"
                        >
                          ▶ Exécuter
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSearch(search.id)}
                          className="px-2 py-1 text-xs border border-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-400"
                          title="Supprimer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
