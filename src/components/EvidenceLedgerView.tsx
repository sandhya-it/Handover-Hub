import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  FileSearch,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Claim,
  Project,
  VerificationStatus,
  WorkspacePayload,
} from '../types.ts';
import { api } from '../lib/api.ts';
import { StatusMarker } from './StatusMarker.tsx';

interface EvidenceLedgerViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  focusedClaimId: string | null;
  onClearFocus: () => void;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
}

export function EvidenceLedgerView({
  workspace,
  selectedProject,
  focusedClaimId,
  onClearFocus,
  onWorkspaceUpdated,
}: EvidenceLedgerViewProps) {
  const { claims, sources, currentUser } = workspace;
  const canEdit = currentUser.role !== 'Incoming Member';
  const canVerify =
    currentUser.role === 'Administrator' || currentUser.role === 'Project Reviewer';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showTrustPassage, setShowTrustPassage] = useState(false);

  // Edit state inside inspector
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const projectClaims = selectedProject
    ? claims.filter((c) => c.projectId === selectedProject.id)
    : [];

  useEffect(() => {
    if (focusedClaimId) {
      const target = claims.find((c) => c.id === focusedClaimId);
      if (target) {
        setSelectedClaim(target);
        setShowTrustPassage(true);
        setEditing(false);
      }
      onClearFocus();
    }
  }, [focusedClaimId, claims, onClearFocus]);

  const openClaimInspector = (claim: Claim) => {
    setSelectedClaim(claim);
    setShowTrustPassage(false);
    setEditing(false);
    setEditText(claim.text);
    setEditOwner(claim.owner || '');
    setEditDueDate(claim.dueDate || '');
    setEditNote(claim.reviewerNote || '');
    setFeedback(null);
  };

  const filteredClaims = projectClaims.filter((c) => {
    if (statusFilter === 'STALE' && !c.isStale) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'STALE' && c.verificationStatus !== statusFilter) {
      return false;
    }
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${c.id} ${c.text} ${c.category} ${c.sourceFilename || ''} ${
        c.evidenceSnippet || ''
      } ${c.owner || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleSaveEdit = async () => {
    if (!selectedClaim) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.updateClaim(selectedClaim.id, {
        text: editText,
        owner: editOwner || null,
        dueDate: editDueDate || null,
        reviewerNote: editNote,
      });
      onWorkspaceUpdated(next);
      const updated = next.claims.find((c) => c.id === selectedClaim.id) || null;
      setSelectedClaim(updated);
      setEditing(false);
      setFeedback({ type: 'ok', text: `Claim ${selectedClaim.id} updated.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (
    claim: Claim,
    verificationStatus: VerificationStatus,
    isStale?: boolean
  ) => {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.updateClaim(claim.id, {
        verificationStatus,
        ...(typeof isStale === 'boolean' ? { isStale } : {}),
      });
      onWorkspaceUpdated(next);
      const updated = next.claims.find((c) => c.id === claim.id) || null;
      setSelectedClaim(updated);
      setFeedback({
        type: 'ok',
        text: `Claim ${claim.id} marked as ${verificationStatus}.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Action failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStale = async (claim: Claim) => {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.updateClaim(claim.id, { isStale: !claim.isStale });
      onWorkspaceUpdated(next);
      const updated = next.claims.find((c) => c.id === claim.id) || null;
      setSelectedClaim(updated);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to toggle stale' });
    } finally {
      setBusy(false);
    }
  };

  const sourceDoc = selectedClaim?.sourceId
    ? sources.find((s) => s.id === selectedClaim.sourceId)
    : undefined;

  const sourceChunk = sourceDoc?.chunks.find(
    (ch) => ch.location.toLowerCase() === (selectedClaim?.sourceLocation || '').toLowerCase()
  );

  const renderHighlightedPassage = (fullText: string, snippet: string | null) => {
    if (!snippet) return <span>{fullText}</span>;
    const idx = fullText.toLowerCase().indexOf(snippet.slice(0, 48).toLowerCase());
    if (idx === -1) return <span>{fullText}</span>;
    const before = fullText.slice(0, idx);
    const matchEnd = Math.min(fullText.length, idx + snippet.length);
    const match = fullText.slice(idx, matchEnd);
    const after = fullText.slice(matchEnd);
    return (
      <>
        <span>{before}</span>
        <mark className="bg-cyan-500/25 text-cyan-100 border-b border-cyan-400 px-0.5 rounded-xs">
          {match}
        </mark>
        <span>{after}</span>
      </>
    );
  };

  if (!selectedProject) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
        Select a project to inspect its Evidence Ledger.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Evidence Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Trace every AI-extracted claim back to its exact document passage, confidence score, and human verification state.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <span className="text-emerald-400">
            Supported: {projectClaims.filter((c) => c.verificationStatus === 'SUPPORTED').length}
          </span>
          <span className="text-amber-400">
            Needs Review: {projectClaims.filter((c) => c.verificationStatus === 'NEEDS_REVIEW').length}
          </span>
          <span className="text-red-400">
            Conflict: {projectClaims.filter((c) => c.verificationStatus === 'CONFLICT').length}
          </span>
          <span className="text-slate-400">
            No Evidence: {projectClaims.filter((c) => c.verificationStatus === 'NO_EVIDENCE').length}
          </span>
          <span className="text-violet-300">
            Stale: {projectClaims.filter((c) => c.isStale).length}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claims, IDs, snippets, owners, or source files..."
            className="w-full bg-[#090D16] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        >
          <option value="ALL">All Verification States</option>
          <option value="SUPPORTED">Green — Supported</option>
          <option value="NEEDS_REVIEW">Yellow — Needs Review</option>
          <option value="CONFLICT">Red — Conflict</option>
          <option value="NO_EVIDENCE">Grey — No Evidence</option>
          <option value="STALE">Stale Only</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        >
          <option value="ALL">All Categories</option>
          {[
            'Decision',
            'Rationale',
            'Task',
            'Dependency',
            'Blocker',
            'Risk',
            'Open Question',
            'Contact',
            'Technical',
            'Pending Approval',
          ].map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Main Table + Evidence Panel Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`${
            selectedClaim ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-[#0F1623] border border-slate-800/90 rounded-xl overflow-hidden`}
        >
          {filteredClaims.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No claims match the active search or filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                    <th className="py-3 px-4 font-medium">Claim ID</th>
                    <th className="py-3 px-4 font-medium">Extracted Claim</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Source & Location</th>
                    <th className="py-3 px-4 font-medium text-right">Conf.</th>
                    <th className="py-3 px-4 font-medium">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredClaims.map((claim) => {
                    const isSelected = selectedClaim?.id === claim.id;
                    return (
                      <tr
                        key={claim.id}
                        onClick={() => openClaimInspector(claim)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#17233A]' : 'hover:bg-[#131C2E]/80'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-cyan-400 whitespace-nowrap align-top">
                          {claim.id}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="text-slate-100 text-sm leading-snug line-clamp-2 max-w-md">
                            {claim.text}
                          </div>
                          {claim.evidenceSnippet ? (
                            <div className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-md italic">
                              “{claim.evidenceSnippet}”
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 mt-1">
                              No source snippet attached
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300 whitespace-nowrap align-top">
                          {claim.category}
                        </td>
                        <td className="py-3 px-4 text-xs align-top">
                          {claim.sourceFilename ? (
                            <div>
                              <div className="text-slate-200 truncate max-w-[180px]">
                                {claim.sourceFilename}
                              </div>
                              <div className="font-mono text-slate-400 mt-0.5">
                                {claim.sourceId} · {claim.sourceLocation}
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-500">Unverified</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-200 tabular-nums align-top">
                          {Math.round(claim.confidence * 100)}%
                        </td>
                        <td className="py-3 px-4 align-top">
                          <StatusMarker
                            status={claim.verificationStatus}
                            isStale={claim.isStale}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detailed Evidence Inspector Drawer */}
        {selectedClaim && (
          <aside className="xl:col-span-5 bg-[#0F1623] border border-slate-700/80 rounded-xl p-6 space-y-5 sticky top-20">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1.5">
                  <span>{selectedClaim.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedClaim.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{Math.round(selectedClaim.confidence * 100)}% Confidence</span>
                </div>
                <StatusMarker
                  status={selectedClaim.verificationStatus}
                  isStale={selectedClaim.isStale}
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  feedback.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Original Claim or Edit Form */}
            {editing ? (
              <div className="space-y-3 bg-[#090D16] border border-slate-800 rounded-lg p-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Claim Statement</label>
                  <textarea
                    rows={3}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-[#0F1623] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Owner</label>
                    <input
                      type="text"
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                      placeholder="Unassigned"
                      className="w-full bg-[#0F1623] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full bg-[#0F1623] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Reviewer / Context Note</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full bg-[#0F1623] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-xs text-slate-300 bg-[#131C2E] border border-slate-700 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1">Extracted Claim</div>
                <p className="text-sm font-medium text-slate-100 leading-relaxed">
                  {selectedClaim.text}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-slate-400">
                  <div>
                    Owner: <span className="text-slate-200">{selectedClaim.owner || 'Unassigned'}</span>
                  </div>
                  <div>
                    Due:{' '}
                    <span className="font-mono text-slate-200">
                      {selectedClaim.dueDate || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    Extracted:{' '}
                    <span className="font-mono text-slate-300">
                      {new Date(selectedClaim.extractedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    Mode:{' '}
                    <span className="text-slate-300">
                      {selectedClaim.extractionMode === 'live_ai'
                        ? 'Live Gemini AI'
                        : 'Deterministic'}
                    </span>
                  </div>
                </div>
                {selectedClaim.reviewerNote && (
                  <div className="mt-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                    Note: {selectedClaim.reviewerNote}
                  </div>
                )}
              </div>
            )}

            {/* Prominent WHY SHOULD I TRUST THIS? CTA */}
            <button
              type="button"
              onClick={() => setShowTrustPassage((prev) => !prev)}
              className="w-full py-2.5 px-4 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-display text-xs font-semibold tracking-wide rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSearch className="w-4 h-4 text-cyan-400" />
              <span>WHY SHOULD I TRUST THIS?</span>
            </button>

            {showTrustPassage && (
              <div className="bg-[#090D16] border border-cyan-500/30 rounded-lg p-4 space-y-3">
                {selectedClaim.sourceId && sourceDoc ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-cyan-300">
                        {sourceDoc.filename}
                      </span>
                      <span className="font-mono text-slate-400">
                        {selectedClaim.sourceId} · {selectedClaim.sourceLocation}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed bg-[#0F1623] border border-slate-800 rounded-md p-3">
                      {sourceChunk
                        ? renderHighlightedPassage(
                            sourceChunk.text,
                            selectedClaim.evidenceSnippet
                          )
                        : selectedClaim.evidenceSnippet}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Uploaded by {sourceDoc.uploadedByName}</span>
                      <span className="font-mono">
                        {new Date(sourceDoc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      No source document or verbatim passage substantiates this claim. Handover Hub refuses to fabricate citations — verify manually or reject before handover approval.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reviewer & Member Actions */}
            {canEdit && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Claim</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleStale(selectedClaim)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 rounded-lg cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{selectedClaim.isStale ? 'Unmark Stale' : 'Mark Stale'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleStatusChange(selectedClaim, 'NEEDS_REVIEW')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-lg cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Needs Info</span>
                  </button>
                </div>

                {canVerify && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !selectedClaim.sourceId}
                      onClick={() => handleStatusChange(selectedClaim, 'SUPPORTED')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify Supported</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleStatusChange(selectedClaim, 'NO_EVIDENCE')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-200 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject / Unsupported</span>
                    </button>
                  </div>
                )}
                {!canVerify && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Final SUPPORTED verification requires Project Reviewer or Administrator role.</span>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
