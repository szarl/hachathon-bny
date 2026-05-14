-- Persist HTML preview URL for job history UI (bulletproof beside metadata JSON).
alter table public.jobs add column if not exists html_preview_url text;
