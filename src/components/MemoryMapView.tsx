import {
  AlertTriangle,
  CheckSquare,
  FileText,
  GitBranch,
  HelpCircle,
  Link2,
  Maximize2,
  Phone,
  ShieldAlert,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Claim, Project, VerificationStatus, WorkspacePayload } from '../types.ts';
import { StatusMarker } from './StatusMarker.tsx';

interface MemoryMapViewProps {
  workspace: WorkspacePayload;
  selectedProject: Project | null;
  onInspectClaim: (claimId: string) => void;
}

type NodeKind =
  | 'Decision'
  | 'Task'
  | 'Owner'
  | 'Dependency'
  | 'Blocker'
  | 'Risk'
  | 'Open Question'
  | 'Contact'
  | 'Source';

interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  claim?: Claim;
  sourceId?: string;
  verificationStatus?: VerificationStatus;
  isStale?: boolean;
  owner?: string | null;
  date?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
}

const NODE_STYLE: Record<
  NodeKind,
  { stroke: string; bg: string; text: string; Icon: typeof GitBranch }
> = {
  Decision: { stroke: '#3B82F6', bg: '#13223F', text: 'text-blue-400', Icon: GitBranch },
  Task: { stroke: '#22D3EE', bg: '#102636', text: 'text-cyan-400', Icon: CheckSquare },
  Owner: { stroke: '#10B981', bg: '#0F2922', text: 'text-emerald-400', Icon: User },
  Dependency: { stroke: '#8B5CF6', bg: '#1E183A', text: 'text-violet-400', Icon: Link2 },
  Blocker: { stroke: '#EF4444', bg: '#2F141A', text: 'text-red-400', Icon: ShieldAlert },
  Risk: { stroke: '#F59E0B', bg: '#2D2111', text: 'text-amber-400', Icon: AlertTriangle },
  'Open Question': { stroke: '#EC4899', bg: '#2D1426', text: 'text-pink-400', Icon: HelpCircle },
  Contact: { stroke: '#14B8A6', bg: '#102928', text: 'text-teal-400', Icon: Phone },
  Source: { stroke: '#64748B', bg: '#161F2E', text: 'text-slate-300', Icon: FileText },
};

function mapClaimKind(claim: Claim): NodeKind {
  if (claim.category === 'Rationale') return 'Decision';
  if (claim.category === 'Pending Approval') return 'Dependency';
  if (claim.category === 'Technical') return 'Dependency';
  return claim.category as NodeKind;
}

export function MemoryMapView({
  workspace,
  selectedProject,
  onInspectClaim,
}: MemoryMapViewProps) {
  const { claims, sources } = workspace;
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const projectClaims = useMemo(
    () => (selectedProject ? claims.filter((c) => c.projectId === selectedProject.id) : []),
    [claims, selectedProject]
  );

  const projectSources = useMemo(
    () => (selectedProject ? sources.filter((s) => s.projectId === selectedProject.id) : []),
    [sources, selectedProject]
  );

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    projectClaims.forEach((c) => {
      if (c.owner) set.add(c.owner);
    });
    return Array.from(set).sort();
  }, [projectClaims]);

  const { nodes, edges } = useMemo(() => {
    const filteredClaims = projectClaims.filter((c) => {
      const kind = mapClaimKind(c);
      if (categoryFilter !== 'ALL' && kind !== categoryFilter) return false;
      if (ownerFilter !== 'ALL' && (c.owner || 'Unassigned') !== ownerFilter) return false;
      if (statusFilter !== 'ALL' && c.verificationStatus !== statusFilter) return false;
      if (dateFilter && c.dueDate && c.dueDate > dateFilter) return false;
      return true;
    });

    const nodeList: GraphNode[] = [];
    const edgeList: GraphEdge[] = [];

    // Arrange claim nodes cleanly in structured concentric / lane columns so nothing overlaps
    const lanes: NodeKind[] = [
      'Decision',
      'Task',
      'Blocker',
      'Risk',
      'Dependency',
      'Open Question',
      'Contact',
    ];

    const laneCounts: Record<string, number> = {};
    filteredClaims.forEach((claim) => {
      const kind = mapClaimKind(claim);
      const laneIdx = Math.max(0, lanes.indexOf(kind));
      const rowIdx = laneCounts[kind] || 0;
      laneCounts[kind] = rowIdx + 1;

      const x = 150 + laneIdx * 185;
      const y = 95 + rowIdx * 92;

      nodeList.push({
        id: claim.id,
        kind,
        label: claim.id,
        sublabel: claim.text.length > 44 ? `${claim.text.slice(0, 42)}...` : claim.text,
        x,
        y,
        claim,
        verificationStatus: claim.verificationStatus,
        isStale: claim.isStale,
        owner: claim.owner,
        date: claim.dueDate || claim.extractedAt.slice(0, 10),
      });
    });

    // Add Owner nodes along bottom band if visible
    const referencedOwners = Array.from(
      new Set(filteredClaims.map((c) => c.owner).filter((o): o is string => Boolean(o)))
    );
    if (categoryFilter === 'ALL' || categoryFilter === 'Owner') {
      referencedOwners.forEach((ownerName, idx) => {
        const ownerNodeId = `OWN-${ownerName}`;
        nodeList.push({
          id: ownerNodeId,
          kind: 'Owner',
          label: ownerName,
          sublabel: 'Assigned Owner',
          x: 180 + idx * 210,
          y: 590,
          owner: ownerName,
        });

        filteredClaims
          .filter((c) => c.owner === ownerName)
          .forEach((c) => {
            edgeList.push({
              id: `e-${c.id}-${ownerNodeId}`,
              from: c.id,
              to: ownerNodeId,
              relation: 'Owned by',
            });
          });
      });
    }

    // Add Source nodes along top/left or bottom-right and link supporting evidence
    const usedSourceIds = Array.from(
      new Set(filteredClaims.map((c) => c.sourceId).filter((s): s is string => Boolean(s)))
    );
    usedSourceIds.forEach((srcId, idx) => {
      const src = projectSources.find((s) => s.id === srcId);
      if (!src) return;
      const srcNodeId = `NODE-${src.id}`;
      nodeList.push({
        id: srcNodeId,
        kind: 'Source',
        label: src.id,
        sublabel: src.filename.length > 26 ? `${src.filename.slice(0, 24)}...` : src.filename,
        x: 160 + idx * 240,
        y: 690,
        sourceId: src.id,
      });

      filteredClaims
        .filter((c) => c.sourceId === src.id)
        .forEach((c) => {
          edgeList.push({
            id: `e-${c.id}-${srcNodeId}`,
            from: c.id,
            to: srcNodeId,
            relation: c.sourceLocation || 'Evidence',
          });
        });
    });

    // Claim-to-claim semantic edges (Blockers -> Tasks, Dependencies -> Tasks, Decisions -> Tasks)
    filteredClaims.forEach((c) => {
      (c.relatedClaimIds || []).forEach((relId) => {
        if (filteredClaims.some((other) => other.id === relId)) {
          const exists = edgeList.some(
            (e) => (e.from === c.id && e.to === relId) || (e.from === relId && e.to === c.id)
          );
          if (!exists) {
            edgeList.push({
              id: `e-rel-${c.id}-${relId}`,
              from: c.id,
              to: relId,
              relation:
                c.category === 'Blocker'
                  ? 'Blocks'
                  : c.category === 'Dependency'
                  ? 'Depends on'
                  : 'Supports',
            });
          }
        }
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, [projectClaims, projectSources, categoryFilter, ownerFilter, statusFilter, dateFilter]);

  const activeNode =
    nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;

  const connectedEdges = activeNode
    ? edges.filter((e) => e.from === activeNode.id || e.to === activeNode.id)
    : [];

  if (!selectedProject) {
    return (
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
        Select a project to explore its interactive Project Memory Map.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Project Memory Map
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Interactive knowledge graph connecting decisions, tasks, owners, blockers, risks, and source evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
            className="p-2 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-slate-300 w-12 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            className="p-2 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-2 bg-[#0F1623] hover:bg-[#131C2E] border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
            title="Reset zoom"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters & Category Legend */}
      <div className="bg-[#0F1623] border border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Categories</option>
            <option value="Decision">Decisions</option>
            <option value="Task">Tasks</option>
            <option value="Owner">Owners</option>
            <option value="Dependency">Dependencies</option>
            <option value="Blocker">Blockers</option>
            <option value="Risk">Risks</option>
            <option value="Open Question">Open Questions</option>
            <option value="Contact">Contacts</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Owners</option>
            {uniqueOwners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Verification States</option>
            <option value="SUPPORTED">Supported</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="CONFLICT">Conflict</option>
            <option value="NO_EVIDENCE">No Evidence</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter tasks due on or before date"
            className="bg-[#090D16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
          />

          {(categoryFilter !== 'ALL' || ownerFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('ALL');
                setOwnerFilter('ALL');
                setStatusFilter('ALL');
                setDateFilter('');
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {(['Decision', 'Task', 'Blocker', 'Risk', 'Dependency', 'Owner'] as NodeKind[]).map((k) => {
            const st = NODE_STYLE[k];
            const Icon = st.Icon;
            return (
              <span key={k} className="inline-flex items-center gap-1">
                <Icon className={`w-3.5 h-3.5 ${st.text}`} />
                <span>{k}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Interactive Graph + Side Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-8 bg-[#090D16] border border-slate-800/90 rounded-xl overflow-auto relative min-h-[540px] max-h-[680px]">
          {nodes.length === 0 ? (
            <div className="p-16 text-center text-sm text-slate-400">
              No knowledge nodes match the selected filters.
            </div>
          ) : (
            <div
              className="relative"
              style={{
                width: `${1420 * zoom}px`,
                height: `${780 * zoom}px`,
              }}
            >
              <svg
                width={1420}
                height={780}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                className="block"
              >
                <defs>
                  <pattern id="grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="rgba(148,163,184,0.12)" />
                  </pattern>
                </defs>
                <rect width="1420" height="780" fill="url(#grid-dots)" />

                {/* Edges */}
                {edges.map((edge) => {
                  const fromNode = nodes.find((n) => n.id === edge.from);
                  const toNode = nodes.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  const isHighlighted =
                    activeNode &&
                    (activeNode.id === edge.from || activeNode.id === edge.to);
                  return (
                    <g key={edge.id}>
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke={isHighlighted ? '#22D3EE' : 'rgba(148,163,184,0.22)'}
                        strokeWidth={isHighlighted ? 2 : 1}
                        strokeDasharray={edge.relation === 'Blocks' ? '5 3' : undefined}
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const style = NODE_STYLE[node.kind];
                  const isSelected = activeNode?.id === node.id;
                  const isConflict = node.verificationStatus === 'CONFLICT';
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x - 82}, ${node.y - 28})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        width="164"
                        height="56"
                        rx="8"
                        fill={style.bg}
                        stroke={isSelected ? '#22D3EE' : isConflict ? '#EF4444' : style.stroke}
                        strokeWidth={isSelected ? 2.4 : 1.2}
                      />
                      <text
                        x="10"
                        y="20"
                        fill="#F8FAFC"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {node.label.slice(0, 20)}
                      </text>
                      <text
                        x="10"
                        y="38"
                        fill="#94A3B8"
                        fontSize="10"
                        fontFamily="DM Sans, sans-serif"
                      >
                        {node.sublabel.slice(0, 26)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Right Node Inspector */}
        <aside className="xl:col-span-4 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 flex flex-col justify-between">
          {activeNode ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-xs font-mono font-semibold ${NODE_STYLE[activeNode.kind].text}`}>
                    {activeNode.kind} · {activeNode.label}
                  </span>
                  {activeNode.verificationStatus && (
                    <StatusMarker
                      status={activeNode.verificationStatus}
                      isStale={activeNode.isStale}
                      compact
                    />
                  )}
                </div>

                <h2 className="font-display text-base font-semibold text-slate-100 leading-snug">
                  {activeNode.claim ? activeNode.claim.text : activeNode.label}
                </h2>
              </div>

              {activeNode.claim && (
                <>
                  <div className="bg-[#090D16] border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Source Document</span>
                      <span className="font-mono text-slate-200">
                        {activeNode.claim.sourceId || 'None'} · {activeNode.claim.sourceLocation || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Assigned Owner</span>
                      <span className="text-slate-200">{activeNode.claim.owner || 'Unassigned'}</span>
                    </div>
                    {activeNode.claim.dueDate && (
                      <div className="flex justify-between text-slate-400">
                        <span>Due Date</span>
                        <span className="font-mono text-slate-200">{activeNode.claim.dueDate}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-1.5">
                      Source Evidence Snippet
                    </div>
                    <p className="text-xs text-slate-300 bg-[#131C2E] border border-slate-800 rounded-lg p-3 leading-relaxed">
                      {activeNode.claim.evidenceSnippet ||
                        'No verbatim evidence snippet linked to this claim.'}
                    </p>
                  </div>
                </>
              )}

              <div>
                <div className="text-xs font-medium text-slate-400 mb-2">
                  Connected Nodes ({connectedEdges.length})
                </div>
                {connectedEdges.length === 0 ? (
                  <p className="text-xs text-slate-500">No direct connections under current filters.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {connectedEdges.map((edge) => {
                      const otherId = edge.from === activeNode.id ? edge.to : edge.from;
                      const other = nodes.find((n) => n.id === otherId);
                      if (!other) return null;
                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => setSelectedNodeId(other.id)}
                          className="w-full text-left px-3 py-2 bg-[#131C2E] hover:bg-slate-800 border border-slate-800 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="text-slate-200 truncate">
                            {other.kind}: {other.label}
                          </span>
                          <span className="font-mono text-cyan-400 whitespace-nowrap shrink-0">
                            {edge.relation}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeNode.claim && (
                <button
                  type="button"
                  onClick={() => onInspectClaim(activeNode.claim!.id)}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Open in Evidence Ledger
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-12">
              Click any node in the Memory Map to inspect its evidence and relationships.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
