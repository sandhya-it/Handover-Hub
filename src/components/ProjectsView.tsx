import {
  Calendar,
  Edit3,
  FilePlus2,
  FolderPlus,
  Send,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Project, ProjectStatus, WorkspacePayload } from '../types.ts';
import { api } from '../lib/api.ts';

interface ProjectsViewProps {
  workspace: WorkspacePayload;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onWorkspaceUpdated: (next: WorkspacePayload) => void;
  onNavigate: (view: string) => void;
}

export function ProjectsView({
  workspace,
  selectedProjectId,
  onSelectProject,
  onWorkspaceUpdated,
  onNavigate,
}: ProjectsViewProps) {
  const { projects, users, sources, claims, currentUser } = workspace;
  const canEdit = currentUser.role !== 'Incoming Member';
  const canManageMembers =
    currentUser.role === 'Administrator' || currentUser.role === 'Project Reviewer';

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;

  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [startDate, setStartDate] = useState('2026-11-14');
  const [expectedEndDate, setExpectedEndDate] = useState('2027-02-28');
  const [departingMemberId, setDepartingMemberId] = useState('usr-departing');
  const [incomingMemberId, setIncomingMemberId] = useState('usr-incoming');

  const [memberUserId, setMemberUserId] = useState(users[0]?.id || '');
  const [memberProjectRole, setMemberProjectRole] = useState('Engineering Contributor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStatus('Active');
    setStartDate('2026-11-14');
    setExpectedEndDate('2027-02-28');
    setDepartingMemberId('usr-departing');
    setIncomingMemberId('usr-incoming');
    setError(null);
    setShowCreate(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setName(proj.name);
    setDescription(proj.description);
    setStatus(proj.status);
    setStartDate(proj.startDate);
    setExpectedEndDate(proj.expectedEndDate);
    setDepartingMemberId(proj.departingMemberId || '');
    setIncomingMemberId(proj.incomingMemberId || '');
    setError(null);
    setShowCreate(true);
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editingProject) {
        const next = await api.updateProject(editingProject.id, {
          name,
          description,
          status,
          startDate,
          expectedEndDate,
          departingMemberId: departingMemberId || undefined,
          incomingMemberId: incomingMemberId || undefined,
        });
        onWorkspaceUpdated(next);
        setSuccessMsg(`Updated project "${name}".`);
      } else {
        const res = await api.createProject({
          name,
          description,
          status,
          startDate,
          expectedEndDate,
          departingMemberId: departingMemberId || undefined,
          incomingMemberId: incomingMemberId || undefined,
        });
        onWorkspaceUpdated(res.workspace);
        onSelectProject(res.project.id);
        setSuccessMsg(`Created project "${res.project.name}".`);
      }
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject || !memberUserId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.assignProjectMember(
        activeProject.id,
        memberUserId,
        memberProjectRole
      );
      onWorkspaceUpdated(next);
      setSuccessMsg('Project member assignment saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member');
    } finally {
      setBusy(false);
    }
  };

  const projectSources = activeProject
    ? sources.filter((s) => s.projectId === activeProject.id)
    : [];
  const projectClaims = activeProject
    ? claims.filter((c) => c.projectId === activeProject.id)
    : [];

  const decisions = projectClaims.filter((c) => c.category === 'Decision');
  const tasks = projectClaims.filter((c) => c.category === 'Task');
  const risks = projectClaims.filter((c) => c.category === 'Risk');
  const dependencies = projectClaims.filter((c) => c.category === 'Dependency');
  const blockers = projectClaims.filter((c) => c.category === 'Blocker');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
            Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage project lifecycles, transition pairs, team roles, and extracted continuity artifacts.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-200 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project Selector List */}
        <div className="lg:col-span-4 space-y-3">
          {projects.map((proj) => {
            const selected = activeProject?.id === proj.id;
            const srcCount = sources.filter((s) => s.projectId === proj.id).length;
            const clmCount = claims.filter((c) => c.projectId === proj.id).length;
            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => onSelectProject(proj.id)}
                className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#131C2E] border-blue-500/50'
                    : 'bg-[#0F1623] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-display text-sm font-semibold text-slate-100">
                    {proj.name}
                  </h3>
                  <span className="text-xs font-mono text-cyan-400 whitespace-nowrap shrink-0">
                    {proj.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{proj.description}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
                  <span>{srcCount} sources</span>
                  <span aria-hidden="true">·</span>
                  <span>{clmCount} claims</span>
                  <span aria-hidden="true">·</span>
                  <span>Due {proj.expectedEndDate}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Project Details */}
        {activeProject ? (
          <div className="lg:col-span-8 bg-[#0F1623] border border-slate-800/90 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
              <div className="max-w-2xl">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                  <span>{activeProject.status}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{activeProject.startDate} to {activeProject.expectedEndDate}</span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-50">
                  {activeProject.name}
                </h2>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  {activeProject.description}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(activeProject)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(activeProject.id);
                      onNavigate('sources');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>Upload Sources</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(activeProject.id);
                      onNavigate('composer');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium text-white cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Create Handover</span>
                  </button>
                </div>
              )}
            </div>

            {/* Transition & Counts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'Sources', count: projectSources.length },
                { label: 'Decisions', count: decisions.length },
                { label: 'Tasks', count: tasks.length },
                { label: 'Risks', count: risks.length },
                { label: 'Dependencies', count: dependencies.length },
                { label: 'Blockers', count: blockers.length },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#131C2E] border border-slate-800/80 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{stat.label}</div>
                  <div className="font-mono text-lg font-semibold text-slate-100 mt-1 tabular-nums">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>

            {/* Transition Pair */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-800/80 text-xs">
              <div>
                <div className="text-slate-400 mb-1">Project Lead</div>
                <div className="text-sm font-medium text-slate-100">{activeProject.leadName}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Departing Member</div>
                <div className="text-sm font-medium text-slate-100">
                  {users.find((u) => u.id === activeProject.departingMemberId)?.name || 'Not assigned'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Incoming Member</div>
                <div className="text-sm font-medium text-cyan-300">
                  {users.find((u) => u.id === activeProject.incomingMemberId)?.name || 'Not assigned'}
                </div>
              </div>
            </div>

            {/* Project Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Project Members ({activeProject.members.length})</span>
                </h3>
              </div>

              <div className="divide-y divide-slate-800/70 mb-4">
                {activeProject.members.map((m) => (
                  <div key={m.userId} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <span className="font-medium text-slate-200">{m.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{m.email}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono whitespace-nowrap shrink-0">
                      {m.projectRole} · {m.role}
                    </div>
                  </div>
                ))}
              </div>

              {canManageMembers && (
                <form onSubmit={handleAddMember} className="flex flex-wrap items-center gap-2 pt-2">
                  <select
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    className="bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={memberProjectRole}
                    onChange={(e) => setMemberProjectRole(e.target.value)}
                    placeholder="Project role title"
                    className="flex-1 min-w-[180px] bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#131C2E] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-100 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign Member</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-[#0F1623] border border-slate-800/90 rounded-xl p-12 text-center text-sm text-slate-400">
            Select or create a project to inspect continuity metadata.
          </div>
        )}
      </div>

      {/* Create / Edit Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F1623] border border-slate-700/90 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-slate-100">
                {editingProject ? 'Edit Project Details' : 'Create New Continuity Project'}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Campus Smart Grid Telemetry"
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe scope, core systems, and handover goals..."
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="Active">Active</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Target End
                  </label>
                  <input
                    type="date"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Departing Member</label>
                  <select
                    value={departingMemberId}
                    onChange={(e) => setDepartingMemberId(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">Select member...</option>
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
                    value={incomingMemberId}
                    onChange={(e) => setIncomingMemberId(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">Select member...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#131C2E] border border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                >
                  {busy ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
