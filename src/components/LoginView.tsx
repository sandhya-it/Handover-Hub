import { ArrowRight, KeyRound, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { User, UserRole, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface LoginViewProps {
  demoAccounts: User[];
  onAuthenticated: (workspace: WorkspacePayload) => void;
}

const ROLE_DESCRIPTIONS: Record<UserRole, { summary: string; credentials: string }> = {
  Administrator: {
    summary: 'Manage users, project access, permissions, and full audit history.',
    credentials: 'admin@handoverhub.dev · Admin@2026',
  },
  'Project Reviewer': {
    summary: 'Verify claims, resolve cross-document conflicts, and approve handovers.',
    credentials: 'reviewer@handoverhub.dev · Review@2026',
  },
  'Departing Member': {
    summary: 'Upload sources, run knowledge extraction, and compose draft handovers.',
    credentials: 'departing@handoverhub.dev · Depart@2026',
  },
  'Incoming Member': {
    summary: 'Inspect approved handovers, review next actions, and acknowledge receipt.',
    credentials: 'incoming@handoverhub.dev · Receive@2026',
  },
};

export function LoginView({ demoAccounts, onAuthenticated }: LoginViewProps) {
  const [email, setEmail] = useState('reviewer@handoverhub.dev');
  const [password, setPassword] = useState('Review@2026');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingRole('form');
    try {
      const workspace = await api.login(email, password);
      onAuthenticated(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleDemoLogin = async (role: UserRole) => {
    setError(null);
    setLoadingRole(role);
    try {
      const workspace = await api.demoLogin(role);
      onAuthenticated(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize demo session');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between px-6 py-8 lg:px-12">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-8 pb-6 border-b border-slate-800/80">
        <BrandLogo />
        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2">
          <span>Team AetherGrid</span>
          <span aria-hidden="true">·</span>
          <span>Round 2 Working Prototype</span>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto my-auto py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <section className="lg:col-span-5 flex flex-col justify-between bg-[#0F1623] border border-slate-800/90 rounded-xl p-8">
          <div>
            <p className="text-xs font-medium text-cyan-400 tracking-wide mb-3">
              Evidence-First Knowledge Continuity
            </p>
            <h1
              className="font-display text-3xl font-bold tracking-tight text-slate-50 leading-tight mb-4"
              style={{ textWrap: 'balance' }}
            >
              Never Lose Knowledge. Ensure Every Transition Continues.
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              Sign in to inspect extracted project claims, trace statements back to exact page,
              row, and paragraph sources, resolve contradictions, and approve verified handovers.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-email">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@handoverhub.dev"
                    className="w-full bg-[#090D16] border border-slate-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-[#090D16] border border-slate-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingRole !== null}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loadingRole === 'form' ? 'Signing In...' : 'Sign In to Workspace'}</span>
              </button>
            </form>
          </div>

          <div className="pt-6 mt-8 border-t border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Server-side RBAC enforced on every claim, conflict, and approval action.</span>
          </div>
        </section>

        <section className="lg:col-span-7 bg-[#0F1623] border border-slate-800/90 rounded-xl p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-100">
                  Demo Role Access
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Launch directly into any role to test least-privilege transitions in Smart Campus Management System.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">4 Active Roles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {demoAccounts.map((acc) => {
                const info = ROLE_DESCRIPTIONS[acc.role];
                const isBusy = loadingRole === acc.role;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={loadingRole !== null}
                    onClick={() => handleDemoLogin(acc.role)}
                    className="group text-left bg-[#131C2E] hover:bg-[#182338] border border-slate-800 hover:border-blue-500/40 rounded-lg p-5 transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-display text-sm font-semibold text-slate-100">
                          {acc.role}
                        </span>
                        <UserCheck className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                      </div>
                      <div className="text-xs text-blue-400 font-medium mb-2">
                        {acc.name} · {acc.title}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        {info.summary}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800/90 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-500 truncate">
                        {info.credentials}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 whitespace-nowrap shrink-0">
                        <span>{isBusy ? 'Opening...' : 'Enter'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
            <div>
              <div className="text-slate-200 font-medium mb-0.5">Lead & Governance</div>
              <div>Sandhya S · Team Lead</div>
            </div>
            <div>
              <div className="text-slate-200 font-medium mb-0.5">Engineering Team</div>
              <div>Monishwaran B · Pooja Ravi · Pooja G</div>
            </div>
            <div>
              <div className="text-slate-200 font-medium mb-0.5">Sample Workspace</div>
              <div>Smart Campus Management System</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <span>Handover Hub · AetherGrid Knowledge Continuity Platform</span>
        <span>Evidence-backed AI transitions · Human-verified approvals</span>
      </footer>
    </div>
  );
}
