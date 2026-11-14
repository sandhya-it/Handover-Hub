import { Lock, Search } from 'lucide-react';
import { useState } from 'react';
import { WorkspacePayload } from '../types.ts';

interface AuditHistoryViewProps {
  workspace: WorkspacePayload;
}

export function AuditHistoryView({ workspace }: AuditHistoryViewProps) {
  const { auditLogs, projects } = workspace;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');

  const filtered = auditLogs.filter((log) => {
    if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
    if (projectFilter !== 'ALL' && log.projectId !== projectFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${log.userName} ${log.userRole} ${log.action} ${log.details} ${
        log.projectName || ''
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Audit History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Append-only chronological record of uploads, extractions, claim edits, conflict resolutions, approvals, and acknowledgements.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Immutable Read-Only Ledger ({filtered.length} entries)</span>
        </div>
      </div>

      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit events, users, or target IDs..."
            className="w-full bg-[#090D16] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        >
          <option value="ALL">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        >
          <option value="ALL">All Event Categories</option>
          {[
            'PROJECT',
            'SOURCE',
            'EXTRACTION',
            'CLAIM',
            'CONFLICT',
            'HANDOVER',
            'APPROVAL',
            'ACKNOWLEDGEMENT',
            'PERMISSION',
            'AUTH',
          ].map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-[#0F1623] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Actor & Role</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Action & Details</th>
                <th className="py-3 px-4 font-medium">Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-[#131C2E]/60">
                  <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap align-top tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <div className="text-xs font-medium text-slate-200">{log.userName}</div>
                    <div className="text-[11px] text-slate-500">{log.userRole}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-cyan-400 whitespace-nowrap align-top">
                    {log.category}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="text-sm text-slate-100">{log.action}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{log.details}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-300 align-top">
                    {log.projectName || 'Workspace'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
