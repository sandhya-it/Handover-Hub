import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AuditLogEntry,
  Claim,
  ConflictRecord,
  GapItem,
  Handover,
  NotificationItem,
  Project,
  ProjectSource,
  RuntimeCapabilities,
  User,
  UserRole,
  WorkspacePayload,
} from '../src/types.ts';
import { computeProjectGaps, isGeminiConfigured } from './ai.ts';
import { createSeedData, DEMO_USERS, DemoUserWithPassword } from './seedData.ts';

export interface WorkspaceState {
  users: DemoUserWithPassword[];
  projects: Project[];
  sources: ProjectSource[];
  claims: Claim[];
  conflicts: ConflictRecord[];
  gaps: GapItem[];
  handovers: Handover[];
  auditLogs: AuditLogEntry[];
  notifications: NotificationItem[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'workspace.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'handover-hub-aethergrid-session-signing-key-2026';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key && url.startsWith('http'));
}

function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { persistSession: false } }
    );
  }
  return supabaseClient;
}

function buildInitialState(): WorkspaceState {
  const seeded = createSeedData();
  const recomputedGaps = seeded.projects.flatMap((p) =>
    computeProjectGaps(p.id, seeded.claims, seeded.conflicts)
  );
  return {
    users: DEMO_USERS.map((u) => ({ ...u })),
    projects: seeded.projects,
    sources: seeded.sources,
    claims: seeded.claims,
    conflicts: seeded.conflicts,
    gaps: recomputedGaps.length > 0 ? recomputedGaps : seeded.gaps,
    handovers: seeded.handovers,
    auditLogs: seeded.auditLogs,
    notifications: seeded.notifications,
  };
}

let state: WorkspaceState | null = null;

function persistToDisk(current: WorkspaceState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch {
    // Ignore disk write errors in read-only serverless environments (e.g., Vercel)
  }
}

async function persistToSupabaseSnapshot(current: WorkspaceState) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('handover_workspace_snapshots').upsert({
      id: 'default',
      payload: {
        ...current,
        users: current.users.map(({ password: _p, ...u }) => u),
      },
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal if Supabase table is not yet initialized
  }
}

export function getState(): WorkspaceState {
  if (state) return state;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as WorkspaceState;
      if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.users)) {
        state = parsed;
        return state;
      }
    }
  } catch {
    // Fallback to seed state
  }

  state = buildInitialState();
  persistToDisk(state);
  return state;
}

export function saveState(next: WorkspaceState) {
  state = next;
  persistToDisk(state);
  void persistToSupabaseSnapshot(state);
}

export function resetDemoWorkspace(actor?: User): WorkspaceState {
  const fresh = buildInitialState();
  if (actor) {
    fresh.auditLogs.unshift({
      id: `AUD-${Date.now().toString().slice(-6)}`,
      projectId: 'proj-smart-campus',
      projectName: 'Smart Campus Management System',
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: 'Loaded Clean Demo Workspace (Smart Campus Management System)',
      category: 'PROJECT',
      details: 'Workspace restored to verified Round 2 demonstration baseline.',
      timestamp: new Date().toISOString(),
    });
  }
  saveState(fresh);
  return fresh;
}

export function recomputeAllGaps(projectId?: string) {
  const s = getState();
  if (projectId) {
    const otherGaps = s.gaps.filter((g) => g.projectId !== projectId);
    const projectGaps = computeProjectGaps(projectId, s.claims, s.conflicts);
    s.gaps = [...otherGaps, ...projectGaps];
  } else {
    s.gaps = s.projects.flatMap((p) => computeProjectGaps(p.id, s.claims, s.conflicts));
  }
  saveState(s);
}

export function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const s = getState();
  const record: AuditLogEntry = {
    ...entry,
    id: `AUD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
    timestamp: new Date().toISOString(),
  };
  s.auditLogs.unshift(record);
  saveState(s);
  return record;
}

export function createSessionToken(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): User | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      userId: string;
      exp: number;
    };
    if (decoded.exp < Date.now()) return null;
    const s = getState();
    const found = s.users.find((u) => u.id === decoded.userId && u.active);
    if (!found) return null;
    const { password: _p, ...safeUser } = found;
    return safeUser;
  } catch {
    return null;
  }
}

export function getRuntimeCapabilities(): RuntimeCapabilities {
  return {
    geminiConfigured: isGeminiConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    storageMode: isSupabaseConfigured() ? 'supabase' : 'local_demo',
    aiModel: 'gemini-4-hydrogen',
  };
}

export function buildWorkspacePayloadForUser(user: User): WorkspacePayload {
  const s = getState();
  const safeUsers: User[] = s.users.map(({ password: _p, ...u }) => u);

  // Enforce least-privilege data filtering on server side for Incoming Member
  let visibleProjects = s.projects;
  let visibleHandovers = s.handovers;
  let visibleSources = s.sources;
  let visibleClaims = s.claims;
  let visibleConflicts = s.conflicts;
  let visibleGaps = s.gaps;
  let visibleAuditLogs = s.auditLogs;

  if (user.role === 'Incoming Member') {
    const permittedHandoverStatuses = new Set(['APPROVED', 'SHARED', 'ACKNOWLEDGED']);
    visibleHandovers = s.handovers.filter(
      (h) =>
        permittedHandoverStatuses.has(h.status) &&
        (h.incomingMemberId === user.id ||
          s.projects.some(
            (p) => p.id === h.projectId && p.members.some((m) => m.userId === user.id)
          ))
    );
    const permittedProjectIds = new Set([
      ...visibleHandovers.map((h) => h.projectId),
      ...s.projects
        .filter((p) => p.members.some((m) => m.userId === user.id))
        .map((p) => p.id),
    ]);
    visibleProjects = s.projects.filter((p) => permittedProjectIds.has(p.id));
    visibleSources = s.sources.filter(
      (src) => permittedProjectIds.has(src.projectId) && !src.restrictedToReviewers
    );
    visibleClaims = s.claims.filter(
      (clm) =>
        permittedProjectIds.has(clm.projectId) &&
        (clm.verificationStatus === 'SUPPORTED' || clm.verificationStatus === 'NEEDS_REVIEW')
    );
    visibleConflicts = s.conflicts.filter((c) => permittedProjectIds.has(c.projectId));
    visibleGaps = s.gaps.filter((g) => permittedProjectIds.has(g.projectId));
    visibleAuditLogs = s.auditLogs.filter(
      (a) => !a.projectId || permittedProjectIds.has(a.projectId)
    );
  }

  const visibleNotifications = s.notifications.filter((n) => n.forRoles.includes(user.role));

  return {
    currentUser: user,
    users: safeUsers,
    projects: visibleProjects,
    sources: visibleSources,
    claims: visibleClaims,
    conflicts: visibleConflicts,
    gaps: visibleGaps,
    handovers: visibleHandovers,
    auditLogs: visibleAuditLogs,
    notifications: visibleNotifications,
    capabilities: getRuntimeCapabilities(),
  };
}

export function hasRole(user: User, allowed: UserRole[]): boolean {
  return allowed.includes(user.role);
}
