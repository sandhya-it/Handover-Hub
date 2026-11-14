import {
  CheckCircle2,
  Cpu,
  Eye,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { Project, ProjectSource, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';

interface SourceConnectViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onNavigate: (view: string) => void;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.csv'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function SourceConnectView({
  workspace,
  selectedProject,
  onWorkspaceUpdated,
  onNavigate,
}: SourceConnectViewProps) {
  const { sources, currentUser, capabilities } = workspace;
  const canModify = currentUser.role !== 'Incoming Member';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectSources = selectedProject
    ? sources.filter((s) => s.projectId === selectedProject.id)
    : [];

  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewSource, setPreviewSource] = useState<ProjectSource | null>(null);
  const [confirmDeleteSource, setConfirmDeleteSource] = useState<ProjectSource | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(
    null
  );

  const validateAndUpload = async (fileList: FileList | File[]) => {
    if (!selectedProject) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const lower = file.name.toLowerCase();
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (!hasValidExt) {
        rejected.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        rejected.push(`${file.name} (exceeds 10 MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setStatusBanner({
        type: 'err',
        text: `Upload rejected: ${rejected.join(', ')}. Allowed formats: PDF, DOCX, TXT, CSV.`,
      });
      return;
    }

    setUploadProgress(25);
    setStatusBanner(null);
    const timer = window.setInterval(() => {
      setUploadProgress((prev) => (prev !== null && prev < 85 ? prev + 15 : prev));
    }, 180);

    try {
      const res = await api.uploadSources(selectedProject.id, validFiles);
      window.clearInterval(timer);
      setUploadProgress(100);
      onWorkspaceUpdated(res.workspace);
      const warnParts = [...rejected, ...(res.warnings || [])];
      setStatusBanner({
        type: warnParts.length > 0 ? 'warn' : 'ok',
        text: `Processed ${res.uploaded.length} document(s) with preserved page/row/paragraph coordinates.${
          warnParts.length > 0 ? ` Warnings: ${warnParts.join('; ')}` : ''
        }`,
      });
      window.setTimeout(() => setUploadProgress(null), 600);
    } catch (err) {
      window.clearInterval(timer);
      setUploadProgress(null);
      setStatusBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!canModify) return;
    void validateAndUpload(e.dataTransfer.files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void validateAndUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedProject) return;
    setAnalyzing(true);
    setStatusBanner(null);
    try {
      const res = await api.analyzeProject(selectedProject.id);
      onWorkspaceUpdated(res.workspace);
      const modeLabel =
        res.mode === 'live_ai'
          ? 'Live Gemini AI Extraction'
          : 'Deterministic Fallback Processing';
      setStatusBanner({
        type: res.warning ? 'warn' : 'ok',
        text: `${modeLabel} complete: added ${res.addedClaimsCount} new claim(s) and ${res.addedConflictsCount} conflict(s).${
          res.warning ? ` (${res.warning})` : ''
        }`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Analysis failed',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteSource) return;
    try {
      const next = await api.deleteSource(confirmDeleteSource.id);
      onWorkspaceUpdated(next);
      setStatusBanner({
        type: 'ok',
        text: `Deleted ${confirmDeleteSource.filename}. Dependent claims updated to NO_EVIDENCE.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Delete failed',
      });
    } finally {
      setConfirmDeleteSource(null);
    }
  };

  if (!selectedProject) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
        Select or create a project first to connect source documents.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Source Connect
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ingest PDF, DOCX, TXT, and CSV project artifacts with traceable page, row, and paragraph references.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Engine:{' '}
            <span className={capabilities.geminiConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              {capabilities.geminiConfigured ? 'Live Gemini AI Ready' : 'Deterministic Fallback Mode'}
            </span>
          </span>
          {canModify && (
            <button
              type="button"
              disabled={analyzing || projectSources.length === 0}
              onClick={handleRunAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cpu className="w-4 h-4" />
              )}
              <span>{analyzing ? 'Analyzing Sources...' : 'Run Document Analysis'}</span>
            </button>
          )}
        </div>
      </div>

      {statusBanner && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between gap-4 ${
            statusBanner.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : statusBanner.type === 'warn'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          <span>{statusBanner.text}</span>
          <div className="flex items-center gap-3 shrink-0">
            {statusBanner.type !== 'err' && (
              <button
                type="button"
                onClick={() => onNavigate('evidence')}
                className="underline font-medium cursor-pointer"
              >
                Open Evidence Ledger
              </button>
            )}
            <button type="button" onClick={() => setStatusBanner(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Drag and Drop Uploader */}
      {canModify && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-700/80 bg-[#0F1623] hover:border-blue-500/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <UploadCloud className="w-8 h-8 text-blue-400 mx-auto mb-3" />
          <div className="font-display text-sm font-semibold text-slate-100">
            Drop PDF, DOCX, TXT, or CSV documents here — or click to browse
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multi-file upload supported (max 10 MB per file). Page numbers, CSV rows, and paragraph indices are preserved automatically.
          </p>

          {uploadProgress !== null && (
            <div className="max-w-md mx-auto mt-4">
              <div className="flex justify-between text-xs font-mono text-cyan-300 mb-1">
                <span>Extracting document text & coordinates...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Sources Table */}
      <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Connected Sources — {selectedProject.name} ({projectSources.length})
          </h2>
          <span className="text-xs text-slate-400">
            Documents are treated as untrusted data during AI analysis
          </span>
        </div>

        {projectSources.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No documents uploaded for this project yet. Upload PDF, DOCX, TXT, or CSV files above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                  <th className="py-3 px-4 font-medium">Source ID</th>
                  <th className="py-3 px-4 font-medium">Document</th>
                  <th className="py-3 px-4 font-medium">Format</th>
                  <th className="py-3 px-4 font-medium">Indexed Units</th>
                  <th className="py-3 px-4 font-medium">Uploaded By</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {projectSources.map((src) => (
                  <tr key={src.id} className="hover:bg-[#131C2E]/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-cyan-400 whitespace-nowrap">
                      {src.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-medium text-slate-100">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[260px]">{src.filename}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                        {(src.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                        {new Date(src.uploadedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300 uppercase">
                      {src.fileType}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300 tabular-nums">
                      {src.chunks.length}{' '}
                      {src.fileType === 'pdf'
                        ? 'pages'
                        : src.fileType === 'csv'
                        ? 'rows'
                        : src.fileType === 'docx'
                        ? 'sections'
                        : 'paragraphs'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{src.uploadedByName}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{src.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewSource(src)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        {canModify && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSource(src)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Document Text Preview Modal */}
      {previewSource && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F1623] border border-slate-700 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-cyan-400">
                  {previewSource.id} · {previewSource.fileType.toUpperCase()}
                </div>
                <h3 className="font-display text-base font-semibold text-slate-100">
                  {previewSource.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSource(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {previewSource.chunks.map((chunk) => (
                <div
                  key={chunk.location}
                  className="bg-[#090D16] border border-slate-800 rounded-lg p-4"
                >
                  <div className="text-xs font-mono text-blue-400 mb-1.5">
                    {chunk.location}
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteSource && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0F1623] border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Delete Source Document?
            </h3>
            <p className="text-sm text-slate-400">
              Removing <span className="text-slate-200 font-medium">{confirmDeleteSource.filename}</span>{' '}
              will mark any claims referencing it as <span className="font-mono text-slate-300">NO_EVIDENCE</span>{' '}
              and record an audit entry.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteSource(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
