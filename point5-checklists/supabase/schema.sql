-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  location      text,
  manager_name  text,
  manager_email text,
  access_key    text not null default replace(gen_random_uuid()::text, '-', ''),
  template      jsonb not null default '{"sections":[]}',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists weeks (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  week_start        date not null,                 -- the Sunday that starts the week
  template_snapshot jsonb not null default '{"sections":[]}',
  progress          jsonb not null default '{}',   -- { items: { <item id>: {done, value, note, flag} }, notes }
  status            text not null default 'open',  -- open | submitted
  submitted_at      timestamptz,
  -- AI summary
  summary           text,
  headline          text,
  rating            text,                          -- green | yellow | red
  flags             jsonb,
  wins              jsonb,
  summarized_at     timestamptz,
  -- email bookkeeping
  checklist_sent_at timestamptz,
  reminder_sent_at  timestamptz,
  updated_at        timestamptz not null default now(),
  unique (business_id, week_start)
);

create index if not exists weeks_week_start_idx on weeks (week_start);

-- Lock the tables down: only the service key (used by the Netlify functions) can read or write.
alter table businesses enable row level security;
alter table weeks enable row level security;
