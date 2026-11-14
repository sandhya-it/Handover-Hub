import {
  AlertTriangle,
  CheckCircle2,
  MessageSquarePlus,
  Share2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { HandoverStatus, Project, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';
import { StatusMarker } from './StatusMarker.tsx';

interface ReviewApprovalViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onInspectClaim: (claimId: string) => void;
  onNavigate: (view: string) => void;
}

const WORKFLOW_STEPS: HandoverStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'SHARED',
  'ACKNOWLEDGED',
];

export function ReviewApprovalView({
  workspace,
  selectedProject,
  onWorkspaceUpdated,
  onInspectClaim,
  onNavigate,
}: ReviewApprovalViewProps) {
  const { handovers, conflicts, claims, currentUser } = workspace;
  const canApprove =
    currentUser.role === 'Administrator' || currentUser.role === 'Project Reviewer';

  const projectHandovers = selectedProject
    ? handovers.filter((h) => h.projectId === selectedProject.id)
    : handovers;

  const [selectedHandoverId, setSelectedHandoverId] = useState(
    projectHandovers[0]?.id || handovers[0]?.id || ''
  );
  const activeHandover =
    projectHandovers.find((h) => h.id === selectedHandoverId) ||
    projectHandovers[0] ||
    null;

  const [commentText, setCommentText] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!activeHandover) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
        No handover drafts available for review in this project. Generate one in Handover Composer first.
      </div>
    );
  }

  const openConflicts = conflicts.filter(
    (c) => c.projectId === activeHandover.projectId && c.status === 'OPEN'
  );
  const unverifiedClaims = claims.filter(
    (c) =>
      c.projectId === activeHandover.projectId &&
      c.verificationStatus !== 'SUPPORTED'
  );

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.addHandoverComment(activeHandover.id, commentText);
      onWorkspaceUpdated(next);
      setCommentText('');
      setBanner({ type: 'ok', text: 'Reviewer comment added and recorded in audit trail.' });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Comment failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.submitReviewDecision(
        activeHandover.id,
        decision,
        decisionNote ||
          (decision === 'APPROVED'
            ? 'Verified all evidence references and approved for incoming transition.'
            : 'Corrections requested before sharing with incoming member.')
      );
      onWorkspaceUpdated(next);
      setDecisionNote('');
      setBanner({
        type: 'ok',
        text:
          decision === 'APPROVED'
            ? `Handover ${activeHandover.id} APPROVED. You can now share it with ${activeHandover.incomingMemberName}.`
            : `Handover ${activeHandover.id} returned with CHANGES_REQUESTED (version incremented).`,
      });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Decision failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.shareHandover(activeHandover.id);
      onWorkspaceUpdated(next);
      setBanner({
        type: 'ok',
        text: `Handover ${activeHandover.id} SHARED with ${activeHandover.incomingMemberName}.`,
      });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Share failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Review & Approval
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Human verification gate ensuring evidence-backed handovers are reviewed and approved before sharing.
          </p>
        </div>

        <select
          value={activeHandover.id}
          onChange={(e) => setSelectedHandoverId(e.target.value)}
          className="bg-[#0F1623] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
        >
          {projectHandovers.map((h) => (
            <option key={h.id} value={h.id}>
              {h.id} (v{h.version}) — {h.status} — {h.title}
            </option>
          ))}
        </select>
      </div>

      {/* Workflow Stepper */}
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {WORKFLOW_STEPS.map((step, idx) => {
            const currentIdx = WORKFLOW_STEPS.indexOf(
              activeHandover.status === 'CHANGES_REQUESTED'
                ? 'UNDER_REVIEW'
                : activeHandover.status
            );
            const isCurrent = activeHandover.status === step;
            const isPast = currentIdx > idx;
            return (
              <div key={step} className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                    isCurrent
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : isPast
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-[#090D16] border-slate-700 text-slate-500'
                  }`}
                >
                  {idx + 1}
                </span>
                <span
                  className={
                    isCurrent
                      ? 'text-slate-100 font-semibold'
                      : isPast
                      ? 'text-emerald-300'
                      : 'text-slate-500'
                  }
                >
                  {step.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
        {activeHandover.status === 'CHANGES_REQUESTED' && (
          <div className="mt-3 text-xs text-amber-300 font-mono">
            Current State: CHANGES REQUESTED (Version v{activeHandover.version})
          </div>
        )}
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between ${
            banner.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          <span>{banner.text}</span>
          {activeHandover.status === 'SHARED' && (
            <button
              type="button"
              onClick={() => onNavigate('shared')}
              className="underline font-medium cursor-pointer"
            >
              Open Shared Handovers
            </button>
          )}
        </div>
      )}

      {/* Readiness Warnings */}
      {(openConflicts.length > 0 || unverifiedClaims.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 space-y-1">
              <div className="font-semibold">
                Verification Advisory: {openConflicts.length} open conflict(s) and{' '}
                {unverifiedClaims.length} non-supported claim(s) exist in this project.
              </div>
              <div className="text-amber-300/80">
                Reviewers should inspect conflicts and unverified claims before final sign-off.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('conflicts')}
              className="px-3 py-1.5 text-xs font-medium bg-[#0F1623] border border-amber-500/40 text-amber-200 rounded-lg cursor-pointer"
            >
              Review Conflicts
            </button>
            <button
              type="button"
              onClick={() => onNavigate('evidence')}
              className="px-3 py-1.5 text-xs font-medium bg-[#0F1623] border border-amber-500/40 text-amber-200 rounded-lg cursor-pointer"
            >
              Inspect Ledger
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Handover Sections Inspection */}
        <div className="xl:col-span-8 space-y-4">
          {activeHandover.sections.map((sec) => (
            <section
              key={sec.key}
              className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  {sec.number}. {sec.title}
                </h2>
                {sec.hasUnverifiedDetails && (
                  <span className="text-xs text-amber-400">Contains unverified items</span>
                )}
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {sec.content}
              </p>
              {sec.evidenceRefs.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {sec.evidenceRefs.map((ref) => (
                    <button
                      key={`${sec.key}-${ref.claimId}`}
                      type="button"
                      onClick={() => onInspectClaim(ref.claimId)}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-[#090D16] hover:bg-[#131C2E] border border-slate-800 rounded text-xs cursor-pointer"
                    >
                      <span className="font-mono text-cyan-400">{ref.claimId}</span>
                      <StatusMarker status={ref.verificationStatus} isStale={ref.isStale} compact />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Decision & Comments Sidebar */}
        <aside className="xl:col-span-4 space-y-4 sticky top-20">
          <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Approval Controls</span>
            </h2>

            <div className="text-xs text-slate-400 space-y-1.5 bg-[#090D16] border border-slate-800 rounded-lg p-3">
              <div>
                Version: <span className="font-mono text-slate-200">v{activeHandover.version}</span>
              </div>
              <div>
                Departing: <span className="text-slate-200">{activeHandover.departingMemberName}</span>
              </div>
              <div>
                Incoming: <span className="text-cyan-300">{activeHandover.incomingMemberName}</span>
              </div>
              {activeHandover.reviewerName && (
                <div>
                  Last Reviewer: <span className="text-slate-200">{activeHandover.reviewerName}</span>
                </div>
              )}
              {activeHandover.reviewerDecisionNote && (
                <div className="pt-1 text-slate-300">
                  Note: {activeHandover.reviewerDecisionNote}
                </div>
              )}
            </div>

            {canApprove ? (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Reviewer approval rationale or requested corrections..."
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('APPROVED')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('CHANGES_REQUESTED')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject / Revise</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy || activeHandover.status !== 'APPROVED'}
                  onClick={handleShare}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>
                    {activeHandover.status === 'SHARED' || activeHandover.status === 'ACKNOWLEDGED'
                      ? 'Already Shared'
                      : 'Share with Incoming Member'}
                  </span>
                </button>
                {activeHandover.status !== 'APPROVED' &&
                  activeHandover.status !== 'SHARED' &&
                  activeHandover.status !== 'ACKNOWLEDGED' && (
                    <p className="text-[11px] text-slate-500">
                      Sharing is disabled until the handover status is APPROVED.
                    </p>
                  )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Only Project Reviewers or Administrators can approve, reject, or share handovers.
              </p>
            )}
          </div>

          {/* Reviewer Comments Thread */}
          <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Review Comments ({activeHandover.comments.length})
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {activeHandover.comments.length === 0 ? (
                <p className="text-xs text-slate-500">No comments recorded yet.</p>
              ) : (
                activeHandover.comments.map((cmt) => (
                  <div
                    key={cmt.id}
                    className="bg-[#090D16] border border-slate-800 rounded-lg p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-medium text-slate-200">{cmt.authorName}</span>
                      <span className="font-mono">
                        {new Date(cmt.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{cmt.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add review note or correction request..."
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
              />
              <button
                type="submit"
                disabled={busy || !commentText.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 rounded-lg cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
