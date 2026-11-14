export type UserRole =
  | 'Administrator'
  | 'Project Reviewer'
  | 'Departing Member'
  | 'Incoming Member';

export type ProjectStatus = 'Active' | 'In Progress' | 'Blocked' | 'Completed';

export type SourceFileType = 'pdf' | 'docx' | 'txt' | 'csv';

export type ProcessingStatus = 'Queued' | 'Extracting' | 'Processed' | 'Analyzed' | 'Error';

export type ClaimCategory =
  | 'Decision'
  | 'Rationale'
  | 'Task'
  | 'Dependency'
  | 'Blocker'
  | 'Risk'
  | 'Open Question'
  | 'Contact'
  | 'Technical'
  | 'Pending Approval';

export type VerificationStatus =
  | 'SUPPORTED'
  | 'NEEDS_REVIEW'
  | 'CONFLICT'
  | 'NO_EVIDENCE';

export type HandoverStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SHARED'
  | 'ACKNOWLEDGED';

export type GapSeverity = 'Critical' | 'High' | 'Medium';

export type GapType =
  | 'CONFLICT'
  | 'MISSING_OWNER'
  | 'MISSING_DEADLINE'
  | 'STALE_STATUS'
  | 'DECISION_NO_RATIONALE'
  | 'UNRESOLVED_BLOCKER'
  | 'MISSING_DEPENDENCY'
  | 'UNSUPPORTED_CLAIM';

export type ProcessingMode = 'live_ai' | 'deterministic_fallback';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  department: string;
  avatarInitials: string;
  active: boolean;
}

export interface ProjectMember {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  projectRole: string;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  leadUserId: string;
  leadName: string;
  status: ProjectStatus;
  startDate: string;
  expectedEndDate: string;
  departingMemberId?: string;
  incomingMemberId?: string;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

export interface SourceChunk {
  location: string; // e.g., "Page 1", "Row 3", "Paragraph 2", "Section 4"
  text: string;
}

export interface ProjectSource {
  id: string;
  projectId: string;
  filename: string;
  fileType: SourceFileType;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  status: ProcessingStatus;
  rawText: string;
  chunks: SourceChunk[];
  restrictedToReviewers?: boolean;
}

export interface Claim {
  id: string;
  projectId: string;
  text: string;
  category: ClaimCategory;
  sourceId: string | null;
  sourceFilename: string | null;
  sourceLocation: string | null;
  evidenceSnippet: string | null;
  confidence: number; // 0 to 1
  verificationStatus: VerificationStatus;
  isStale: boolean;
  owner: string | null;
  dueDate: string | null;
  taskStatus?: 'Completed' | 'In Progress' | 'Blocked' | 'Not Started' | null;
  extractedAt: string;
  extractionMode: ProcessingMode;
  reviewerNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  relatedClaimIds?: string[];
}

export interface ConflictRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: GapSeverity;
  claimAId: string;
  statementA: string;
  sourceAId: string;
  sourceAFilename: string;
  sourceALocation: string;
  claimBId: string;
  statementB: string;
  sourceBId: string;
  sourceBFilename: string;
  sourceBLocation: string;
  status: 'OPEN' | 'RESOLVED';
  resolutionSummary?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  reviewerComment?: string;
}

export interface GapItem {
  id: string;
  projectId: string;
  type: GapType;
  severity: GapSeverity;
  title: string;
  description: string;
  claimId?: string;
  conflictId?: string;
  sourceRef?: string;
  status: 'OPEN' | 'RESOLVED';
}

export interface HandoverActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  priority: 'Immediate' | 'High' | 'Normal';
  claimId?: string;
  completed?: boolean;
}

export interface HandoverSection {
  key: string;
  number: number;
  title: string;
  content: string;
  evidenceRefs: {
    claimId: string;
    label: string;
    verificationStatus: VerificationStatus;
    isStale: boolean;
  }[];
  hasUnverifiedDetails: boolean;
  manualNote?: string;
}

export interface HandoverComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  sectionKey?: string;
  comment: string;
  createdAt: string;
}

export interface Handover {
  id: string;
  projectId: string;
  title: string;
  version: number;
  status: HandoverStatus;
  departingMemberId: string;
  departingMemberName: string;
  incomingMemberId: string;
  incomingMemberName: string;
  incomingRole: string;
  includedSourceIds: string[];
  scope: string;
  sections: HandoverSection[];
  nextActions: HandoverActionItem[];
  comments: HandoverComment[];
  generatedMode: ProcessingMode;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewerDecisionNote?: string;
  sharedAt?: string;
  sharedBy?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  category:
    | 'PROJECT'
    | 'SOURCE'
    | 'EXTRACTION'
    | 'CLAIM'
    | 'CONFLICT'
    | 'HANDOVER'
    | 'APPROVAL'
    | 'ACKNOWLEDGEMENT'
    | 'PERMISSION'
    | 'AUTH';
  targetId?: string;
  details: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  projectId: string | null;
  title: string;
  description: string;
  targetView: string;
  createdAt: string;
  read: boolean;
  forRoles: UserRole[];
}

export interface RuntimeCapabilities {
  geminiConfigured: boolean;
  supabaseConfigured: boolean;
  storageMode: 'supabase' | 'local_demo';
  aiModel: string;
}

export interface WorkspacePayload {
  currentUser: User;
  users: User[];
  projects: Project[];
  sources: ProjectSource[];
  claims: Claim[];
  conflicts: ConflictRecord[];
  gaps: GapItem[];
  handovers: Handover[];
  auditLogs: AuditLogEntry[];
  notifications: NotificationItem[];
  capabilities: RuntimeCapabilities;
}
