-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: calendar_connections
--
-- Stores Recall.ai calendar connections per user.
-- When a Recall webhook fires, we look up the bot's calendar_user.id
-- here to find which org/user the meeting belongs to.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.calendar_connections (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references public.profiles(id) on delete cascade,
  org_id             uuid        not null references public.organizations(id) on delete cascade,
  recall_calendar_id text        not null unique,   -- Recall calendar user ID (e.g. "cal_user_abc")
  provider           text        not null default 'google',
  connected_at       timestamptz not null default now()
);

-- One calendar connection per user (enforced by upsert onConflict)
create unique index if not exists calendar_connections_user_id_key
  on public.calendar_connections (user_id);

-- Fast lookup by recall_calendar_id (used in webhook handler)
create index if not exists calendar_connections_recall_id_idx
  on public.calendar_connections (recall_calendar_id);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table public.calendar_connections enable row level security;

-- Users can read their own connection
create policy "Users can view own calendar connection"
  on public.calendar_connections for select
  using (auth.uid() = user_id);

-- Users can insert their own connection (API routes use service role for writes)
create policy "Users can insert own calendar connection"
  on public.calendar_connections for insert
  with check (auth.uid() = user_id);

-- Users can delete their own connection
create policy "Users can delete own calendar connection"
  on public.calendar_connections for delete
  using (auth.uid() = user_id);

-- Admins can view all connections in their org
create policy "Admins can view org calendar connections"
  on public.calendar_connections for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.org_id = calendar_connections.org_id
        and profiles.role = 'admin'
    )
  );
