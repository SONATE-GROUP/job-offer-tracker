"use client";

import { useState } from "react";

interface CustomField {
  id: string;
  name: string;
  label: string;
  type: string;
  formula?: string | null;
  lgmAttribute?: string | null;
  emeliAttribute?: string | null;
  autoFill?: boolean;
}

interface ExistingField {
  name: string;
  label: string;
}

interface AddCustomFieldModalProps {
  onClose: () => void;
  onCreated: (field: CustomField) => void;
  existingCustomFields?: ExistingField[];
  workspaceId?: string;
}

const FIELD_TYPES = [
  { value: "TEXT", label: "Texte" },
  { value: "NUMBER", label: "Nombre" },
  { value: "BOOLEAN", label: "Case à cocher" },
  { value: "DATE", label: "Date" },
  { value: "FORMULA", label: "Formule" },
  { value: "AI", label: "IA (généré par Claude/Gemini/Groq/OpenAI)" },
];

const FORMULA_VARS = [
  { key: "{title}", label: "Titre de l'offre" },
  { key: "{company}", label: "Entreprise" },
  { key: "{offerLocation}", label: "Localisation" },
  { key: "{source}", label: "Source" },
  { key: "{leadFirstName}", label: "Prénom lead" },
  { key: "{leadLastName}", label: "Nom lead" },
  { key: "{leadEmail}", label: "Email lead" },
  { key: "{leadJobTitle}", label: "Poste lead" },
  { key: "{description}", label: "Description" },
];

const AI_VARS_BASE = FORMULA_VARS.map((v) => ({
  key: `{{${v.key.slice(1, -1)}}}`,
  label: v.label,
}));

const LGM_OPTIONS = [
  { value: "", label: "Ne pas envoyer à LGM" },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: `customAttribute${i + 1}`,
    label: `customAttribute${i + 1}`,
  })),
];

export function AddCustomFieldModal({ onClose, onCreated, existingCustomFields = [], workspaceId }: AddCustomFieldModalProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("TEXT");
  const [formula, setFormula] = useState("");
  const [lgmAttribute, setLgmAttribute] = useState("");
  const [emeliAttribute, setEmeliAttribute] = useState("");
  const [autoFill, setAutoFill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const aiVars = [
    ...AI_VARS_BASE,
    ...existingCustomFields.map((f) => ({ key: `{{${f.name}}}`, label: f.label })),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/custom-fields${workspaceId ? `?workspaceId=${workspaceId}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        type,
        formula: formula || undefined,
        lgmAttribute: lgmAttribute || undefined,
        emeliAttribute: emeliAttribute || undefined,
        autoFill: autoFill,
      }),
    });

    if (res.ok) {
      const field = await res.json();
      onCreated(field);
    } else {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la création");
    }
    setLoading(false);
  }

  const isFormula = type === "FORMULA";
  const isAI = type === "AI";
  const supportsLgm = type !== "FORMULA";

  return (
    <div className="fixed inset-0 bg-sonate-green-dark/50 flex items-center justify-center z-50">
      <div className="bg-sonate-ivory-light rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-sonate-green">Ajouter un champ personnalisé</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-sonate-ink mb-1">
              Nom du champ
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Ex: Score, Secteur, Titre nettoyé..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-sonate-ink mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setFormula(""); setAutoFill(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Formule */}
          {isFormula && (
            <div>
              <label className="block text-sm font-medium text-sonate-ink mb-1">Formule</label>
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                required
                placeholder="Ex: {title} — {company}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
              />
              <VarPicker vars={FORMULA_VARS} onInsert={(v) => setFormula((f) => f + v)} />
            </div>
          )}

          {/* Prompt IA */}
          {isAI && (
            <div>
              <label className="block text-sm font-medium text-sonate-ink mb-1">Prompt IA</label>
              <textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                required
                rows={3}
                placeholder="Ex: Nettoie ce titre d'offre pour un message de prospection : {{title}}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange resize-none"
              />
              <VarPicker vars={aiVars} onInsert={(v) => setFormula((f) => f + v)} />
              <p className="text-xs text-gray-400 mt-1.5">
                Utilisez <code className="bg-gray-100 px-1 rounded">{"{{field}}"}</code> pour injecter des données de l&apos;offre dans le prompt.
              </p>
            </div>
          )}

          {/* Auto-fill (IA seulement) */}
          {isAI && (
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={autoFill}
                onChange={(e) => setAutoFill(e.target.checked)}
                className="mt-0.5 w-4 h-4 cursor-pointer shrink-0"
                style={{ accentColor: "#123C33" }}
              />
              <div>
                <span className="text-sm font-medium text-sonate-ink">Remplissage automatique</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ce champ sera généré par l&apos;IA à chaque nouvelle offre reçue via webhook, en arrière-plan.
                </p>
              </div>
            </label>
          )}

          {/* LGM custom attribute */}
          {supportsLgm && (
            <div>
              <label className="block text-sm font-medium text-sonate-ink mb-1">
                Envoyer vers LGM
              </label>
              <select
                value={lgmAttribute}
                onChange={(e) => setLgmAttribute(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
              >
                {LGM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {lgmAttribute && (
                <p className="text-xs text-gray-400 mt-1">
                  La valeur sera envoyée comme <code className="bg-gray-100 px-1 rounded">{lgmAttribute}</code> lors du clic sur CONTACTER.
                </p>
              )}
            </div>
          )}

          {/* Emelia custom attribute */}
          {supportsLgm && (
            <div>
              <label className="block text-sm font-medium text-sonate-ink mb-1">
                Envoyer vers Emelia <span className="text-gray-400 font-normal">(clé du champ custom)</span>
              </label>
              <input
                type="text"
                value={emeliAttribute}
                onChange={(e) => setEmeliAttribute(e.target.value)}
                placeholder="Ex: score, secteur, titre_nettoye..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
              />
              {emeliAttribute && (
                <p className="text-xs text-gray-400 mt-1">
                  La valeur sera envoyée dans <code className="bg-gray-100 px-1 rounded">contact.{emeliAttribute}</code> lors du clic sur CONTACTER.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-sonate-ink hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-sonate-green text-sonate-ivory rounded-lg py-2 text-sm font-medium hover:bg-sonate-green-dark disabled:opacity-50 transition-opacity"
            >
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VarPicker({
  vars,
  onInsert,
}: {
  vars: { key: string; label: string }[];
  onInsert: (v: string) => void;
}) {
  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-1">Insérer une variable :</p>
      <div className="flex flex-wrap gap-1">
        {vars.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            title={v.label}
            className="text-xs bg-gray-100 hover:bg-sonate-green-100 text-sonate-ink rounded px-1.5 py-0.5 font-mono transition-colors"
          >
            {v.key}
          </button>
        ))}
      </div>
    </div>
  );
}
