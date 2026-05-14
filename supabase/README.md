# Supabase Setup

PRD-02 creates the shared database and storage foundation for the DITA converter.

## Migration

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.

The migration is idempotent and creates:

- `public.jobs`
- read-only browser RLS policy: `public read`
- public `uploads` bucket with 50 MB file limit
- public `outputs` bucket
- `public.jobs` in the `supabase_realtime` publication

Public clients can read job history and subscribe to realtime changes. Inserts and updates should go through server routes initialized with `SUPABASE_SERVICE_ROLE_KEY`.

## Realtime

After running the migration, verify in the dashboard:

1. Open **Database** -> **Replication**.
2. Confirm `jobs` is enabled for Realtime.
3. Confirm the UI will listen for `INSERT` and `UPDATE` events.

The SQL adds `public.jobs` to the `supabase_realtime` publication. If the dashboard shows per-event toggles, keep only `INSERT` and `UPDATE` enabled for this app.

## Storage

Verify **Storage** has these buckets:

| Bucket | Public | Limit |
| --- | --- | --- |
| `uploads` | Yes | 50 MB |
| `outputs` | Yes | Default |

Storage writes should use the server-side service role key. Public buckets are used here for hackathon speed and straightforward download URLs.

## Environment

Create `.env.local` from `.env.example` and fill these values from **Project Settings** -> **API**:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never prefix the service role key with `NEXT_PUBLIC_`, and never use it in client components.

## Verification Queries

Run these in the SQL editor after setup:

```sql
select * from public.jobs limit 1;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'jobs'
order by policyname;

select id, public, file_size_limit
from storage.buckets
where id in ('uploads', 'outputs')
order by id;

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'jobs';
```
