import Anthropic from "@anthropic-ai/sdk";

export interface OfferForAI {
  title: string;
  company: string;
  description: string | null;
  offerLocation: string | null;
  source: string | null;
  leadCivility: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadEmail: string | null;
  leadJobTitle: string | null;
  customValues?: string | Record<string, unknown>;
}

export interface UserAIConfig {
  aiProvider: string | null;
  claudeApiKey: string | null;
  geminiApiKey: string | null;
  groqApiKey: string | null;
  openaiApiKey: string | null;
  openrouterApiKey: string | null;
  openrouterModel: string | null;
}

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

type Provider = "claude" | "gemini" | "groq" | "openai" | "openrouter";

/** Substitue {{field}} dans le prompt avec les valeurs de l'offre */
function substituteVars(prompt: string, offer: OfferForAI): string {
  const vars: Record<string, string> = {
    title: offer.title,
    company: offer.company,
    description: offer.description ?? "",
    offerLocation: offer.offerLocation ?? "",
    source: offer.source ?? "",
    leadFirstName: offer.leadFirstName ?? "",
    leadLastName: offer.leadLastName ?? "",
    leadEmail: offer.leadEmail ?? "",
    leadJobTitle: offer.leadJobTitle ?? "",
  };

  // Inject custom field values
  if (offer.customValues) {
    const customParsed: Record<string, unknown> =
      typeof offer.customValues === "string"
        ? JSON.parse(offer.customValues || "{}")
        : offer.customValues;
    for (const [k, v] of Object.entries(customParsed)) {
      if (v != null) vars[k] = String(v);
    }
  }

  return prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function buildContext(offer: OfferForAI): string {
  return [
    `Titre : ${offer.title}`,
    `Entreprise : ${offer.company}`,
    offer.description ? `Description : ${offer.description}` : null,
    offer.offerLocation ? `Localisation : ${offer.offerLocation}` : null,
    offer.source ? `Source : ${offer.source}` : null,
    offer.leadFirstName || offer.leadLastName
      ? `Lead : ${[offer.leadCivility, offer.leadFirstName, offer.leadLastName].filter(Boolean).join(" ")}`
      : null,
    offer.leadJobTitle ? `Poste du lead : ${offer.leadJobTitle}` : null,
    offer.leadEmail ? `Email lead : ${offer.leadEmail}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function callAIProvider(
  user: UserAIConfig,
  prompt: string,
  offer: OfferForAI
): Promise<string> {
  const substituted = substituteVars(prompt, offer);
  const context = buildContext(offer);
  const fullPrompt = `${substituted}\n\nDonnées de l'offre :\n${context}\n\nRéponds de manière concise.`;

  const provider = (user.aiProvider ?? "claude") as Provider;

  const keyMap: Record<Provider, string | null | undefined> = {
    claude: user.claudeApiKey ?? process.env.ANTHROPIC_API_KEY,
    gemini: user.geminiApiKey,
    groq: user.groqApiKey,
    openai: user.openaiApiKey,
    openrouter: user.openrouterApiKey,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    throw new Error(
      `Clé API ${provider} non configurée. Rendez-vous dans Paramètres > Intelligence Artificielle.`
    );
  }

  switch (provider) {
    case "claude":
      return callClaude(apiKey, fullPrompt);
    case "gemini":
      return callGemini(apiKey, fullPrompt);
    case "groq":
      return callGroq(apiKey, fullPrompt);
    case "openai":
      return callOpenAI(apiKey, fullPrompt);
    case "openrouter":
      return callOpenRouter(apiKey, user.openrouterModel || DEFAULT_OPENROUTER_MODEL, fullPrompt);
  }
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].type === "text" ? res.content[0].text.trim() : "";
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Job Offer Tracker",
    },
    body: JSON.stringify({
      model,
      // Marge plus large que les autres fournisseurs : certains modèles
      // OpenRouter consomment des tokens de raisonnement avant de répondre.
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error: ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
