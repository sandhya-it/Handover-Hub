import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  ShieldAlert,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ConflictRecord, Project, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';

interface GapConflictViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onInspectClaim: (claimId: string) => void;
}

export function GapConflictView({
  workspace,
  selectedProject,
  onWorkspaceUpdated,
  onInspectClaim,
}: GapConflictViewProps) {
  const { conflicts, gaps, currentUser } = workspace;
  const canResolve =
    currentUser.role === 'Administrator' || currentUser.role === 'Project Reviewer';

  const [tab, setTab] = useState<'ALL' | 'CONFLICTS' | 'GAPS'>('ALL');
  const [resolvingConflict, setResolvingConflict] = useState<ConflictRecord | null>(null);
  const [winningSide, setWinningSide] = useState<'A' | 'B' | 'SYNTHESIZED'>('B');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!selectedProject) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
        Select a project to run Gap & Conflict Detection.
      </div>
    );
  }

  const projectConflicts = conflicts.filter((c) => c.projectId === selectedProject.id);
  const projectGaps = gaps.filter((g) => g.projectId === selectedProject.id);

  const openGaps = projectGaps.filter((g) => g.status === 'OPEN');
  const criticalCount = openGaps.filter((g) => g.severity === 'Critical').length;
  const highCount = openGaps.filter((g) => g.severity === 'High').length;
  const mediumCount = openGaps.filter((g) => g.severity === 'Medium').length;

  const openResolveModal = (conf: ConflictRecord) => {
    setResolvingConflict(conf);
    setWinningSide('B');
    setResolutionSummary(conf.statementB);
    setReviewerComment('');
    setError(null);
  };

  const handleResolveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolvingConflict) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.resolveConflict(resolvingConflict.id, {
        winningSide,
        resolutionSummary,
        reviewerComment,
      });
      onWorkspaceUpdated(next);
      setSuccessMsg(`Conflict ${resolvingConflict.id} resolved and logged to Audit History.`);
      setResolvingConflict(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resolve conflict');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Gap & Conflict Detector
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cross-document contradictions, missing owners, undocumented rationales, blockers, and unsupported claims.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0F1623] border border-slate-800 rounded-lg">
          {(['ALL', 'CONFLICTS', 'GAPS'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'ALL'
                ? `All (${projectConflicts.length + projectGaps.filter((g) => g.type !== 'CONFLICT').length})`
                : t === 'CONFLICTS'
                ? `Conflicts (${projectConflicts.length})`
                : `Project Gaps (${projectGaps.filter((g) => g.type !== 'CONFLICT').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0F1623] border border-red-500/25 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Critical Severity</div>
            <div className="font-mono text-2xl font-bold text-red-400 mt-1 tabular-nums">
              {criticalCount}
            </div>
          </div>
          <ShieldAlert className="w-6 h-6 text-red-400/70" />
        </div>
        <div className="bg-[#0F1623] border border-amber-500/25 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">High Severity</div>
            <div className="font-mono text-2xl font-bold text-amber-400 mt-1 tabular-nums">
              {highCount}
            </div>
          </div>
          <AlertTriangle className="w-6 h-6 text-amber-400/70" />
        </div>
        <div className="bg-[#0F1623] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Medium Severity</div>
            <div className="font-mono text-2xl font-bold text-slate-200 mt-1 tabular-nums">
              {mediumCount}
            </div>
          </div>
          <GitCompare className="w-6 h-6 text-cyan-400/70" />
        </div>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cross-Document Conflicts */}
      {(tab === 'ALL' || tab === 'CONFLICTS') && (
        <section className="space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Cross-Document Disagreements ({projectConflicts.length})
          </h2>

          {projectConflicts.length === 0 ? (
            <div className="bg-[#0F1623] border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
              No cross-document conflicts detected for {selectedProject.name}.
            </div>
          ) : (
            projectConflicts.map((conf) => (
              <div
                key={conf.id}
                className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-mono text-cyan-400">{conf.id}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono font-medium ${
                          conf.severity === 'Critical' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {conf.severity}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-medium ${
                          conf.status === 'OPEN' ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {conf.status === 'OPEN' ? 'Unresolved Conflict' : 'Resolved'}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-100">
                      {conf.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{conf.description}</p>
                  </div>

                  {conf.status === 'OPEN' && canResolve && (
                    <button
                      type="button"
                      onClick={() => openResolveModal(conf)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Resolve Conflict
                    </button>
                  )}
                </div>

                {/* Side-by-Side Statements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#090D16] border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-blue-400">Statement A</span>
                      <span className="font-mono text-slate-400">
                        {conf.sourceAId} · {conf.sourceALocation}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">{conf.statementA}</p>
                    <div className="text-xs text-slate-500">{conf.sourceAFilename}</div>
                  </div>

                  <div className="bg-[#090D16] border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-violet-400">Statement B</span>
                      <span className="font-mono text-slate-400">
                        {conf.sourceBId} · {conf.sourceBLocation}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">{conf.statementB}</p>
                    <div className="text-xs text-slate-500">{conf.sourceBFilename}</div>
                  </div>
                </div>

                {conf.status === 'RESOLVED' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Resolved by {conf.resolvedBy} on{' '}
                        {conf.resolvedAt ? new Date(conf.resolvedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-slate-200">Decision: {conf.resolutionSummary}</p>
                    <p className="text-slate-400">Reviewer Comment: {conf.reviewerComment}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* Detected Gaps Table */}
      {(tab === 'ALL' || tab === 'GAPS') && (
        <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Missing Metadata, Blockers & Verification Gaps
            </h2>
          </div>
          <div className="divide-y divide-slate-800/70">
            {projectGaps
              .filter((g) => g.type !== 'CONFLICT')
              .map((gap) => (
                <div
                  key={gap.id}
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#131C2E]/60"
                >
                  <div className="min-w-0 max-w-2xl">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span
                        className={`font-mono font-medium ${
                          gap.severity === 'Critical'
                            ? 'text-red-400'
                            : gap.severity === 'High'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {gap.severity}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-cyan-400 font-mono">{gap.type.replace(/_/g, ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-500 font-mono">{gap.sourceRef}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-100">{gap.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{gap.description}</div>
                  </div>
                  {gap.claimId && (
                    <button
                      type="button"
                      onClick={() => onInspectClaim(gap.claimId!)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inspect Claim
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Resolve Conflict Modal */}
      {resolvingConflict && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F1623] border border-slate-700 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-100">
                Resolve Conflict {resolvingConflict.id}
              </h3>
              <button
                type="button"
                onClick={() => setResolvingConflict(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Select Authoritative Truth
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWinningSide('A');
                      setResolutionSummary(resolvingConflict.statementA);
                    }}
                    className={`text-left p-3 rounded-lg border text-xs cursor-pointer ${
                      winningSide === 'A'
                        ? 'border-blue-500 bg-blue-500/15 text-slate-100'
                        : 'border-slate-800 bg-[#090D16] text-slate-300'
                    }`}
                  >
                    <div className="font-mono text-blue-400 mb-1">
                      Statement A ({resolvingConflict.sourceAFilename} · {resolvingConflict.sourceALocation})
                    </div>
                    {resolvingConflict.statementA}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWinningSide('B');
                      setResolutionSummary(resolvingConflict.statementB);
                    }}
                    className={`text-left p-3 rounded-lg border text-xs cursor-pointer ${
                      winningSide === 'B'
                        ? 'border-blue-500 bg-blue-500/15 text-slate-100'
                        : 'border-slate-800 bg-[#090D16] text-slate-300'
                    }`}
                  >
                    <div className="font-mono text-violet-400 mb-1">
                      Statement B ({resolvingConflict.sourceBFilename} · {resolvingConflict.sourceBLocation})
                    </div>
                    {resolvingConflict.statementB}
                  </button>

                  <button
                    type="button"
                    onClick={() => setWinningSide('SYNTHESIZED')}
                    className={`text-left p-3 rounded-lg border text-xs cursor-pointer ${
                      winningSide === 'SYNTHESIZED'
                        ? 'border-blue-500 bg-blue-500/15 text-slate-100'
                        : 'border-slate-800 bg-[#090D16] text-slate-300'
                    }`}
                  >
                    <div className="font-mono text-cyan-400 mb-1">Custom Synthesized Resolution</div>
                    Provide a custom reconciled statement below.
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Authoritative Resolution Statement
                </label>
                <textarea
                  required
                  rows={2}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reviewer Decision Comment (Recorded in Audit Log)
                </label>
                <textarea
                  required
                  rows={2}
                  value={reviewerComment}
                  onChange={(e) => setReviewerComment(e.target.value)}
                  placeholder="Explain why this statement reflects current project reality..."
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                />
              </div>

              {error && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  className="px-4 py-2 text-xs text-slate-300 bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                >
                  {busy ? 'Committing...' : 'Commit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
