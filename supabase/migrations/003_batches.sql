-- Batch registry: one row per user batch; jobs reference it for history and grouping.

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.batches enable row level security;

drop policy if exists "public read batches" on public.batches;
create policy "public read batches"
  on public.batches
  for select
  to anon, authenticated
  using (true);

grant select on public.batches to anon, authenticated;
grant all on public.batches to service_role;

alter table public.jobs
  add column if not exists batch_id uuid references public.batches (id) on delete set null;

create index if not exists jobs_batch_id_idx on public.jobs (batch_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'batches'
  ) then
    alter publication supabase_realtime add table public.batches;
  end if;
end
$$;
