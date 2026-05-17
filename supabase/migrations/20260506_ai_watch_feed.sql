-- AI Watch / AI News feed
-- Import this in Supabase after local MVP verification.
-- Runtime source: OpenAI Responses API with web_search_preview, not Hermes/Discord.

create table if not exists ai_watch_items (
  id text primary key,
  title text not null,
  source_url text not null,
  source_domain text not null,
  source_type text not null default 'openai_web_search',
  category text not null default 'tool',
  summary text not null,
  why_it_matters text not null default 'neuvedeno',
  api_integrations text not null default 'neuvedeno',
  pricing_license text not null default 'neuvedeno',
  priority text not null default 'medium',
  confidence text not null default 'medium',
  tags text[] not null default '{}',
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_watch_items_category_check check (category in ('tool', 'breaking', 'hidden_gem', 'infra', 'tip')),
  constraint ai_watch_items_priority_check check (priority in ('high', 'medium', 'low')),
  constraint ai_watch_items_confidence_check check (confidence in ('high', 'medium', 'low'))
);

create unique index if not exists ai_watch_items_source_url_key
  on ai_watch_items (lower(regexp_replace(source_url, '[?#].*$', '')));

create index if not exists ai_watch_items_discovered_at_idx on ai_watch_items (discovered_at desc);
create index if not exists ai_watch_items_priority_idx on ai_watch_items (priority);
create index if not exists ai_watch_items_category_idx on ai_watch_items (category);
create index if not exists ai_watch_items_tags_idx on ai_watch_items using gin (tags);

create table if not exists ai_watch_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text not null,
  prompt_version text not null,
  source text not null default 'openai_responses_web_search',
  candidate_count int not null default 0,
  inserted_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  constraint ai_watch_runs_status_check check (status in ('running', 'success', 'failed'))
);

alter table ai_watch_items enable row level security;
alter table ai_watch_runs enable row level security;

create policy "read ai_watch_items" on ai_watch_items for select to authenticated using (true);
create policy "insert ai_watch_items" on ai_watch_items for insert to authenticated with check (true);
create policy "update ai_watch_items" on ai_watch_items for update to authenticated using (true);

create policy "read ai_watch_runs" on ai_watch_runs for select to authenticated using (true);
create policy "insert ai_watch_runs" on ai_watch_runs for insert to authenticated with check (true);
create policy "update ai_watch_runs" on ai_watch_runs for update to authenticated using (true);
