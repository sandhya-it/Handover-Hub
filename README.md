# HANDOVER HUB

**Tagline:** *"Never Lose Knowledge. Ensure Every Transition Continues."*

**Team:** AetherGrid  
**Team Lead:** Sandhya S  
**Team Members:** Monishwaran B, Pooja Ravi, Pooja G

---

## Overview

Handover Hub is an evidence-first AI-powered knowledge continuity platform that transforms scattered project documents (PDF, DOCX, TXT, CSV) into a structured, verified, role-specific handover package.

Every important extracted statement links directly back to its original document and exact coordinate (`Page`, `Row`, `Paragraph`, or `Section`), or is explicitly marked `NO_EVIDENCE` / `NEEDS_REVIEW` / `CONFLICT` / `STALE`. AI output never becomes an approved fact without human review.

---

## Demo Account Credentials

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | Sandhya S | `admin@handoverhub.dev` | `Admin@2026` |
| **Project Reviewer** | Monishwaran B | `reviewer@handoverhub.dev` | `Review@2026` |
| **Departing Member** | Pooja Ravi | `departing@handoverhub.dev` | `Depart@2026` |
| **Incoming Member** | Pooja G | `incoming@handoverhub.dev` | `Receive@2026` |

---

## Local Setup & Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (optional for Demo Mode; required for Live Gemini AI or external Supabase):
   ```bash
   cp .env.example .env
   ```
   - `GEMINI_API_KEY`: Enables live Gemini AI document extraction & handover synthesis (`gemini-4-hydrogen`). Without it, the app uses deterministic document parsing & extraction and labels outputs clearly as deterministic fallback.
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Enables external Supabase PostgreSQL snapshot sync alongside `supabase/schema.sql`. Without them, the app uses local persistent demo storage.
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## Supabase SQL Setup

1. Create a new Supabase project.
2. Open the **SQL Editor** and run `supabase/schema.sql`.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your `.env` or Vercel Environment Variables.

---

## Vercel Deployment

The repository includes `vercel.json` and `/api/index.ts`:
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- All `/api/*` routes route to `/api/index.ts`, and SPA routes fall back to `/index.html`.
- Deploy via `vercel` CLI or GitHub integration and configure `GEMINI_API_KEY` (and optional `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SESSION_SECRET`) in Vercel Project Settings -> Environment Variables.

---

## Judge Demonstration Walkthrough

1. Sign in as **Project Reviewer** (`reviewer@handoverhub.dev` / `Review@2026` or one-click card).
2. Confirm **Smart Campus Management System** is selected in the top project selector.
3. Open **Source Connect** to inspect the 5 uploaded documents (`PDF`, `CSV`, `TXT`, `DOCX`) or upload new files.
4. Click **Run Document Analysis** to process documents with Gemini AI (or deterministic fallback).
5. Open **Project Memory Map** to explore interactive connected nodes across Decisions, Tasks, Blockers, Risks, Owners, and Sources.
6. Open **Evidence Ledger**, select any claim, and click **"WHY SHOULD I TRUST THIS?"** to highlight the exact verbatim passage in the source document.
7. Open **Gap & Conflict Detector** and resolve a seeded cross-document conflict (`CONF-001` or `CONF-002`) with a reviewer decision comment.
8. Open **Handover Composer** to review/edit the 13 structured sections, regenerate a section, export PDF, or submit for review.
9. Open **Review & Approval**, approve the handover, and click **Share with Incoming Member**.
10. Switch to **Incoming Member** (`incoming@handoverhub.dev` / `Receive@2026`) via the top-right profile menu, open **Shared Handovers**, review assigned next actions, and click **"I HAVE REVIEWED THIS HANDOVER"**.
11. Inspect **Audit History** to verify every action is chronologically recorded and immutable.
