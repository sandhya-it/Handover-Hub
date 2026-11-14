import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  Claim,
  Handover,
  HandoverComment,
  Project,
  ProjectMember,
  ProjectSource,
  User,
  UserRole,
} from '../src/types.ts';
import {
  analyzeProjectSourcesWithAI,
  generateHandoverWithAI,
  regenerateSingleSectionWithAI,
} from './ai.ts';
import { parseDocumentBuffer } from './parser.ts';
import {
  appendAuditLog,
  buildWorkspacePayloadForUser,
  createSessionToken,
  getRuntimeCapabilities,
  getState,
  hasRole,
  recomputeAllGaps,
  resetDemoWorkspace,
  saveState,
  verifySessionToken,
} from './store.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10,
  },
});

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = verifySessionToken(extractToken(req));
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!hasRole(req.user, roles)) {
      res.status(403).json({
        error: `Access denied. Role "${req.user.role}" does not have permission for this operation.`,
      });
      return;
    }
    next();
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      capabilities: getRuntimeCapabilities(),
      timestamp: new Date().toISOString(),
    });
  });

  // Public demo role listing for login screen (no passwords exposed)
  app.get('/api/auth/demo-accounts', (_req, res) => {
    const s = getState();
    const demoEmails = [
      'admin@handoverhub.dev',
      'reviewer@handoverhub.dev',
      'departing@handoverhub.dev',
      'incoming@handoverhub.dev',
    ];
    const accounts = s.users
      .filter((u) => demoEmails.includes(u.email))
      .map(({ password: _p, ...safe }) => safe);
    res.json({ accounts, capabilities: getRuntimeCapabilities() });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const s = getState();
    const match = s.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (!match || !match.active) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const { password: _p, ...safeUser } = match;
    const token = createSessionToken(safeUser);
    appendAuditLog({
      projectId: null,
      projectName: null,
      userId: safeUser.id,
      userName: safeUser.name,
      userRole: safeUser.role,
      action: `Signed in as ${safeUser.role}`,
      category: 'AUTH',
      details: `Authenticated session established for ${safeUser.email}.`,
    });
    res.json({
      token,
      workspace: buildWorkspacePayloadForUser(safeUser),
    });
  });

  app.post('/api/auth/demo-login', (req, res) => {
    const { role } = req.body as { role?: UserRole };
    const s = getState();
    const match = s.users.find((u) => u.role === role && u.active);
    if (!match) {
      res.status(404).json({ error: 'Demo account for selected role not found.' });
      return;
    }
    const { password: _p, ...safeUser } = match;
    const token = createSessionToken(safeUser);
    appendAuditLog({
      projectId: null,
      projectName: null,
      userId: safeUser.id,
      userName: safeUser.name,
      userRole: safeUser.role,
      action: `Demo sign-in as ${safeUser.role}`,
      category: 'AUTH',
      details: `Demo workspace session initialized for ${safeUser.name}.`,
    });
    res.json({
      token,
      workspace: buildWorkspacePayloadForUser(safeUser),
    });
  });

  app.get('/api/workspace', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json(buildWorkspacePayloadForUser(req.user!));
  });

  app.post('/api/workspace/load-demo', requireAuth, (req: AuthenticatedRequest, res) => {
    resetDemoWorkspace(req.user!);
    res.json(buildWorkspacePayloadForUser(req.user!));
  });

  // Notifications
  app.post('/api/notifications/mark-read', requireAuth, (req: AuthenticatedRequest, res) => {
    const s = getState();
    const { id } = req.body as { id?: string };
    s.notifications = s.notifications.map((n) =>
      !id || n.id === id ? { ...n, read: true } : n
    );
    saveState(s);
    res.json(buildWorkspacePayloadForUser(req.user!));
  });

  // Admin: User Role Management
  app.patch(
    '/api/users/:id/role',
    requireAuth,
    requireRoles(['Administrator']),
    (req: AuthenticatedRequest, res) => {
      const { role, active } = req.body as { role?: UserRole; active?: boolean };
      const s = getState();
      const target = s.users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const prevRole = target.role;
      if (role) target.role = role;
      if (typeof active === 'boolean') target.active = active;
      saveState(s);

      appendAuditLog({
        projectId: null,
        projectName: null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Updated user permissions for ${target.name}`,
        category: 'PERMISSION',
        targetId: target.id,
        details: `Role changed from ${prevRole} to ${target.role}${
          typeof active === 'boolean' ? ` (active: ${target.active})` : ''
        }.`,
      });
      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Projects CRUD
  app.post(
    '/api/projects',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const {
        name,
        description,
        status,
        startDate,
        expectedEndDate,
        departingMemberId,
        incomingMemberId,
      } = req.body as Partial<Project>;

      if (!name?.trim() || !description?.trim()) {
        res.status(400).json({ error: 'Project name and description are required.' });
        return;
      }

      const s = getState();
      const now = new Date().toISOString();
      const members: ProjectMember[] = [
        {
          userId: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
          projectRole: 'Project Creator',
          addedAt: now,
        },
      ];

      for (const mId of [departingMemberId, incomingMemberId]) {
        if (mId && !members.some((m) => m.userId === mId)) {
          const u = s.users.find((usr) => usr.id === mId);
          if (u) {
            members.push({
              userId: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              projectRole: u.id === departingMemberId ? 'Departing Member' : 'Incoming Member',
              addedAt: now,
            });
          }
        }
      }

      const newProject: Project = {
        id: `proj-${Date.now().toString(36)}`,
        name: name.trim(),
        description: description.trim(),
        leadUserId: req.user!.id,
        leadName: req.user!.name,
        status: status || 'Active',
        startDate: startDate || now.slice(0, 10),
        expectedEndDate: expectedEndDate || '2027-01-31',
        departingMemberId,
        incomingMemberId,
        members,
        createdAt: now,
        updatedAt: now,
      };

      s.projects.unshift(newProject);
      saveState(s);

      appendAuditLog({
        projectId: newProject.id,
        projectName: newProject.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Created project "${newProject.name}"`,
        category: 'PROJECT',
        targetId: newProject.id,
        details: `Initial status: ${newProject.status}, target completion: ${newProject.expectedEndDate}.`,
      });

      res.status(201).json({
        project: newProject,
        workspace: buildWorkspacePayloadForUser(req.user!),
      });
    }
  );

  app.patch(
    '/api/projects/:id',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const project = s.projects.find((p) => p.id === req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const {
        name,
        description,
        status,
        startDate,
        expectedEndDate,
        departingMemberId,
        incomingMemberId,
      } = req.body as Partial<Project>;

      if (name?.trim()) project.name = name.trim();
      if (description?.trim()) project.description = description.trim();
      if (status) project.status = status;
      if (startDate) project.startDate = startDate;
      if (expectedEndDate) project.expectedEndDate = expectedEndDate;
      if (departingMemberId !== undefined) project.departingMemberId = departingMemberId;
      if (incomingMemberId !== undefined) project.incomingMemberId = incomingMemberId;
      project.updatedAt = new Date().toISOString();

      saveState(s);

      appendAuditLog({
        projectId: project.id,
        projectName: project.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Updated project details for "${project.name}"`,
        category: 'PROJECT',
        targetId: project.id,
        details: `Status: ${project.status}, Deadline: ${project.expectedEndDate}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.post(
    '/api/projects/:id/members',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const project = s.projects.find((p) => p.id === req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const { userId, projectRole } = req.body as { userId?: string; projectRole?: string };
      const targetUser = s.users.find((u) => u.id === userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const existing = project.members.find((m) => m.userId === targetUser.id);
      if (existing) {
        existing.projectRole = projectRole?.trim() || existing.projectRole;
      } else {
        project.members.push({
          userId: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          projectRole: projectRole?.trim() || targetUser.role,
          addedAt: new Date().toISOString(),
        });
      }
      project.updatedAt = new Date().toISOString();
      saveState(s);

      appendAuditLog({
        projectId: project.id,
        projectName: project.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Assigned ${targetUser.name} to "${project.name}"`,
        category: 'PERMISSION',
        targetId: targetUser.id,
        details: `Project role: ${projectRole || targetUser.role}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Source Upload & Processing
  app.post(
    '/api/projects/:id/sources/upload',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    upload.array('files', 10),
    async (req: AuthenticatedRequest, res) => {
      const s = getState();
      const project = s.projects.find((p) => p.id === req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Please select at least one PDF, DOCX, TXT, or CSV file.' });
        return;
      }

      const uploadedSources: ProjectSource[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          const parsed = await parseDocumentBuffer(
            file.buffer,
            file.originalname,
            file.mimetype
          );
          const nextNum = s.sources.length + uploadedSources.length + 1;
          const src: ProjectSource = {
            id: `SRC-${String(nextNum).padStart(3, '0')}`,
            projectId: project.id,
            filename: file.originalname,
            fileType: parsed.fileType,
            sizeBytes: file.size,
            uploadedByUserId: req.user!.id,
            uploadedByName: req.user!.name,
            uploadedAt: new Date().toISOString(),
            status: 'Processed',
            rawText: parsed.rawText,
            chunks: parsed.chunks,
          };
          uploadedSources.push(src);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to parse file';
          errors.push(`${file.originalname}: ${msg}`);
        }
      }

      if (uploadedSources.length === 0) {
        res.status(400).json({ error: errors.join('; ') || 'File parsing failed.' });
        return;
      }

      s.sources.push(...uploadedSources);
      project.updatedAt = new Date().toISOString();
      saveState(s);

      for (const src of uploadedSources) {
        appendAuditLog({
          projectId: project.id,
          projectName: project.name,
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: `Uploaded and parsed ${src.filename}`,
          category: 'SOURCE',
          targetId: src.id,
          details: `Extracted ${src.chunks.length} indexed ${
            src.fileType === 'pdf'
              ? 'pages'
              : src.fileType === 'csv'
              ? 'rows'
              : src.fileType === 'docx'
              ? 'sections'
              : 'paragraphs'
          } (${(src.sizeBytes / 1024).toFixed(1)} KB).`,
        });
      }

      res.status(201).json({
        uploaded: uploadedSources,
        warnings: errors,
        workspace: buildWorkspacePayloadForUser(req.user!),
      });
    }
  );

  app.delete(
    '/api/sources/:id',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const idx = s.sources.findIndex((src) => src.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Source document not found.' });
        return;
      }
      const removed = s.sources[idx];
      const project = s.projects.find((p) => p.id === removed.projectId);
      s.sources.splice(idx, 1);

      // Update any claims citing the deleted source so we never leave dangling citations
      s.claims = s.claims.map((c) =>
        c.sourceId === removed.id
          ? {
              ...c,
              sourceId: null,
              sourceFilename: null,
              sourceLocation: null,
              evidenceSnippet: null,
              verificationStatus: 'NO_EVIDENCE',
              reviewerNote: `Cited source ${removed.filename} was deleted.`,
            }
          : c
      );
      recomputeAllGaps(removed.projectId);
      saveState(s);

      appendAuditLog({
        projectId: removed.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Deleted source document ${removed.filename}`,
        category: 'SOURCE',
        targetId: removed.id,
        details: 'Document removed and dependent claims marked NO_EVIDENCE.',
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // AI Knowledge Extraction & Conflict Analysis
  app.post(
    '/api/projects/:id/analyze',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    async (req: AuthenticatedRequest, res) => {
      const s = getState();
      const project = s.projects.find((p) => p.id === req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const { sourceIds } = req.body as { sourceIds?: string[] };
      const targetSources = s.sources.filter(
        (src) =>
          src.projectId === project.id &&
          (!sourceIds || sourceIds.length === 0 || sourceIds.includes(src.id))
      );

      if (targetSources.length === 0) {
        res.status(400).json({ error: 'Upload at least one source document before running analysis.' });
        return;
      }

      const result = await analyzeProjectSourcesWithAI(
        project,
        targetSources,
        s.claims,
        s.conflicts
      );

      s.claims.push(...result.newClaims);
      s.conflicts.push(...result.newConflicts);

      for (const src of targetSources) {
        src.status = 'Analyzed';
      }

      recomputeAllGaps(project.id);
      project.updatedAt = new Date().toISOString();
      saveState(s);

      appendAuditLog({
        projectId: project.id,
        projectName: project.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Ran ${
          result.mode === 'live_ai' ? 'Live Gemini AI' : 'Deterministic Fallback'
        } Knowledge Extraction`,
        category: 'EXTRACTION',
        targetId: project.id,
        details: `Analyzed ${targetSources.length} source(s): added ${result.newClaims.length} new claim(s) and ${result.newConflicts.length} new conflict(s).`,
      });

      res.json({
        mode: result.mode,
        addedClaimsCount: result.newClaims.length,
        addedConflictsCount: result.newConflicts.length,
        warning: result.warning,
        workspace: buildWorkspacePayloadForUser(req.user!),
      });
    }
  );

  // Evidence Ledger: Claim Update & Verification
  app.patch(
    '/api/claims/:id',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const claim = s.claims.find((c) => c.id === req.params.id);
      if (!claim) {
        res.status(404).json({ error: 'Claim not found.' });
        return;
      }

      const { text, owner, dueDate, verificationStatus, isStale, reviewerNote, taskStatus } =
        req.body as Partial<Claim>;

      // Enforce that only Reviewers and Administrators can verify a claim as SUPPORTED
      if (
        verificationStatus === 'SUPPORTED' &&
        !hasRole(req.user!, ['Administrator', 'Project Reviewer'])
      ) {
        res.status(403).json({
          error:
            'Only a Project Reviewer or Administrator can mark claims as SUPPORTED. You can edit context or flag NEEDS_REVIEW.',
        });
        return;
      }

      const changes: string[] = [];
      if (text !== undefined && text.trim() && text.trim() !== claim.text) {
        claim.text = text.trim();
        changes.push('text');
      }
      if (owner !== undefined && owner !== claim.owner) {
        claim.owner = owner?.trim() || null;
        changes.push(`owner=${claim.owner || 'Unassigned'}`);
      }
      if (dueDate !== undefined && dueDate !== claim.dueDate) {
        claim.dueDate = dueDate?.trim() || null;
        changes.push(`dueDate=${claim.dueDate || 'None'}`);
      }
      if (taskStatus !== undefined) {
        claim.taskStatus = taskStatus;
        changes.push(`taskStatus=${taskStatus}`);
      }
      if (typeof isStale === 'boolean' && isStale !== claim.isStale) {
        claim.isStale = isStale;
        changes.push(`stale=${isStale}`);
      }
      if (reviewerNote !== undefined) {
        claim.reviewerNote = reviewerNote;
        changes.push('note');
      }
      if (verificationStatus && verificationStatus !== claim.verificationStatus) {
        if (verificationStatus === 'SUPPORTED' && !claim.sourceId) {
          res.status(400).json({
            error: 'Cannot mark a claim SUPPORTED when it has no traceable source evidence.',
          });
          return;
        }
        claim.verificationStatus = verificationStatus;
        if (verificationStatus === 'SUPPORTED') {
          claim.verifiedBy = req.user!.name;
          claim.verifiedAt = new Date().toISOString();
        }
        changes.push(`status=${verificationStatus}`);
      }

      recomputeAllGaps(claim.projectId);
      saveState(s);

      const project = s.projects.find((p) => p.id === claim.projectId);
      appendAuditLog({
        projectId: claim.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Updated claim ${claim.id}`,
        category: 'CLAIM',
        targetId: claim.id,
        details: changes.length > 0 ? `Modified: ${changes.join(', ')}.` : 'Claim reviewed.',
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Gap & Conflict Detector: Resolve Conflict
  app.post(
    '/api/conflicts/:id/resolve',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const conflict = s.conflicts.find((c) => c.id === req.params.id);
      if (!conflict) {
        res.status(404).json({ error: 'Conflict record not found.' });
        return;
      }

      const { winningSide, resolutionSummary, reviewerComment } = req.body as {
        winningSide?: 'A' | 'B' | 'SYNTHESIZED';
        resolutionSummary?: string;
        reviewerComment?: string;
      };

      if (!resolutionSummary?.trim() || !reviewerComment?.trim()) {
        res.status(400).json({
          error: 'Both a resolution decision summary and reviewer comment are required.',
        });
        return;
      }

      conflict.status = 'RESOLVED';
      conflict.resolutionSummary = resolutionSummary.trim();
      conflict.reviewerComment = reviewerComment.trim();
      conflict.resolvedBy = req.user!.name;
      conflict.resolvedAt = new Date().toISOString();

      const claimA = s.claims.find((c) => c.id === conflict.claimAId);
      const claimB = s.claims.find((c) => c.id === conflict.claimBId);

      if (winningSide === 'A') {
        if (claimA) {
          claimA.verificationStatus = 'SUPPORTED';
          claimA.verifiedBy = req.user!.name;
          claimA.verifiedAt = conflict.resolvedAt;
          claimA.reviewerNote = `Conflict ${conflict.id} resolved in favor of this statement: ${reviewerComment.trim()}`;
        }
        if (claimB) {
          claimB.verificationStatus = 'NEEDS_REVIEW';
          claimB.isStale = true;
          claimB.reviewerNote = `Superseded by ${conflict.id} resolution (${req.user!.name}): ${reviewerComment.trim()}`;
        }
      } else if (winningSide === 'B') {
        if (claimB) {
          claimB.verificationStatus = 'SUPPORTED';
          claimB.verifiedBy = req.user!.name;
          claimB.verifiedAt = conflict.resolvedAt;
          claimB.reviewerNote = `Conflict ${conflict.id} resolved in favor of this statement: ${reviewerComment.trim()}`;
        }
        if (claimA) {
          claimA.verificationStatus = 'NEEDS_REVIEW';
          claimA.isStale = true;
          claimA.reviewerNote = `Superseded by ${conflict.id} resolution (${req.user!.name}): ${reviewerComment.trim()}`;
        }
      } else {
        if (claimA) {
          claimA.verificationStatus = 'SUPPORTED';
          claimA.text = resolutionSummary.trim();
          claimA.verifiedBy = req.user!.name;
          claimA.verifiedAt = conflict.resolvedAt;
          claimA.reviewerNote = `Synthesized resolution (${conflict.id}): ${reviewerComment.trim()}`;
        }
        if (claimB) {
          claimB.verificationStatus = 'NEEDS_REVIEW';
          claimB.reviewerNote = `Merged into synthesized resolution (${conflict.id}).`;
        }
      }

      recomputeAllGaps(conflict.projectId);
      saveState(s);

      const project = s.projects.find((p) => p.id === conflict.projectId);
      appendAuditLog({
        projectId: conflict.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Resolved conflict ${conflict.id}`,
        category: 'CONFLICT',
        targetId: conflict.id,
        details: `Resolution (${winningSide || 'SYNTHESIZED'}): ${resolutionSummary.trim()} — Note: ${reviewerComment.trim()}`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Handover Composer
  app.post(
    '/api/handovers/generate',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    async (req: AuthenticatedRequest, res) => {
      const {
        projectId,
        departingMemberId,
        incomingMemberId,
        incomingRole,
        includedSourceIds,
        scope,
      } = req.body as {
        projectId?: string;
        departingMemberId?: string;
        incomingMemberId?: string;
        incomingRole?: string;
        includedSourceIds?: string[];
        scope?: string;
      };

      const s = getState();
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const departingUser = s.users.find((u) => u.id === departingMemberId) || req.user!;
      const incomingUser =
        s.users.find((u) => u.id === incomingMemberId) ||
        s.users.find((u) => u.role === 'Incoming Member')!;

      const selectedSourceIds =
        includedSourceIds && includedSourceIds.length > 0
          ? includedSourceIds
          : s.sources.filter((src) => src.projectId === project.id).map((src) => src.id);

      const projectClaims = s.claims.filter(
        (c) =>
          c.projectId === project.id &&
          (!c.sourceId || selectedSourceIds.includes(c.sourceId))
      );

      const generated = await generateHandoverWithAI({
        project,
        departingName: departingUser.name,
        incomingName: incomingUser.name,
        incomingRole: incomingRole?.trim() || incomingUser.title,
        scope:
          scope?.trim() ||
          'Full Technical, Operational, Risk, and Stakeholder Continuity Transition',
        claims: projectClaims,
        conflicts: s.conflicts,
      });

      const existingCount = s.handovers.filter((h) => h.projectId === project.id).length;
      const now = new Date().toISOString();

      const handover: Handover = {
        id: `HND-${String(s.handovers.length + 1).padStart(3, '0')}`,
        projectId: project.id,
        title: `${project.name} — Transition Handover${
          existingCount > 0 ? ` (Package ${existingCount + 1})` : ''
        }`,
        version: 1,
        status: 'DRAFT',
        departingMemberId: departingUser.id,
        departingMemberName: departingUser.name,
        incomingMemberId: incomingUser.id,
        incomingMemberName: incomingUser.name,
        incomingRole: incomingRole?.trim() || incomingUser.title,
        includedSourceIds: selectedSourceIds,
        scope:
          scope?.trim() ||
          'Full Technical, Operational, Risk, and Stakeholder Continuity Transition',
        sections: generated.sections,
        nextActions: generated.nextActions,
        comments: [],
        generatedMode: generated.mode,
        createdBy: req.user!.name,
        createdAt: now,
        updatedAt: now,
      };

      s.handovers.unshift(handover);
      saveState(s);

      appendAuditLog({
        projectId: project.id,
        projectName: project.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Generated Handover ${handover.id} (${generated.mode === 'live_ai' ? 'Live AI' : 'Fallback'})`,
        category: 'HANDOVER',
        targetId: handover.id,
        details: `Prepared for incoming member ${incomingUser.name} across ${selectedSourceIds.length} sources.`,
      });

      res.status(201).json({
        handover,
        workspace: buildWorkspacePayloadForUser(req.user!),
      });
    }
  );

  app.post(
    '/api/handovers/:id/regenerate-section',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    async (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      const { sectionKey } = req.body as { sectionKey?: string };
      const section = handover.sections.find((sec) => sec.key === sectionKey);
      if (!section) {
        res.status(404).json({ error: 'Handover section not found.' });
        return;
      }
      const project = s.projects.find((p) => p.id === handover.projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const projectClaims = s.claims.filter(
        (c) =>
          c.projectId === project.id &&
          (!c.sourceId || handover.includedSourceIds.includes(c.sourceId))
      );

      const regen = await regenerateSingleSectionWithAI({
        project,
        sectionKey: section.key,
        sectionTitle: section.title,
        departingName: handover.departingMemberName,
        incomingName: handover.incomingMemberName,
        incomingRole: handover.incomingRole,
        scope: handover.scope,
        claims: projectClaims,
        conflicts: s.conflicts,
      });

      if (regen.content) {
        section.content = regen.content;
      }
      handover.updatedAt = new Date().toISOString();
      saveState(s);

      appendAuditLog({
        projectId: project.id,
        projectName: project.name,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Regenerated section "${section.title}" on ${handover.id}`,
        category: 'HANDOVER',
        targetId: handover.id,
        details: `Regenerated using ${regen.mode === 'live_ai' ? 'Live Gemini AI' : 'deterministic synthesis'}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.patch(
    '/api/handovers/:id',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      const { title, sections, nextActions } = req.body as Partial<Handover>;
      if (title?.trim()) handover.title = title.trim();
      if (Array.isArray(sections)) handover.sections = sections;
      if (Array.isArray(nextActions)) handover.nextActions = nextActions;
      handover.updatedAt = new Date().toISOString();
      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Edited content/actions in Handover ${handover.id}`,
        category: 'HANDOVER',
        targetId: handover.id,
        details: `Updated handover v${handover.version}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Review & Approval Workflow
  app.post(
    '/api/handovers/:id/submit-review',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      handover.status = 'UNDER_REVIEW';
      handover.updatedAt = new Date().toISOString();
      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Submitted Handover ${handover.id} for Review`,
        category: 'HANDOVER',
        targetId: handover.id,
        details: `Transitioned to UNDER_REVIEW.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.post(
    '/api/handovers/:id/comment',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer', 'Departing Member']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      const { comment, sectionKey } = req.body as { comment?: string; sectionKey?: string };
      if (!comment?.trim()) {
        res.status(400).json({ error: 'Comment text is required.' });
        return;
      }

      const newComment: HandoverComment = {
        id: `CMT-${Date.now().toString().slice(-5)}`,
        authorId: req.user!.id,
        authorName: req.user!.name,
        authorRole: req.user!.role,
        sectionKey,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      };
      handover.comments.push(newComment);
      handover.updatedAt = new Date().toISOString();
      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Added reviewer comment on ${handover.id}`,
        category: 'APPROVAL',
        targetId: handover.id,
        details: comment.trim(),
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.post(
    '/api/handovers/:id/review-decision',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      const { decision, note } = req.body as {
        decision?: 'APPROVED' | 'CHANGES_REQUESTED';
        note?: string;
      };
      if (!decision || !['APPROVED', 'CHANGES_REQUESTED'].includes(decision)) {
        res.status(400).json({ error: 'Decision must be APPROVED or CHANGES_REQUESTED.' });
        return;
      }

      const now = new Date().toISOString();
      handover.status = decision;
      handover.reviewerId = req.user!.id;
      handover.reviewerName = req.user!.name;
      handover.reviewedAt = now;
      handover.reviewerDecisionNote = note?.trim() || '';
      handover.updatedAt = now;
      if (decision === 'CHANGES_REQUESTED') {
        handover.version += 1;
      }

      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action:
          decision === 'APPROVED'
            ? `Approved Handover ${handover.id} (v${handover.version})`
            : `Requested changes / rejected Handover ${handover.id} (v${handover.version})`,
        category: 'APPROVAL',
        targetId: handover.id,
        details: note?.trim() || `Status changed to ${decision}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.post(
    '/api/handovers/:id/share',
    requireAuth,
    requireRoles(['Administrator', 'Project Reviewer']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      if (handover.status !== 'APPROVED') {
        res.status(400).json({
          error: 'Only APPROVED handovers can be shared with incoming members.',
        });
        return;
      }

      const now = new Date().toISOString();
      handover.status = 'SHARED';
      handover.sharedAt = now;
      handover.sharedBy = req.user!.name;
      handover.updatedAt = now;

      s.notifications.unshift({
        id: `NTF-${Date.now().toString().slice(-5)}`,
        projectId: handover.projectId,
        title: `Approved Handover "${handover.title}" Shared`,
        description: `Shared with ${handover.incomingMemberName} for final review and acknowledgement.`,
        targetView: 'shared',
        createdAt: now,
        read: false,
        forRoles: ['Incoming Member', 'Administrator', 'Project Reviewer'],
      });

      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Shared approved Handover ${handover.id} with ${handover.incomingMemberName}`,
        category: 'HANDOVER',
        targetId: handover.id,
        details: `Version ${handover.version} published to Shared Handovers portal.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  app.post(
    '/api/handovers/:id/acknowledge',
    requireAuth,
    requireRoles(['Incoming Member', 'Administrator']),
    (req: AuthenticatedRequest, res) => {
      const s = getState();
      const handover = s.handovers.find((h) => h.id === req.params.id);
      if (!handover) {
        res.status(404).json({ error: 'Handover not found.' });
        return;
      }
      if (handover.status !== 'SHARED') {
        res.status(400).json({
          error: 'Handover must be in SHARED state before acknowledgement.',
        });
        return;
      }
      if (
        req.user!.role === 'Incoming Member' &&
        handover.incomingMemberId !== req.user!.id
      ) {
        const project = s.projects.find((p) => p.id === handover.projectId);
        const isMember = project?.members.some((m) => m.userId === req.user!.id);
        if (!isMember) {
          res.status(403).json({
            error: 'You are not authorized to acknowledge a handover assigned to another member.',
          });
          return;
        }
      }

      const now = new Date().toISOString();
      handover.status = 'ACKNOWLEDGED';
      handover.acknowledgedBy = req.user!.name;
      handover.acknowledgedAt = now;
      handover.updatedAt = now;

      saveState(s);

      const project = s.projects.find((p) => p.id === handover.projectId);
      appendAuditLog({
        projectId: handover.projectId,
        projectName: project?.name || null,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: `Acknowledged receipt of Handover ${handover.id} (v${handover.version})`,
        category: 'ACKNOWLEDGEMENT',
        targetId: handover.id,
        details: `${req.user!.name} confirmed "I HAVE REVIEWED THIS HANDOVER" at ${now}.`,
      });

      res.json(buildWorkspacePayloadForUser(req.user!));
    }
  );

  // Multer error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(400).json({ error: message });
  });

  return app;
}
