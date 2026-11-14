import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  ShieldAlert,
} from 'lucide-react';
import { Project, WorkspacePayload } from '../types.ts';

interface OverviewViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onNavigate: (view: string) => void;
  onSelectProject: (projectId: string) => void;
}

export function OverviewView({
  workspace,
  selectedProject,
  onNavigate,
  onSelectProject,
}: OverviewViewProps) {
  const { projects, handovers, sources, claims, conflicts, gaps, auditLogs } = workspace;

  const activeHandovers = handovers.filter((h) => h.status !== 'ACKNOWLEDGED').length;
  const pendingReviews = handovers.filter(
    (h) => h.status === 'DRAFT' || h.status === 'UNDER_REVIEW' || h.status === 'CHANGES_REQUESTED'
  ).length;
  const unresolvedConflicts = conflicts.filter((c) => c.status === 'OPEN').length;
  const approvedHandovers = handovers.filter(
    (h) => h.status === 'APPROVED' || h.status === 'SHARED' || h.status === 'ACKNOWLEDGED'
  ).length;

  const kpis = [
    { label: 'Total Projects', value: projects.length, target: 'projects' },
    { label: 'Active Handovers', value: activeHandovers, target: 'composer' },
    { label: 'Documents Processed', value: sources.length, target: 'sources' },
    { label: 'Pending Reviews', value: pendingReviews, target: 'review' },
    { label: 'Unresolved Conflicts', value: unresolvedConflicts, target: 'conflicts' },
    { label: 'Approved Handovers', value: approvedHandovers, target: 'shared' },
  ];

  // Project Status Overview counts
  const statusBuckets = [
    { status: 'Active', count: projects.filter((p) => p.status === 'Active').length, color: 'bg-cyan-400' },
    { status: 'In Progress', count: projects.filter((p) => p.status === 'In Progress').length, color: 'bg-blue-500' },
    { status: 'Blocked', count: projects.filter((p) => p.status === 'Blocked').length, color: 'bg-red-500' },
    { status: 'Completed', count: projects.filter((p) => p.status === 'Completed').length, color: 'bg-emerald-500' },
  ];

  // Knowledge Continuity Health (Prototype Indicator) scoped to selectedProject or all
  const scopedClaims = selectedProject
    ? claims.filter((c) => c.projectId === selectedProject.id)
    : claims;
  const scopedConflicts = selectedProject
    ? conflicts.filter((c) => c.projectId === selectedProject.id)
    : conflicts;
  const scopedHandovers = selectedProject
    ? handovers.filter((h) => h.projectId === selectedProject.id)
    : handovers;

  const supportedCount = scopedClaims.filter((c) => c.verificationStatus === 'SUPPORTED').length;
  const evidenceCoverage =
    scopedClaims.length > 0 ? Math.round((supportedCount / scopedClaims.length) * 100) : 0;

  const openConfCount = scopedConflicts.filter((c) => c.status === 'OPEN').length;
  const conflictScore =
    scopedConflicts.length > 0
      ? Math.round(((scopedConflicts.length - openConfCount) / scopedConflicts.length) * 100)
      : 100;

  const taskClaims = scopedClaims.filter((c) => c.category === 'Task');
  const assignedTasks = taskClaims.filter((c) => Boolean(c.owner)).length;
  const ownershipScore =
    taskClaims.length > 0 ? Math.round((assignedTasks / taskClaims.length) * 100) : 100;

  const approvedCount = scopedHandovers.filter(
    (h) => h.status === 'APPROVED' || h.status === 'SHARED' || h.status === 'ACKNOWLEDGED'
  ).length;
  const reviewScore =
    scopedHandovers.length > 0 ? Math.round((approvedCount / scopedHandovers.length) * 100) : 0;

  const healthScore = Math.round(
    evidenceCoverage * 0.4 + conflictScore * 0.25 + ownershipScore * 0.2 + reviewScore * 0.15
  );

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  const pendingActionItems = gaps
    .filter((g) => g.status === 'OPEN')
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Continuity Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Workspace verification status, open transition gaps, and handover readiness across active projects.
          </p>
        </div>
        {selectedProject && (
          <div className="text-xs text-slate-400 font-mono">
            Focus Project: <span className="text-slate-200">{selectedProject.name}</span>
          </div>
        )}
      </div>

      {/* 6 Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.target)}
            className="text-left bg-[#0F1623] hover:bg-[#131C2E] border border-slate-800/90 hover:border-blue-500/40 rounded-xl p-4 transition-colors cursor-pointer"
          >
            <div className="text-xs text-slate-400 mb-2 truncate">{kpi.label}</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold text-slate-50 tabular-nums">
                {kpi.value}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </button>
        ))}
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Knowledge Continuity Health */}
        <section className="lg:col-span-5 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Knowledge Continuity Health
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Prototype Indicator — derived from evidence coverage, conflict resolution, ownership, and review state.
                </p>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 whitespace-nowrap shrink-0">
                Prototype Metric
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 my-4">
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.14)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke={healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#3B82F6' : '#F59E0B'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    {healthScore}%
                  </span>
                  <span className="text-[11px] text-slate-400">Continuity</span>
                </div>
              </div>

              <div className="w-full space-y-3">
                {[
                  { label: 'Evidence Coverage', val: evidenceCoverage, bar: 'bg-emerald-500' },
                  { label: 'Conflict Resolution', val: conflictScore, bar: 'bg-cyan-400' },
                  { label: 'Ownership Completeness', val: ownershipScore, bar: 'bg-blue-500' },
                  { label: 'Review & Approval State', val: reviewScore, bar: 'bg-violet-500' },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{metric.label}</span>
                      <span className="font-mono text-slate-200 tabular-nums">{metric.val}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${metric.bar}`}
                        style={{ width: `${metric.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>{supportedCount} supported of {scopedClaims.length} claims</span>
            <button
              type="button"
              onClick={() => onNavigate('evidence')}
              className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
            >
              Inspect Evidence Ledger
            </button>
          </div>
        </section>

        {/* Project Status Overview */}
        <section className="lg:col-span-7 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Project Status Overview
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Distribution across Active, In Progress, Blocked, and Completed continuity initiatives.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Manage Projects
              </button>
            </div>

            {/* Horizontal Proportion Bar */}
            <div className="h-3 w-full rounded-lg bg-slate-800/90 overflow-hidden flex mb-4">
              {statusBuckets.map((b) =>
                b.count > 0 ? (
                  <div
                    key={b.status}
                    className={`${b.color} h-full transition-all`}
                    style={{ width: `${(b.count / Math.max(projects.length, 1)) * 100}%` }}
                    title={`${b.status}: ${b.count}`}
                  />
                ) : null
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {statusBuckets.map((b) => (
                <div key={b.status} className="bg-[#131C2E] border border-slate-800/80 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className={`w-2 h-2 rounded-sm ${b.color}`} />
                    <span>{b.status}</span>
                  </div>
                  <div className="font-mono text-lg font-semibold text-slate-100 tabular-nums">
                    {b.count}
                  </div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-800/70">
              {projects.map((p) => {
                const pClaims = claims.filter((c) => c.projectId === p.id);
                const pConflicts = conflicts.filter(
                  (c) => c.projectId === p.id && c.status === 'OPEN'
                ).length;
                const isSelected = selectedProject?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.id)}
                        className={`font-medium truncate text-left hover:text-cyan-400 transition-colors cursor-pointer ${
                          isSelected ? 'text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        {p.name}
                      </button>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Lead: {p.leadName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{pClaims.length} claims</span>
                        {pConflicts > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-red-400 font-mono tabular-nums">
                              {pConflicts} open conflicts
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-300 whitespace-nowrap shrink-0">
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Pending Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Pending Actions & Verification Queue
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('conflicts')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              Open Detector
            </button>
          </div>

          {pendingActionItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              All detected gaps and conflicts have been resolved.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {pendingActionItems.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      {item.severity === 'Critical' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span
                        className={`font-mono font-medium ${
                          item.severity === 'Critical'
                            ? 'text-red-400'
                            : item.severity === 'High'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400">{item.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-200 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.sourceRef}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(item.conflictId ? 'conflicts' : item.claimId ? 'evidence' : 'conflicts')
                    }
                    className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              View Audit History
            </button>
          </div>

          <div className="divide-y divide-slate-800/70">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-3 flex items-start gap-3">
                <div className="mt-0.5 text-slate-400 shrink-0">
                  {log.category === 'SOURCE' ? (
                    <FileText className="w-4 h-4 text-cyan-400" />
                  ) : log.category === 'PROJECT' ? (
                    <FolderKanban className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-violet-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 leading-snug">{log.action}</p>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-slate-300">{log.userName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{log.userRole}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
