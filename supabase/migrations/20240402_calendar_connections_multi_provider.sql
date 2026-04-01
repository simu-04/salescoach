-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: support multiple calendar providers per user
--
-- The previous migration had a unique index on (user_id) alone — one calendar
-- per user. This migration allows a user to connect both Google Calendar and
-- Microsoft 365 Calendar simultaneously so Teams + Zoom + Meet are all covered.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old single-user unique index
drop index if exists public.calendar_connections_user_id_key;

-- Add new composite unique index: one connection per (user, provider)
create unique index if not exists calendar_connections_user_provider_key
  on public.calendar_connections (user_id, provider);

-- Ensure the recall_calendar_id index still exists (for webhook lookup)
create index if not exists calendar_connections_recall_id_idx
  on public.calendar_connections (recall_calendar_id);
