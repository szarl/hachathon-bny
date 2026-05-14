<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-02 — Supabase database and storage setup

## **Summary**

Create the Supabase project, run the jobs table migration, create two storage buckets (uploads, outputs), and verify realtime is enabled on the jobs table.

## **Context**

Must be completed before PRD-05 (job creation) and PRD-09 (realtime hook). Can be done in parallel with PRD-01.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| jobs table exists | SELECT \* FROM jobs LIMIT 1 returns 0 rows with no error in the Supabase SQL editor. |
| Row-level security | Three RLS policies exist on jobs: public read (SELECT), public insert (INSERT), public update (UPDATE). |
| uploads bucket | Storage → uploads bucket exists. Public access: off. Max file size: 50MB. |
| outputs bucket | Storage → outputs bucket exists. Public access: on (so signed URLs work without auth). |
| Realtime enabled | Database → Replication → jobs table is toggled ON for INSERT and UPDATE events. |
| Env vars match | NEXT\_PUBLIC\_SUPABASE\_URL and SUPABASE\_SERVICE\_ROLE\_KEY in .env.local match the values in Supabase → Settings → API. |

## **Tasks**

8. Create a new Supabase project in the dashboard

9. Open SQL editor and run the following migration exactly:

Run this SQL migration in the Supabase SQL editor:

create table jobs (

  id          uuid primary key default gen\_random\_uuid(),

  created\_at  timestamptz default now(),

  filename    text not null,

  pdf\_url     text,

  status      text default 'pending',

  topics      jsonb,

  output\_url  text,

  error       text

);

alter table jobs enable row level security;

create policy "public read"   on jobs for select using (true);

create policy "public insert" on jobs for insert with check (true);

create policy "public update" on jobs for update using (true);

10. Create uploads bucket in Storage → New bucket → name: uploads → private

11. Create outputs bucket in Storage → New bucket → name: outputs → public

12. Enable realtime: Database → Replication → toggle jobs table on

13. Copy SUPABASE\_URL and SERVICE\_ROLE\_KEY into .env.local

## **Notes**

| *The status column uses plain text, not an enum, to avoid migration complexity during the hackathon. Valid values are: pending, extracting, classifying, generating, validating, saving, done, error.* |
| :---- |

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- Add `metadata jsonb default '{}'::jsonb` to `jobs` for flexible demo metadata such as file count, topic count, asset count, and validation summary.
- Valid status values now include optional `ocr` in addition to: `pending`, `extracting`, `classifying`, `generating`, `validating`, `saving`, `done`, and `error`.
- Public RLS should allow read-only access for the browser history and realtime UI.
- Do not allow public insert/update. All writes should go through server routes using `SUPABASE_SERVICE_ROLE_KEY`.
- Buckets should be public for hackathon speed:
  - `uploads`: public, 50 MB max
  - `outputs`: public
- Add an idempotent migration file in `supabase/migrations/001_initial_schema.sql`.
- Add Supabase setup notes in `supabase/README.md`, including bucket creation and realtime enablement.


