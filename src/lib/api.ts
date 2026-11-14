import {
  Claim,
  Handover,
  Project,
  ProcessingMode,
  User,
  UserRole,
  WorkspacePayload,
} from '../types.ts';

const TOKEN_STORAGE_KEY = 'handover_hub_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getDemoAccounts: () =>
    apiRequest<{ accounts: User[]; capabilities: WorkspacePayload['capabilities'] }>(
      '/api/auth/demo-accounts'
    ),

  login: async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; workspace: WorkspacePayload }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setStoredToken(res.token);
    return res.workspace;
  },

  demoLogin: async (role: UserRole) => {
    const res = await apiRequest<{ token: string; workspace: WorkspacePayload }>(
      '/api/auth/demo-login',
      {
        method: 'POST',
        body: JSON.stringify({ role }),
      }
    );
    setStoredToken(res.token);
    return res.workspace;
  },

  getWorkspace: () => apiRequest<WorkspacePayload>('/api/workspace'),

  loadDemoWorkspace: () =>
    apiRequest<WorkspacePayload>('/api/workspace/load-demo', {
      method: 'POST',
    }),

  markNotificationRead: (id?: string) =>
    apiRequest<WorkspacePayload>('/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  updateUserRole: (userId: string, payload: { role?: UserRole; active?: boolean }) =>
    apiRequest<WorkspacePayload>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createProject: (payload: Partial<Project>) =>
    apiRequest<{ project: Project; workspace: WorkspacePayload }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (projectId: string, payload: Partial<Project>) =>
    apiRequest<WorkspacePayload>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  assignProjectMember: (projectId: string, userId: string, projectRole: string) =>
    apiRequest<WorkspacePayload>(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, projectRole }),
    }),

  uploadSources: (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return apiRequest<{
      uploaded: WorkspacePayload['sources'];
      warnings: string[];
      workspace: WorkspacePayload;
    }>(`/api/projects/${projectId}/sources/upload`, {
      method: 'POST',
      body: form,
    });
  },

  deleteSource: (sourceId: string) =>
    apiRequest<WorkspacePayload>(`/api/sources/${sourceId}`, {
      method: 'DELETE',
    }),

  analyzeProject: (projectId: string, sourceIds?: string[]) =>
    apiRequest<{
      mode: ProcessingMode;
      addedClaimsCount: number;
      addedConflictsCount: number;
      warning?: string;
      workspace: WorkspacePayload;
    }>(`/api/projects/${projectId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ sourceIds }),
    }),

  updateClaim: (claimId: string, payload: Partial<Claim>) =>
    apiRequest<WorkspacePayload>(`/api/claims/${claimId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  resolveConflict: (
    conflictId: string,
    payload: {
      winningSide: 'A' | 'B' | 'SYNTHESIZED';
      resolutionSummary: string;
      reviewerComment: string;
    }
  ) =>
    apiRequest<WorkspacePayload>(`/api/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateHandover: (payload: {
    projectId: string;
    departingMemberId: string;
    incomingMemberId: string;
    incomingRole: string;
    includedSourceIds: string[];
    scope: string;
  }) =>
    apiRequest<{ handover: Handover; workspace: WorkspacePayload }>('/api/handovers/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  regenerateHandoverSection: (handoverId: string, sectionKey: string) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/regenerate-section`, {
      method: 'POST',
      body: JSON.stringify({ sectionKey }),
    }),

  updateHandover: (handoverId: string, payload: Partial<Handover>) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  submitHandoverForReview: (handoverId: string) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/submit-review`, {
      method: 'POST',
    }),

  addHandoverComment: (handoverId: string, comment: string, sectionKey?: string) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment, sectionKey }),
    }),

  submitReviewDecision: (
    handoverId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED',
    note: string
  ) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/review-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),

  shareHandover: (handoverId: string) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/share`, {
      method: 'POST',
    }),

  acknowledgeHandover: (handoverId: string) =>
    apiRequest<WorkspacePayload>(`/api/handovers/${handoverId}/acknowledge`, {
      method: 'POST',
    }),
};
