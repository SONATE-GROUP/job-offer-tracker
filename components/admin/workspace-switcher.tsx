"use client";

import { useRouter } from "next/navigation";

interface Workspace {
  id: string;
  name: string;
}

export function WorkspaceSwitcher({ workspaces, currentWorkspaceId }: { workspaces: Workspace[]; currentWorkspaceId: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500">Workspace :</label>
      <select
        value={currentWorkspaceId}
        onChange={(e) => router.push(`/dashboard?workspaceId=${e.target.value}`)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-sonate-ink focus:outline-none focus:ring-2 focus:ring-sonate-orange bg-sonate-ivory-light"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
