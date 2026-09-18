"use client";

import { useState } from "react";

interface AddOfferModalProps {
  workspaceId?: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddOfferModal({ workspaceId, onClose, onAdded }: AddOfferModalProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [offerLocation, setOfferLocation] = useState("");
  const [source, setSource] = useState("");
  const [leadFirstName, setLeadFirstName] = useState("");
  const [leadLastName, setLeadLastName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadLinkedin, setLeadLinkedin] = useState("");
  const [leadJobTitle, setLeadJobTitle] = useState("");
  const [recruitingAgency, setRecruitingAgency] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);

    const params = workspaceId ? `?targetWorkspaceId=${workspaceId}` : "";
    const res = await fetch(`/api/job-offers/manual${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, company, url, offerLocation, source,
        leadFirstName, leadLastName, leadEmail, leadPhone, leadLinkedin, leadJobTitle,
        recruitingAgency, agencyName,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur pendant l'ajout du contact.");
      return;
    }

    onAdded();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-brand-dark">Ajouter un contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-dark text-xl" aria-label="Fermer">×</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Section title="Lead">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" value={leadFirstName} onChange={setLeadFirstName} />
              <Field label="Nom" value={leadLastName} onChange={setLeadLastName} />
            </div>
            <Field label="Email" value={leadEmail} onChange={setLeadEmail} type="email" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone" value={leadPhone} onChange={setLeadPhone} />
              <Field label="Métier" value={leadJobTitle} onChange={setLeadJobTitle} />
            </div>
            <Field label="LinkedIn" value={leadLinkedin} onChange={setLeadLinkedin} />
          </Section>

          <Section title="Offre & entreprise">
            <Field label="Offre d'emploi" value={title} onChange={setTitle} placeholder="Sans titre" />
            <Field label="Entreprise" value={company} onChange={setCompany} placeholder="Inconnu" />
            <Field label="URL de l'offre" value={url} onChange={setUrl} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Localisation" value={offerLocation} onChange={setOfferLocation} />
              <Field label="Source" value={source} onChange={setSource} placeholder="Ajout manuel" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={recruitingAgency}
                onChange={(e) => setRecruitingAgency(e.target.checked)}
                style={{ accentColor: "#FFBEFA" }}
                className="w-4 h-4"
              />
              Cabinet recrutement
            </label>
            {recruitingAgency && (
              <Field label="Nom du cabinet" value={agencyName} onChange={setAgencyName} />
            )}
          </Section>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 text-brand-dark hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="px-4 py-2 text-sm bg-brand-pink text-brand-dark font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <h3 className="text-sm font-semibold text-brand-dark">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-600 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 px-2 py-1.5 text-sm text-brand-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-pink"
      />
    </label>
  );
}
