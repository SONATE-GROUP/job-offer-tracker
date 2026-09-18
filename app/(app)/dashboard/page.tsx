import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OffersTable } from "@/components/table/offers-table";
import { WorkspaceSwitcher } from "@/components/admin/workspace-switcher";
import { MantikSearchPanel } from "@/components/admin/mantiks-search-panel";

interface Props {
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const isAdmin = session!.user.role === "ADMIN";

  const { workspaceId: workspaceParam } = await searchParams;

  const allWorkspaces = isAdmin
    ? await prisma.workspace.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
    : null;

  const targetWorkspaceId = isAdmin
    ? workspaceParam ?? allWorkspaces?.[0]?.id
    : session!.user.workspaceId;

  if (!targetWorkspaceId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-brand-dark">Offres & Leads</h1>
        <p className="text-sm text-gray-500">Aucun workspace sélectionné.</p>
      </div>
    );
  }

  const [customFields, workspace] = await Promise.all([
    prisma.customFieldDef.findMany({ where: { workspaceId: targetWorkspaceId }, orderBy: { order: "asc" } }),
    prisma.workspace.findUnique({
      where: { id: targetWorkspaceId },
      select: { name: true, prospectingProvider: true, lgmAudiences: true, emeliaCampaigns: true },
    }),
  ]);

  let campaigns: string[] = [];
  try {
    const provider = workspace?.prospectingProvider ?? "lgm";
    const raw = provider === "emelia" ? workspace?.emeliaCampaigns : workspace?.lgmAudiences;
    campaigns = JSON.parse(raw ?? "[]");
  } catch {}

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Offres & Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? `Workspace: ${workspace?.name ?? "Inconnu"}` : "Toutes les offres reçues via votre webhook"}
          </p>
        </div>

        {isAdmin && allWorkspaces && allWorkspaces.length > 0 && (
          <WorkspaceSwitcher workspaces={allWorkspaces} currentWorkspaceId={targetWorkspaceId} />
        )}
      </div>

      {isAdmin && (
        <div className="mb-6">
          <MantikSearchPanel workspaceId={targetWorkspaceId} />
        </div>
      )}

      <OffersTable key={targetWorkspaceId} customFields={customFields} targetWorkspaceId={isAdmin ? targetWorkspaceId : undefined} campaigns={campaigns} isAdmin={isAdmin} />
    </div>
  );
}
