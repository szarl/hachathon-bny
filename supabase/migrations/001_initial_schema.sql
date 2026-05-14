-- PRD-02: Supabase database and storage setup.
-- Idempotent so it can be re-run in the SQL editor during hackathon setup.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  filename text not null,
  pdf_url text,
  status text not null default 'pending',
  topics jsonb,
  output_url text,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.jobs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.jobs enable row level security;

drop policy if exists "public read" on public.jobs;
drop policy if exists "public insert" on public.jobs;
drop policy if exists "public update" on public.jobs;

create policy "public read"
  on public.jobs
  for select
  to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant all on public.jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('uploads', 'uploads', true, 52428800),
  ('outputs', 'outputs', true, null)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime with (publish = 'insert, update');
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end
$$;
