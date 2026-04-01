-- ─────────────────────────────────────────────────────────────────────────────
-- Sales Intelligence MVP — Supabase Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Calls ───────────────────────────────────────────────────────────────────
-- One row per uploaded call recording.
-- Status drives the UI: processing → complete | failed
-- Verdict/summary are denormalized here for fast dashboard queries (no JOIN needed)

create table if not exists calls (
  id                uuid    default gen_random_uuid() primary key,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,

  -- File metadata
  file_name         text    not null,
  file_url          text,                         -- public URL (if bucket is public)
  storage_path      text,                         -- Supabase Storage path
  file_size         bigint,                       -- bytes
  duration_seconds  integer,                      -- filled after Deepgram response

  -- Processing state
  status            text    default 'processing' not null
                    check (status in ('processing', 'complete', 'failed')),
  error_message     text,

  -- Denormalized insight summary (filled when status → complete)
  verdict           text    check (verdict in ('won', 'at_risk', 'lost')),
  verdict_reason    text,
  summary           text
);

-- ─── Insights ─────────────────────────────────────────────────────────────────
-- Full analysis output per call. JSONB fields allow schema evolution without migrations.

create table if not exists insights (
  id                    uuid    default gen_random_uuid() primary key,
  call_id               uuid    references calls(id) on delete cascade not null,
  created_at            timestamptz default now() not null,

  -- Raw transcript from Deepgram (speaker-labeled)
  transcript            text,

  -- Claude analysis output
  summary               text    not null,
  verdict               text    not null check (verdict in ('won', 'at_risk', 'lost')),
  verdict_reason        text    not null,
  objections            jsonb   default '[]'::jsonb not null,
  risk_signals          jsonb   default '[]'::jsonb not null,
  competitor_mentions   jsonb   default '[]'::jsonb not null,
  talk_ratio            jsonb   default '{"rep": 50, "prospect": 50}'::jsonb not null,
  top_recommendation    text    not null
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Optimized for the two main query patterns: dashboard list + call detail

create index if not exists calls_status_idx        on calls(status);
create index if not exists calls_created_at_idx    on calls(created_at desc);
create index if not exists calls_verdict_idx       on calls(verdict);
create index if not exists insights_call_id_idx    on insights(call_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists calls_updated_at on calls;
create trigger calls_updated_at
  before update on calls
  for each row execute function update_updated_at_column();

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- MVP: disable RLS (service role key used server-side, no public access)
-- Production: add org-based RLS once auth is in place

alter table calls   disable row level security;
alter table insights disable row level security;

-- ─── Storage Bucket Setup ─────────────────────────────────────────────────────
-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- OR uncomment and run here if your Supabase plan supports it:
--
-- insert into storage.buckets (id, name, file_size_limit, allowed_mime_types)
-- values (
--   'call-recordings',
--   'call-recordings',
--   104857600,  -- 100MB max per file
--   array['audio/mpeg', 'audio/mp4', 'audio/mp3', 'audio/wav',
--         'audio/webm', 'audio/ogg', 'video/mp4']
-- )
-- on conflict (id) do nothing;
