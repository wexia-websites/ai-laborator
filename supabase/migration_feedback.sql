-- Tabulka pro feedback / nahlášení chyb z FeedbackWidget
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text default null,
  category text not null default 'bug',
  comment text not null default '',
  element_selector text default '',
  element_html text default '',
  screenshot_url text default null,
  url text default '',
  user_agent text default '',
  timestamp timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS: přihlášení uživatelé mohou vkládat, číst jen admini
alter table public.feedback enable row level security;

create policy "Authenticated users can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (true);

create policy "Service role can read all feedback"
  on public.feedback for select
  to service_role
  using (true);
