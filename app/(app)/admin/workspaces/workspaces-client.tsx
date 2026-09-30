"use client";

import { useEffect, useMemo, useState } from "react";

interface WorkspaceRow {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; jobOffers: number; customFields: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  workspaceId: string | null;
}

export function AdminWorkspacesClient() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/workspaces");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur de chargement");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setWorkspaces(data.workspaces ?? []);
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la création");
      return;
    }
    setNewName("");
    await refresh();
  }

  async function renameWorkspace(workspaceId: string, currentName: string) {
    const next = prompt("Nouveau nom du workspace", currentName);
    if (!next || next.trim() === "" || next.trim() === currentName) return;

    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors du renommage");
      return;
    }

    await refresh();
  }

  async function deleteWorkspace(workspace: WorkspaceRow) {
    if (!confirm(`Supprimer le workspace ${workspace.name} ?`)) return;

    const res = await fetch(`/api/admin/workspaces/${workspace.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors de la suppression");
      return;
    }

    await refresh();
  }

  async function assignUserToWorkspace(userId: string, workspaceId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors de l'assignation");
      return;
    }

    await refresh();
  }

  const usersByWorkspace = useMemo(() => {
    const map = new Map<string, UserRow[]>();
    for (const w of workspaces) map.set(w.id, []);
    for (const u of users) {
      if (!u.workspaceId) continue;
      const bucket = map.get(u.workspaceId);
      if (bucket) bucket.push(u);
    }
    return map;
  }, [workspaces, users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sonate-green">Workspaces</h1>
        <p className="text-sm text-gray-500 mt-1">Créer, renommer, supprimer et gérer les membres.</p>
      </div>

      <form onSubmit={createWorkspace} className="bg-sonate-ivory-light border border-gray-200 p-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du workspace"
          className="flex-1 border border-gray-300 px-3 py-2 text-sm text-sonate-ink"
          required
        />
        <button type="submit" className="bg-sonate-green text-sonate-ivory px-4 py-2 text-sm font-medium">
          + Créer
        </button>
      </form>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <div className="space-y-4">
          {workspaces.map((workspace) => {
            const members = usersByWorkspace.get(workspace.id) ?? [];
            const availableUsers = users.filter((u) => u.workspaceId !== workspace.id);

            return (
              <section key={workspace.id} className="bg-sonate-ivory-light border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-sonate-green">{workspace.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {workspace._count.users} user(s) · {workspace._count.jobOffers} offre(s) · {workspace._count.customFields} champ(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/settings?workspaceId=${workspace.id}`} className="text-xs underline text-sonate-ink">Paramètres</a>
                    <button onClick={() => renameWorkspace(workspace.id, workspace.name)} className="text-xs text-sonate-ink underline" type="button">Renommer</button>
                    <button onClick={() => deleteWorkspace(workspace)} className="text-xs text-red-500" type="button">Supprimer</button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-sonate-green mb-2">Membres</h3>
                  {members.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun membre</p>
                  ) : (
                    <ul className="text-sm text-gray-700 space-y-1">
                      {members.map((u) => (
                        <li key={u.id}>{u.name} ({u.email})</li>
                      ))}
                    </ul>
                  )}
                </div>

                {availableUsers.length > 0 && (
                  <AssignUserForm
                    users={availableUsers}
                    onAssign={(userId) => assignUserToWorkspace(userId, workspace.id)}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignUserForm({ users, onAssign }: { users: UserRow[]; onAssign: (userId: string) => Promise<void> }) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  const effectiveSelectedUserId = users.some((u) => u.id === selectedUserId)
    ? selectedUserId
    : (users[0]?.id ?? "");

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSelectedUserId) return;
    setLoading(true);
    await onAssign(effectiveSelectedUserId);
    setLoading(false);
  }

  return (
    <form onSubmit={handleAssign} className="flex items-center gap-2 pt-2">
      <select value={effectiveSelectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="flex-1 border border-gray-300 px-2 py-1.5 text-sm">
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
        ))}
      </select>
      <button disabled={loading || !effectiveSelectedUserId} type="submit" className="border border-gray-300 px-3 py-1.5 text-sm text-sonate-ink disabled:opacity-50">
        {loading ? "Ajout..." : "Ajouter user"}
      </button>
    </form>
  );
}
