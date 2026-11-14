import { Database, RefreshCw, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { UserRole, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';

interface SettingsViewProps {
  workspace: WorkspacePayload;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
}

export function SettingsView({ workspace, onWorkspaceUpdated }: SettingsViewProps) {
  const { users, currentUser, capabilities } = workspace;
  const isAdmin = currentUser.role === 'Administrator';
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.updateUserRole(userId, { role });
      onWorkspaceUpdated(next);
      setBanner({ type: 'ok', text: 'Updated user permissions and logged audit event.' });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.loadDemoWorkspace();
      onWorkspaceUpdated(next);
      setConfirmReset(false);
      setBanner({
        type: 'ok',
        text: 'Clean Demo Workspace loaded: Smart Campus Management System baseline restored.',
      });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Reset failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
          Settings & Governance
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Role-based access controls, runtime configuration summary, and demonstration workspace controls.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs ${
            banner.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Runtime Environment Status (No Secret Inputs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-100">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>AI Processing Mode</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Server-side document extraction and handover synthesis use environment-injected credentials with automatic deterministic fallback when offline.
          </p>
          <div className="pt-2 text-xs font-mono space-y-1">
            <div>
              Status:{' '}
              <span className={capabilities.geminiConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                {capabilities.geminiConfigured
                  ? 'Live Gemini AI Enabled'
                  : 'Deterministic Fallback Active'}
              </span>
            </div>
            <div className="text-slate-400">Model Target: {capabilities.aiModel}</div>
          </div>
        </section>

        <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-100">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Persistence & Demo Workspace</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Storage Mode:{' '}
            <span className="font-mono text-slate-200">
              {capabilities.supabaseConfigured
                ? 'Supabase PostgreSQL Connected'
                : 'Local Persistent Demo Store'}
            </span>
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>LOAD DEMO WORKSPACE</span>
            </button>
          </div>
        </section>
      </div>

      {/* Role & Permissions Table */}
      <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span>Workspace Accounts & Role Permissions</span>
          </h2>
          {!isAdmin && (
            <span className="text-xs text-slate-500">
              Sign in as Administrator to modify user roles
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                <th className="py-3 px-4 font-medium">Member</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Department / Title</th>
                <th className="py-3 px-4 font-medium">Assigned Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium text-slate-100">{u.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-400">{u.email}</td>
                  <td className="py-3 px-4 text-xs text-slate-300">
                    {u.title} · {u.department}
                  </td>
                  <td className="py-3 px-4">
                    {isAdmin ? (
                      <select
                        disabled={busy || u.id === currentUser.id}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="bg-[#090D16] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100"
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Project Reviewer">Project Reviewer</option>
                        <option value="Departing Member">Departing Member</option>
                        <option value="Incoming Member">Incoming Member</option>
                      </select>
                    ) : (
                      <span className="font-mono text-xs text-cyan-400">{u.role}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmReset && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0F1623] border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Load Clean Demo Workspace?
            </h3>
            <p className="text-sm text-slate-400">
              This restores the complete Smart Campus Management System demonstration dataset (5 sources, 24 claims, 2 seeded conflicts, and draft handover).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 text-xs text-slate-300 bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLoadDemo}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
              >
                {busy ? 'Loading...' : 'Confirm Load Demo Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
