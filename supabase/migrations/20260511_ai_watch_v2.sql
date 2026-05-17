-- AI Watch v2 — daily curator with anti-duplicity skip list
-- - drops v1 (clean start) and recreates with topic_keywords + entity_names
-- - ai_watch_runs gains trigger ('manual'|'cron'), filtered_count, status 'no_news'
-- - GIN indexes on keywords/entities for fast skip-list lookups
-- Runtime: OpenAI Responses API + web_search_preview (server-only, service role write)

drop table if exists ai_watch_items cascade;
drop table if exists ai_watch_runs cascade;

create table ai_watch_items (
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
  topic_keywords text[] not null default '{}',
  entity_names text[] not null default '{}',
  image_url text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  archived_at timestamptz,
  user_rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_watch_items_category_check check (category in ('tool', 'breaking', 'hidden_gem', 'infra', 'tip')),
  constraint ai_watch_items_priority_check check (priority in ('high', 'medium', 'low')),
  constraint ai_watch_items_confidence_check check (confidence in ('high', 'medium', 'low')),
  constraint ai_watch_items_user_rating_check check (user_rating is null or user_rating in (-1, 0, 1))
);

create unique index ai_watch_items_source_url_key
  on ai_watch_items (lower(regexp_replace(source_url, '[?#].*$', '')));

create index ai_watch_items_discovered_at_idx on ai_watch_items (discovered_at desc);
create index ai_watch_items_priority_idx       on ai_watch_items (priority);
create index ai_watch_items_category_idx       on ai_watch_items (category);
create index ai_watch_items_tags_idx           on ai_watch_items using gin (tags);
create index ai_watch_items_topic_keywords_idx on ai_watch_items using gin (topic_keywords);
create index ai_watch_items_entity_names_idx   on ai_watch_items using gin (entity_names);

create table ai_watch_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text not null,
  prompt_version text not null,
  source text not null default 'openai_responses_web_search',
  trigger text not null default 'manual',
  candidate_count int not null default 0,
  inserted_count int not null default 0,
  filtered_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  constraint ai_watch_runs_status_check  check (status  in ('running', 'success', 'failed', 'no_news')),
  constraint ai_watch_runs_trigger_check check (trigger in ('manual', 'cron'))
);

create index ai_watch_runs_started_at_idx on ai_watch_runs (started_at desc);

-- RLS: authenticated users can read; writes are server-side only via service role
alter table ai_watch_items enable row level security;
alter table ai_watch_runs  enable row level security;

create policy "ai_watch_items_authenticated_read" on ai_watch_items
  for select to authenticated using (archived_at is null);

create policy "ai_watch_runs_authenticated_read" on ai_watch_runs
  for select to authenticated using (true);

-- service_role bypasses RLS, so no insert/update policies are needed for the cron writer.
