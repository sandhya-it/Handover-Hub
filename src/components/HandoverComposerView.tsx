import {
  AlertTriangle,
  Download,
  Eye,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Handover, HandoverActionItem, HandoverSection, Project, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';
import { exportHandoverToPdf } from '../lib/pdfExport.ts';
import { StatusMarker } from './StatusMarker.tsx';

interface HandoverComposerViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onInspectClaim: (claimId: string) => void;
  onNavigate: (view: string) => void;
}

export function HandoverComposerView({
  workspace,
  selectedProject,
  onWorkspaceUpdated,
  onInspectClaim,
  onNavigate,
}: HandoverComposerViewProps) {
  const { projects, users, sources, handovers, currentUser } = workspace;
  const canCompose = currentUser.role !== 'Incoming Member';

  const [formProjectId, setFormProjectId] = useState(selectedProject?.id || projects[0]?.id || '');
  const [departingId, setDepartingId] = useState('usr-departing');
  const [incomingId, setIncomingId] = useState('usr-incoming');
  const [incomingRole, setIncomingRole] = useState('Incoming Platform Owner');
  const [scope, setScope] = useState(
    'Full Backend, IoT Ingestion, Security Posture, and Operational Ownership Transition'
  );
  const [includedSourceIds, setIncludedSourceIds] = useState<string[]>([]);

  const projectSources = sources.filter((s) => s.projectId === formProjectId);
  const projectHandovers = handovers.filter((h) => h.projectId === formProjectId);

  const [activeHandoverId, setActiveHandoverId] = useState<string>(
    projectHandovers[0]?.id || ''
  );
  const [draftSections, setDraftSections] = useState<HandoverSection[]>([]);
  const [draftActions, setDraftActions] = useState<HandoverActionItem[]>([]);
  const [previewMode, setPreviewMode] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (selectedProject && selectedProject.id !== formProjectId) {
      setFormProjectId(selectedProject.id);
    }
  }, [selectedProject, formProjectId]);

  useEffect(() => {
    const pSources = sources.filter((s) => s.projectId === formProjectId);
    setIncludedSourceIds(pSources.map((s) => s.id));
    const pHandovers = handovers.filter((h) => h.projectId === formProjectId);
    const first = pHandovers[0];
    setActiveHandoverId(first?.id || '');
    setDraftSections(first ? first.sections : []);
    setDraftActions(first ? first.nextActions : []);
  }, [formProjectId, sources, handovers]);

  const activeHandover: Handover | undefined = handovers.find((h) => h.id === activeHandoverId);

  useEffect(() => {
    if (activeHandover) {
      setDraftSections(activeHandover.sections);
      setDraftActions(activeHandover.nextActions);
    }
  }, [activeHandover]);

  const toggleSource = (id: string) => {
    setIncludedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!formProjectId) return;
    setGenerating(true);
    setBanner(null);
    try {
      const res = await api.generateHandover({
        projectId: formProjectId,
        departingMemberId: departingId,
        incomingMemberId: incomingId,
        incomingRole,
        includedSourceIds,
        scope,
      });
      onWorkspaceUpdated(res.workspace);
      setActiveHandoverId(res.handover.id);
      setDraftSections(res.handover.sections);
      setDraftActions(res.handover.nextActions);
      setBanner({
        type: 'ok',
        text: `Generated Handover ${res.handover.id} (${
          res.handover.generatedMode === 'live_ai' ? 'Live Gemini AI' : 'Deterministic Synthesis'
        }) with 13 evidence-linked sections.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Generation failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSection = async (sectionKey: string) => {
    if (!activeHandover) return;
    setRegenKey(sectionKey);
    setBanner(null);
    try {
      const next = await api.regenerateHandoverSection(activeHandover.id, sectionKey);
      onWorkspaceUpdated(next);
      setBanner({ type: 'ok', text: `Regenerated section "${sectionKey}" from current evidence.` });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Section regeneration failed',
      });
    } finally {
      setRegenKey(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeHandover) return;
    setSaving(true);
    setBanner(null);
    try {
      const next = await api.updateHandover(activeHandover.id, {
        sections: draftSections,
        nextActions: draftActions,
      });
      onWorkspaceUpdated(next);
      setBanner({ type: 'ok', text: `Saved edits to ${activeHandover.id}.` });
    } catch (err) {
      setBanner({ type: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!activeHandover) return;
    setSaving(true);
    setBanner(null);
    try {
      await api.updateHandover(activeHandover.id, {
        sections: draftSections,
        nextActions: draftActions,
      });
      const next = await api.submitHandoverForReview(activeHandover.id);
      onWorkspaceUpdated(next);
      setBanner({
        type: 'ok',
        text: `Submitted ${activeHandover.id} to Review & Approval queue.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Submit for review failed',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSectionField = (
    key: string,
    field: 'content' | 'manualNote',
    value: string
  ) => {
    setDraftSections((prev) =>
      prev.map((sec) => (sec.key === key ? { ...sec, [field]: value } : sec))
    );
  };

  const updateActionItem = (
    id: string,
    field: keyof HandoverActionItem,
    value: string
  ) => {
    setDraftActions((prev) =>
      prev.map((act) => (act.id === id ? { ...act, [field]: value } : act))
    );
  };

  const addActionItem = () => {
    setDraftActions((prev) => [
      ...prev,
      {
        id: `ACT-${Date.now().toString().slice(-4)}`,
        title: 'New transition action item',
        owner: users.find((u) => u.id === incomingId)?.name || 'Pooja G',
        dueDate: '2026-12-01',
        priority: 'High',
      },
    ]);
  };

  const removeActionItem = (id: string) => {
    setDraftActions((prev) => prev.filter((a) => a.id !== id));
  };

  const currentProjectObj = projects.find((p) => p.id === formProjectId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Handover Composer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Synthesize verified claims into a structured 13-section transition package with inline citations and PDF export.
          </p>
        </div>

        {activeHandover && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewMode ? 'Edit Mode' : 'Preview Mode'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportHandoverToPdf(
                  { ...activeHandover, sections: draftSections, nextActions: draftActions },
                  currentProjectObj
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            {canCompose && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitForReview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Review</span>
                </button>
              </>
            )}
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
          <button
            type="button"
            onClick={() => onNavigate('review')}
            className="underline font-medium cursor-pointer"
          >
            Go to Review & Approval
          </button>
        </div>
      )}

      {/* Composer Configuration Panel */}
      {canCompose && (
        <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Project</label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Departing Member</label>
              <select
                value={departingId}
                onChange={(e) => setDepartingId(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Incoming Member</label>
              <select
                value={incomingId}
                onChange={(e) => setIncomingId(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Incoming Role</label>
              <input
                type="text"
                value={incomingRole}
                onChange={(e) => setIncomingRole(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-slate-300 mb-1">Handover Scope</label>
              <input
                type="text"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="lg:col-span-5">
              <div className="text-xs font-medium text-slate-300 mb-1.5">
                Sources to Include ({includedSourceIds.length}/{projectSources.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {projectSources.map((src) => {
                  const checked = includedSourceIds.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleSource(src.id)}
                      className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                        checked
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                          : 'bg-[#090D16] border-slate-800 text-slate-500'
                      }`}
                    >
                      {src.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{generating ? 'Composing...' : 'Generate Handover'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Handover Switcher if multiple exist */}
      {projectHandovers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0F1623] border border-slate-800/90 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Active Handover Package:</span>
            <select
              value={activeHandoverId}
              onChange={(e) => setActiveHandoverId(e.target.value)}
              className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
            >
              {projectHandovers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id} · v{h.version} · {h.status} — {h.title}
                </option>
              ))}
            </select>
          </div>
          {activeHandover && (
            <div className="text-xs font-mono text-slate-400">
              Status: <span className="text-cyan-400">{activeHandover.status}</span> · Version v
              {activeHandover.version}
            </div>
          )}
        </div>
      )}

      {/* 13 Structured Sections */}
      {activeHandover ? (
        <div className="space-y-4">
          {draftSections.map((sec) => (
            <section
              key={sec.key}
              className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-cyan-400">
                    {String(sec.number).padStart(2, '0')}
                  </span>
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    {sec.title}
                  </h2>
                  {sec.hasUnverifiedDetails && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Contains unverified or conflicting items</span>
                    </span>
                  )}
                </div>

                {!previewMode && canCompose && (
                  <button
                    type="button"
                    disabled={regenKey === sec.key}
                    onClick={() => handleRegenerateSection(sec.key)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${regenKey === sec.key ? 'animate-spin' : ''}`}
                    />
                    <span>Regenerate Section</span>
                  </button>
                )}
              </div>

              {previewMode || !canCompose ? (
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {sec.content}
                </p>
              ) : (
                <textarea
                  rows={Math.max(3, Math.min(8, sec.content.split('\n').length + 1))}
                  value={sec.content}
                  onChange={(e) => updateSectionField(sec.key, 'content', e.target.value)}
                  className="w-full bg-[#090D16] border border-slate-800 focus:border-blue-500 rounded-lg p-3 text-sm text-slate-200 leading-relaxed focus:outline-none"
                />
              )}

              {/* Manual Note */}
              {(!previewMode && canCompose) ? (
                <input
                  type="text"
                  value={sec.manualNote || ''}
                  onChange={(e) => updateSectionField(sec.key, 'manualNote', e.target.value)}
                  placeholder="Optional manual context note from departing member or reviewer..."
                  className="w-full bg-[#131C2E]/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600"
                />
              ) : sec.manualNote ? (
                <div className="text-xs text-cyan-200/90 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
                  Manual Note: {sec.manualNote}
                </div>
              ) : null}

              {/* Linked Evidence References */}
              {sec.evidenceRefs.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Linked Evidence:</span>
                  {sec.evidenceRefs.map((ref) => (
                    <button
                      key={`${sec.key}-${ref.claimId}`}
                      type="button"
                      onClick={() => onInspectClaim(ref.claimId)}
                      className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#090D16] hover:bg-[#131C2E] border border-slate-800 rounded-md text-xs cursor-pointer"
                    >
                      <span className="font-mono text-cyan-400">{ref.claimId}</span>
                      <span className="text-slate-400">{ref.label}</span>
                      <StatusMarker status={ref.verificationStatus} isStale={ref.isStale} compact />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Assigned Action Items Table */}
          <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                <span>Action Owner & Deadline Assignments ({draftActions.length})</span>
              </h2>
              {!previewMode && canCompose && (
                <button
                  type="button"
                  onClick={addActionItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Action</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {draftActions.map((act) => (
                <div
                  key={act.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-[#090D16] border border-slate-800 rounded-lg p-3"
                >
                  <div className="md:col-span-6">
                    {previewMode || !canCompose ? (
                      <span className="text-sm text-slate-200">{act.title}</span>
                    ) : (
                      <input
                        type="text"
                        value={act.title}
                        onChange={(e) => updateActionItem(act.id, 'title', e.target.value)}
                        className="w-full bg-[#0F1623] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {previewMode || !canCompose ? (
                      <span className="text-xs text-slate-300">{act.owner}</span>
                    ) : (
                      <input
                        type="text"
                        value={act.owner}
                        onChange={(e) => updateActionItem(act.id, 'owner', e.target.value)}
                        className="w-full bg-[#0F1623] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {previewMode || !canCompose ? (
                      <span className="font-mono text-xs text-slate-300">{act.dueDate}</span>
                    ) : (
                      <input
                        type="date"
                        value={act.dueDate}
                        onChange={(e) => updateActionItem(act.id, 'dueDate', e.target.value)}
                        className="w-full bg-[#0F1623] border border-slate-700 rounded-md px-2 py-1.5 text-xs font-mono text-slate-100"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2">
                    {previewMode || !canCompose ? (
                      <span className="text-xs font-mono text-amber-400">{act.priority}</span>
                    ) : (
                      <>
                        <select
                          value={act.priority}
                          onChange={(e) => updateActionItem(act.id, 'priority', e.target.value)}
                          className="bg-[#0F1623] border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100"
                        >
                          <option value="Immediate">Immediate</option>
                          <option value="High">High</option>
                          <option value="Normal">Normal</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeActionItem(act.id)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
          No handover package generated yet for this project. Configure sources above and click{' '}
          <span className="text-slate-200 font-medium">Generate Handover</span>.
        </div>
      )}
    </div>
  );
}
