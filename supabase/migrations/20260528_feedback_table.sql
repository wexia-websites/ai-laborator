-- Create feedback table for UI bug reports
create table if not exists public.feedback (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users on delete cascade,
  category text,
  comment text not null,
  element_selector text,
  element_html text,
  screenshot text, -- base64 encoded image
  url text,
  user_agent text,
  timestamp timestamp with time zone,
  created_at timestamp with time zone default now(),

  unique(id)
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Policy: Users can insert their own feedback
create policy "Users can insert feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id or auth.uid() is not null);

-- Policy: Users can view their own feedback
create policy "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id or user_id is null);

-- Create index for faster queries
create index if not exists feedback_user_id_idx on public.feedback(user_id);
create index if not exists feedback_created_at_idx on public.feedback(created_at desc);
