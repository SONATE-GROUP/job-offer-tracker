"use client";

import { useState } from "react";

interface CustomField {
  id: string;
  name: string;
  label: string;
  type: string;
  formula?: string | null;
}

interface ExistingField {
  name: string;
  label: string;
}

interface EditCustomFieldPromptModalProps {
  field: CustomField;
  existingCustomFields?: ExistingField[];
  onClose: () => void;
  onUpdated: (field: CustomField) => void;
}

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

export function EditCustomFieldPromptModal({
  field,
  existingCustomFields = [],
  onClose,
  onUpdated,
}: EditCustomFieldPromptModalProps) {
  const [formula, setFormula] = useState(field.formula ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAI = field.type === "AI";

  const vars = isAI
    ? [
        ...AI_VARS_BASE,
        ...existingCustomFields
          .filter((f) => f.name !== field.name)
          .map((f) => ({ key: `{{${f.name}}}`, label: f.label })),
      ]
    : FORMULA_VARS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula }),
    });

    if (res.ok) {
      const updated = await res.json();
      onUpdated(updated);
    } else {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la mise à jour");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-sonate-green-dark/50 flex items-center justify-center z-50">
      <div className="bg-sonate-ivory-light rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1 text-sonate-green">
          Modifier le {isAI ? "prompt IA" : "formule"} — {field.label}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-sonate-ink mb-1">
              {isAI ? "Prompt IA" : "Formule"}
            </label>
            {isAI ? (
              <textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                required
                rows={4}
                placeholder="Ex: Nettoie ce titre d'offre pour un message de prospection : {{title}}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange resize-none"
              />
            ) : (
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                required
                placeholder="Ex: {title} — {company}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange"
              />
            )}
            <VarPicker vars={vars} onInsert={(v) => setFormula((f) => f + v)} />
            {isAI && (
              <p className="text-xs text-gray-400 mt-1.5">
                Utilisez <code className="bg-gray-100 px-1 rounded">{"{{field}}"}</code> pour injecter des données de l&apos;offre dans le prompt.
              </p>
            )}
          </div>

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
              {loading ? "Enregistrement..." : "Enregistrer"}
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
