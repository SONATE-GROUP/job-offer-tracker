import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { output_modalities?: string[] };
}

/** Liste des modèles OpenRouter produisant du texte (catalogue public, mis en cache 1 h). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const { data } = (await res.json()) as { data: OpenRouterModel[] };

    const models = data
      .filter((m) => m.architecture?.output_modalities?.includes("text") ?? true)
      .map((m) => ({
        id: m.id,
        name: m.name,
        // Prix en $ par million de tokens (l'API les donne par token)
        promptPrice: m.pricing?.prompt ? Number(m.pricing.prompt) * 1_000_000 : null,
        completionPrice: m.pricing?.completion ? Number(m.pricing.completion) * 1_000_000 : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(models);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
