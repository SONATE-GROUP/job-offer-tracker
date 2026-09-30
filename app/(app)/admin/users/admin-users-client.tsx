"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  workspaceId: string | null;
  workspace: { name: string } | null;
}

interface WorkspaceOption {
  id: string;
  name: string;
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setWorkspaces(data.workspaces ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  async function changeWorkspace(userId: string, workspaceId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors de l'assignation workspace");
      return;
    }

    const updated = await res.json();
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sonate-green">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} compte{users.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-sonate-green text-sonate-ivory px-4 py-2 rounded-lg text-sm font-medium">
          + Créer un compte
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Chargement...</p>
      ) : (
        <div className="bg-sonate-ivory-light rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sonate-green text-sonate-ivory">
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Rôle</th>
                <th className="text-left px-4 py-3">Workspace</th>
                <th className="text-left px-4 py-3">Créé le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-sonate-ink">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3 text-gray-600">{user.role === "ADMIN" ? "Tous (ADMIN)" : (
                      <select
                        value={user.workspaceId ?? ""}
                        onChange={(e) => { void changeWorkspace(user.id, e.target.value); }}
                        className="border border-gray-300 px-2 py-1 text-xs"
                      >
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    )}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      {user.workspaceId && (
                        <Link href={`/settings?workspaceId=${user.workspaceId}`} className="text-xs underline text-sonate-ink">
                          Paramètres
                        </Link>
                      )}
                      <button onClick={() => deleteUser(user.id, user.name)} className="text-xs text-gray-400 hover:text-red-500">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          workspaces={workspaces}
          onClose={() => setShowCreate(false)}
          onCreated={(u) => {
            setUsers((prev) => [...prev, u]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated, workspaces }: { onClose: () => void; onCreated: (user: UserRow) => void; workspaces: WorkspaceOption[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, workspaceId: role === "ADMIN" ? null : workspaceId }),
    });
    if (res.ok) onCreated(await res.json());
    else {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la création");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-sonate-green-dark/50 flex items-center justify-center z-50">
      <div className="bg-sonate-ivory-light rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4 text-sonate-green">Créer un compte</h2>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nom" className="w-full border px-3 py-2" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full border px-3 py-2" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mot de passe" className="w-full border px-3 py-2" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border px-3 py-2">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {role !== "ADMIN" && (
            <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full border px-3 py-2" required>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border py-2 text-sm">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 bg-sonate-green py-2 text-sm font-medium">
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
