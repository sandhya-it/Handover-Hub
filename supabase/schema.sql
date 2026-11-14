-- Handover Hub — Supabase PostgreSQL Schema & Row-Level Security Policies
-- Execute this SQL in your Supabase SQL Editor when enabling external PostgreSQL persistence.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text unique not null,
  role text not null check (role in ('Administrator', 'Project Reviewer', 'Departing Member', 'Incoming Member')),
  title text not null default '',
  department text not null default '',
  avatar_initials text not null default 'HH',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null,
  lead_user_id text references public.users(id),
  lead_name text not null,
  status text not null check (status in ('Active', 'In Progress', 'Blocked', 'Completed')),
  start_date date not null,
  expected_end_date date not null,
  departing_member_id text references public.users(id),
  incoming_member_id text references public.users(id),
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_sources (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt', 'csv')),
  size_bytes integer not null,
  uploaded_by_user_id text references public.users(id),
  uploaded_by_name text not null,
  uploaded_at timestamptz not null default now(),
  status text not null check (status in ('Queued', 'Extracting', 'Processed', 'Analyzed', 'Error')),
  raw_text text not null,
  chunks jsonb not null default '[]'::jsonb,
  restricted_to_reviewers boolean not null default false
);

create table if not exists public.claims (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  text text not null,
  category text not null,
  source_id text references public.project_sources(id) on delete set null,
  source_filename text,
  source_location text,
  evidence_snippet text,
  confidence numeric(4,2) not null default 0.50,
  verification_status text not null check (verification_status in ('SUPPORTED', 'NEEDS_REVIEW', 'CONFLICT', 'NO_EVIDENCE')),
  is_stale boolean not null default false,
  owner text,
  due_date date,
  task_status text,
  extracted_at timestamptz not null default now(),
  extraction_mode text not null default 'deterministic_fallback',
  reviewer_note text,
  verified_by text,
  verified_at timestamptz
);

create table if not exists public.conflicts (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  claim_a_id text not null,
  statement_a text not null,
  source_a_id text not null,
  source_a_filename text not null,
  source_a_location text not null,
  claim_b_id text not null,
  statement_b text not null,
  source_b_id text not null,
  source_b_filename text not null,
  source_b_location text not null,
  status text not null check (status in ('OPEN', 'RESOLVED')),
  resolution_summary text,
  resolved_by text,
  resolved_at timestamptz,
  reviewer_comment text
);

create table if not exists public.handovers (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  version integer not null default 1,
  status text not null check (status in ('DRAFT', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SHARED', 'ACKNOWLEDGED')),
  departing_member_id text references public.users(id),
  departing_member_name text not null,
  incoming_member_id text references public.users(id),
  incoming_member_name text not null,
  incoming_role text not null,
  included_source_ids jsonb not null default '[]'::jsonb,
  scope text not null,
  sections jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  generated_mode text not null default 'deterministic_fallback',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewer_id text,
  reviewer_name text,
  reviewed_at timestamptz,
  reviewer_decision_note text,
  shared_at timestamptz,
  shared_by text,
  acknowledged_by text,
  acknowledged_at timestamptz
);

create table if not exists public.audit_logs (
  id text primary key,
  project_id text references public.projects(id) on delete set null,
  project_name text,
  user_id text not null,
  user_name text not null,
  user_role text not null,
  action text not null,
  category text not null,
  target_id text,
  details text not null,
  timestamp timestamptz not null default now()
);

-- Optional single-workspace snapshot table used by Handover Hub server sync
create table if not exists public.handover_workspace_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row-Level Security (RLS) across all tables
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_sources enable row level security;
alter table public.claims enable row level security;
alter table public.conflicts enable row level security;
alter table public.handovers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.handover_workspace_snapshots enable row level security;

-- Immutable audit log protection: prevent updates or deletes via SQL policy
create policy "audit_logs_read_only_for_authenticated"
  on public.audit_logs for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "audit_logs_insert_service_role"
  on public.audit_logs for insert
  with check (auth.role() = 'service_role');
