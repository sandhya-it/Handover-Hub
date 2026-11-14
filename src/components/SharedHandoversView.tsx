import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';
import { exportHandoverToPdf } from '../lib/pdfExport.ts';
import { StatusMarker } from './StatusMarker.tsx';

interface SharedHandoversViewProps {
  workspace: WorkspacePayload;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onInspectClaim: (claimId: string) => void;
}

export function SharedHandoversView({
  workspace,
  onWorkspaceUpdated,
  onInspectClaim,
}: SharedHandoversViewProps) {
  const { handovers, projects, claims, currentUser } = workspace;

  const sharedOrAcknowledged = handovers.filter(
    (h) => h.status === 'SHARED' || h.status === 'ACKNOWLEDGED' || h.status === 'APPROVED'
  );

  const [selectedId, setSelectedId] = useState(sharedOrAcknowledged[0]?.id || '');
  const activeHandover =
    sharedOrAcknowledged.find((h) => h.id === selectedId) ||
    sharedOrAcknowledged[0] ||
    null;

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleAcknowledge = async () => {
    if (!activeHandover) return;
    setBusy(true);
    setBanner(null);
    try {
      const next = await api.acknowledgeHandover(activeHandover.id);
      onWorkspaceUpdated(next);
      setBanner({
        type: 'ok',
        text: `Receipt acknowledged by ${currentUser.name} for ${activeHandover.id} v${activeHandover.version}.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Acknowledgement failed',
      });
    } finally {
      setBusy(false);
    }
  };

  if (sharedOrAcknowledged.length === 0) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center space-y-2">
        <Lock className="w-7 h-7 text-slate-500 mx-auto" />
        <h2 className="font-display text-base font-semibold text-slate-200">
          No Shared Handovers Yet
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Only reviewer-approved handovers that have been explicitly shared are accessible here.
        </p>
      </div>
    );
  }

  const project = projects.find((p) => p.id === activeHandover?.projectId);
  const permittedClaims = activeHandover
    ? claims.filter((c) => c.projectId === activeHandover.projectId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Shared Handovers
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Role-restricted incoming transition portal displaying verified decisions, responsibilities, and next actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={activeHandover?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-[#0F1623] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
          >
            {sharedOrAcknowledged.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id} · {h.status} — {h.title}
              </option>
            ))}
          </select>

          {activeHandover && (
            <button
              type="button"
              onClick={() => exportHandoverToPdf(activeHandover, project)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          )}
        </div>
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

      {activeHandover && (
        <div className="space-y-6">
          {/* Header Summary & Acknowledgement Card */}
          <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-400">
                <span>{activeHandover.id}</span>
                <span aria-hidden="true">·</span>
                <span>Version v{activeHandover.version}</span>
                <span aria-hidden="true">·</span>
                <span>{activeHandover.status}</span>
                {project && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Project Status: {project.status}</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-xl font-bold text-slate-50">
                {activeHandover.title}
              </h2>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                <span>From: {activeHandover.departingMemberName}</span>
                <span aria-hidden="true">·</span>
                <span>To: {activeHandover.incomingMemberName} ({activeHandover.incomingRole})</span>
                {activeHandover.reviewerName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Approved by {activeHandover.reviewerName}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {activeHandover.status === 'ACKNOWLEDGED' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-xs text-emerald-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Handover Acknowledged</span>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-300/80">
                    {activeHandover.acknowledgedBy} ·{' '}
                    {activeHandover.acknowledgedAt
                      ? new Date(activeHandover.acknowledgedAt).toLocaleString()
                      : ''}
                  </div>
                </div>
              ) : activeHandover.status === 'SHARED' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAcknowledge}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-display text-xs font-semibold tracking-wide rounded-lg transition-colors cursor-pointer"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{busy ? 'Recording...' : 'I HAVE REVIEWED THIS HANDOVER'}</span>
                </button>
              ) : (
                <span className="text-xs font-mono text-amber-300">
                  Awaiting Reviewer Share Action
                </span>
              )}
            </div>
          </section>

          {/* Assigned Immediate Next Steps */}
          <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Assigned Next Actions & Responsibilities
            </h3>
            <div className="divide-y divide-slate-800/70">
              {activeHandover.nextActions.map((act) => (
                <div key={act.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{act.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Owner: <span className="text-cyan-300">{act.owner}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-amber-400">{act.priority}</span>
                    <span className="text-slate-300">Due {act.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Structured Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeHandover.sections.map((sec) => (
              <section
                key={sec.key}
                className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-5 space-y-2.5"
              >
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  {sec.number}. {sec.title}
                </h3>
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
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#090D16] hover:bg-[#131C2E] border border-slate-800 rounded text-xs cursor-pointer"
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

          {/* Authorized Evidence Summary */}
          <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Authorized Supporting Evidence ({permittedClaims.length})
            </h3>
            <div className="divide-y divide-slate-800/70">
              {permittedClaims.slice(0, 8).map((c) => (
                <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 max-w-2xl">
                    <div className="text-xs font-mono text-cyan-400">
                      {c.id} · {c.category} · {c.sourceFilename || 'No file'} {c.sourceLocation || ''}
                    </div>
                    <div className="text-sm text-slate-200 mt-0.5">{c.text}</div>
                  </div>
                  <StatusMarker status={c.verificationStatus} isStale={c.isStale} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
