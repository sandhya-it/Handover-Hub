import {
  AlertOctagon,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AuditHistoryView } from './components/AuditHistoryView.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { EvidenceLedgerView } from './components/EvidenceLedgerView.tsx';
import { GapConflictView } from './components/GapConflictView.tsx';
import { HandoverComposerView } from './components/HandoverComposerView.tsx';
import { LoginView } from './components/LoginView.tsx';
import { MemoryMapView } from './components/MemoryMapView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { ProjectsView } from './components/ProjectsView.tsx';
import { ReviewApprovalView } from './components/ReviewApprovalView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { SharedHandoversView } from './components/SharedHandoversView.tsx';
import { SourceConnectView } from './components/SourceConnectView.tsx';
import { api, getStoredToken, setStoredToken } from './lib/api.ts';
import { User, UserRole, WorkspacePayload } from './types.ts';

type NavKey =
  | 'overview'
  | 'projects'
  | 'sources'
  | 'memory-map'
  | 'evidence'
  | 'conflicts'
  | 'composer'
  | 'review'
  | 'shared'
  | 'audit'
  | 'settings';

const NAV_ITEMS: Array<{ key: NavKey; label: string; Icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', Icon: FolderKanban },
  { key: 'sources', label: 'Source Connect', Icon: UploadCloud },
  { key: 'memory-map', label: 'Project Memory Map', Icon: GitBranch },
  { key: 'evidence', label: 'Evidence Ledger', Icon: ShieldCheck },
  { key: 'conflicts', label: 'Gap & Conflict Detector', Icon: AlertOctagon },
  { key: 'composer', label: 'Handover Composer', Icon: Sparkles },
  { key: 'review', label: 'Review & Approval', Icon: FileCheck },
  { key: 'shared', label: 'Shared Handovers', Icon: Share2 },
  { key: 'audit', label: 'Audit History', Icon: History },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<User[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [activeView, setActiveView] = useState<NavKey>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-smart-campus');
  const [focusedClaimId, setFocusedClaimId] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const accountsRes = await api.getDemoAccounts();
        if (!cancelled) {
          setDemoAccounts(accountsRes.accounts);
        }
        const token = getStoredToken();
        if (token) {
          const ws = await api.getWorkspace();
          if (!cancelled) {
            setWorkspace(ws);
            if (ws.projects.length > 0 && !ws.projects.some((p) => p.id === selectedProjectId)) {
              setSelectedProjectId(ws.projects[0].id);
            }
          }
        }
      } catch {
        setStoredToken(null);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAuthenticated = (ws: WorkspacePayload) => {
    setWorkspace(ws);
    if (ws.currentUser.role === 'Incoming Member') {
      setActiveView('shared');
    } else {
      setActiveView('overview');
    }
    if (ws.projects.some((p) => p.id === 'proj-smart-campus')) {
      setSelectedProjectId('proj-smart-campus');
    } else if (ws.projects[0]) {
      setSelectedProjectId(ws.projects[0].id);
    }
  };

  const handleSignOut = () => {
    setStoredToken(null);
    setWorkspace(null);
    setShowProfileMenu(false);
  };

  const handleQuickRoleSwitch = async (role: UserRole) => {
    try {
      const ws = await api.demoLogin(role);
      handleAuthenticated(ws);
      setShowProfileMenu(false);
    } catch {
      // ignore
    }
  };

  const handleLoadDemoWorkspace = async () => {
    setLoadingDemo(true);
    try {
      const next = await api.loadDemoWorkspace();
      setWorkspace(next);
      setSelectedProjectId('proj-smart-campus');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleInspectClaim = (claimId: string) => {
    setFocusedClaimId(claimId);
    setActiveView('evidence');
  };

  const selectedProject = useMemo(() => {
    if (!workspace) return null;
    return (
      workspace.projects.find((p) => p.id === selectedProjectId) ||
      workspace.projects[0] ||
      null
    );
  }, [workspace, selectedProjectId]);

  const searchResults = useMemo(() => {
    if (!workspace || !globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const results: Array<{ id: string; label: string; meta: string; view: NavKey; claimId?: string }> = [];

    workspace.claims
      .filter((c) => c.text.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((c) =>
        results.push({
          id: c.id,
          label: `${c.id}: ${c.text.slice(0, 64)}`,
          meta: `Claim · ${c.category}`,
          view: 'evidence',
          claimId: c.id,
        })
      );

    workspace.sources
      .filter((s) => s.filename.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((s) =>
        results.push({
          id: s.id,
          label: s.filename,
          meta: `Source · ${s.id}`,
          view: 'sources',
        })
      );

    workspace.handovers
      .filter((h) => h.title.toLowerCase().includes(q) || h.id.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((h) =>
        results.push({
          id: h.id,
          label: h.title,
          meta: `Handover · ${h.status}`,
          view: h.status === 'SHARED' || h.status === 'ACKNOWLEDGED' ? 'shared' : 'review',
        })
      );

    return results;
  }, [workspace, globalSearch]);

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-300 flex items-center justify-center text-sm">
        Initializing Handover Hub...
      </div>
    );
  }

  if (!workspace) {
    return <LoginView demoAccounts={demoAccounts} onAuthenticated={handleAuthenticated} />;
  }

  const unreadNotifs = workspace.notifications.filter((n) => !n.read);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-800/80 bg-[#0F1623] transition-all duration-150 shrink-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[256px]'
        }`}
      >
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <BrandLogo compact={sidebarCollapsed} />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 rounded-md cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.Icon;
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600/20 text-cyan-200 border border-blue-500/35'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            disabled={loadingDemo}
            onClick={handleLoadDemoWorkspace}
            title="Restore Smart Campus Management System demo baseline"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#131C2E] hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[11px] font-medium text-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 shrink-0 ${loadingDemo ? 'animate-spin' : ''}`} />
            {!sidebarCollapsed && <span className="truncate">LOAD DEMO WORKSPACE</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 bg-[#0F1623] border-r border-slate-800 h-full flex flex-col z-10">
            <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.Icon;
                const active = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveView(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active
                        ? 'bg-blue-600/20 text-cyan-200 border border-blue-500/35'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  void handleLoadDemoWorkspace();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 px-3 bg-[#131C2E] border border-slate-700 rounded-lg text-xs font-medium text-slate-200"
              >
                LOAD DEMO WORKSPACE
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0F1623]/90 backdrop-blur-xs px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Current Project Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500">Project</span>
              <select
                value={selectedProject?.id || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Current project"
                className="bg-[#090D16] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-100 max-w-[200px] sm:max-w-[260px] truncate"
              >
                {workspace.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Search */}
            <div className="relative flex-1 max-w-md hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search claims, sources, or handovers..."
                className="w-full bg-[#090D16] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-[#0F1623] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-40">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        setGlobalSearch('');
                        if (res.claimId) {
                          handleInspectClaim(res.claimId);
                        } else {
                          setActiveView(res.view);
                        }
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#131C2E] border-b border-slate-800/70 last:border-0 cursor-pointer"
                    >
                      <div className="text-xs text-slate-100 truncate">{res.label}</div>
                      <div className="text-[11px] font-mono text-cyan-400">{res.meta}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Notifications & User Profile + Role */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifs((v) => !v);
                  setShowProfileMenu(false);
                }}
                className="relative p-2 bg-[#090D16] hover:bg-[#131C2E] border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-blue-600 text-[10px] font-mono text-white flex items-center justify-center">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0F1623] border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2 z-50">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-200">Notifications</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = await api.markNotificationRead();
                        setWorkspace(next);
                      }}
                      className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  {workspace.notifications.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No notifications
                    </div>
                  ) : (
                    workspace.notifications.slice(0, 5).map((ntf) => (
                      <button
                        key={ntf.id}
                        type="button"
                        onClick={async () => {
                          setShowNotifs(false);
                          setActiveView(ntf.targetView as NavKey);
                          if (!ntf.read) {
                            const next = await api.markNotificationRead(ntf.id);
                            setWorkspace(next);
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          ntf.read
                            ? 'bg-[#090D16]/60 border-slate-800/70 text-slate-400'
                            : 'bg-[#131C2E] border-blue-500/30 text-slate-100'
                        }`}
                      >
                        <div className="text-xs font-medium">{ntf.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                          {ntf.description}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* User Profile & Role Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu((v) => !v);
                  setShowNotifs(false);
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 bg-[#090D16] hover:bg-[#131C2E] border border-slate-800 rounded-lg cursor-pointer"
              >
                <span className="w-7 h-7 rounded-md bg-blue-600/25 border border-blue-500/40 text-cyan-200 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                  {workspace.currentUser.avatarInitials}
                </span>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-medium text-slate-100 whitespace-nowrap">
                    {workspace.currentUser.name}
                  </div>
                  <div className="text-[11px] text-cyan-400 whitespace-nowrap">
                    {workspace.currentUser.role}
                  </div>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0F1623] border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2 z-50">
                  <div className="px-2 pb-2 border-b border-slate-800">
                    <div className="text-xs font-semibold text-slate-100">
                      {workspace.currentUser.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{workspace.currentUser.email}</div>
                    <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                      Role: {workspace.currentUser.role}
                    </div>
                  </div>

                  <div className="px-2 py-1 text-[11px] text-slate-500">
                    Switch Demo Role
                  </div>
                  {(
                    [
                      'Administrator',
                      'Project Reviewer',
                      'Departing Member',
                      'Incoming Member',
                    ] as UserRole[]
                  ).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleQuickRoleSwitch(role)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        workspace.currentUser.role === role
                          ? 'bg-blue-600/20 text-cyan-300'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {role}
                    </button>
                  ))}

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 rounded-md cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeView === 'overview' && (
            <OverviewView
              workspace={workspace}
              selectedProject={selectedProject}
              onNavigate={(v) => setActiveView(v as NavKey)}
              onSelectProject={setSelectedProjectId}
            />
          )}
          {activeView === 'projects' && (
            <ProjectsView
              workspace={workspace}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onWorkspaceUpdated={setWorkspace}
              onNavigate={(v) => setActiveView(v as NavKey)}
            />
          )}
          {activeView === 'sources' && (
            <SourceConnectView
              workspace={workspace}
              selectedProject={selectedProject}
              onWorkspaceUpdated={setWorkspace}
              onNavigate={(v) => setActiveView(v as NavKey)}
            />
          )}
          {activeView === 'memory-map' && (
            <MemoryMapView
              workspace={workspace}
              selectedProject={selectedProject}
              onInspectClaim={handleInspectClaim}
            />
          )}
          {activeView === 'evidence' && (
            <EvidenceLedgerView
              workspace={workspace}
              selectedProject={selectedProject}
              focusedClaimId={focusedClaimId}
              onClearFocus={() => setFocusedClaimId(null)}
              onWorkspaceUpdated={setWorkspace}
            />
          )}
          {activeView === 'conflicts' && (
            <GapConflictView
              workspace={workspace}
              selectedProject={selectedProject}
              onWorkspaceUpdated={setWorkspace}
              onInspectClaim={handleInspectClaim}
            />
          )}
          {activeView === 'composer' && (
            <HandoverComposerView
              workspace={workspace}
              selectedProject={selectedProject}
              onWorkspaceUpdated={setWorkspace}
              onInspectClaim={handleInspectClaim}
              onNavigate={(v) => setActiveView(v as NavKey)}
            />
          )}
          {activeView === 'review' && (
            <ReviewApprovalView
              workspace={workspace}
              selectedProject={selectedProject}
              onWorkspaceUpdated={setWorkspace}
              onInspectClaim={handleInspectClaim}
              onNavigate={(v) => setActiveView(v as NavKey)}
            />
          )}
          {activeView === 'shared' && (
            <SharedHandoversView
              workspace={workspace}
              onWorkspaceUpdated={setWorkspace}
              onInspectClaim={handleInspectClaim}
            />
          )}
          {activeView === 'audit' && <AuditHistoryView workspace={workspace} />}
          {activeView === 'settings' && (
            <SettingsView workspace={workspace} onWorkspaceUpdated={setWorkspace} />
          )}
        </main>
      </div>
    </div>
  );
}
