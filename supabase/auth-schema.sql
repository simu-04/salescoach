-- ─────────────────────────────────────────────────────────────────────────────
-- Auth Schema — Organizations, Profiles, RLS, Triggers
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  slug         text        NOT NULL UNIQUE,
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- ─── Profiles (extends auth.users 1:1) ────────────────────────────────────────
-- role: 'admin' | 'rep' | 'pending' (pending = signed up, not yet approved)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  org_id       uuid        REFERENCES public.organizations(id) ON DELETE SET NULL,
  role         text        NOT NULL DEFAULT 'pending' CHECK (role IN ('admin', 'rep', 'pending')),
  full_name    text,
  avatar_url   text,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles(role);

-- ─── Update calls table: add user_id + org_id ─────────────────────────────────
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS user_id  uuid REFERENCES auth.users(id)          ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rep_name text; -- display name of the rep who uploaded

CREATE INDEX IF NOT EXISTS idx_calls_user_id ON public.calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id  ON public.calls(org_id);

-- ─── updated_at trigger for profiles ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

-- ─── Auto-create profile on auth.users insert ─────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights      ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get current user's org_id ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Helper: get current user's role ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Organizations RLS ────────────────────────────────────────────────────────
-- Users can view their own org
DROP POLICY IF EXISTS "org_select_own" ON public.organizations;
CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT USING (id = get_my_org_id());

-- ─── Profiles RLS ─────────────────────────────────────────────────────────────
-- Anyone can view profiles in their org
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles
  FOR SELECT USING (org_id = get_my_org_id() OR id = auth.uid());

-- Users can insert their own profile
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile; admins can update anyone in their org
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (get_my_role() = 'admin' AND org_id = get_my_org_id())
  );

-- ─── Calls RLS ────────────────────────────────────────────────────────────────
-- Admins: full access to all calls in their org
DROP POLICY IF EXISTS "calls_admin_all" ON public.calls;
CREATE POLICY "calls_admin_all" ON public.calls
  FOR ALL USING (
    get_my_role() = 'admin' AND org_id = get_my_org_id()
  );

-- Reps: read their own calls
DROP POLICY IF EXISTS "calls_rep_select_own" ON public.calls;
CREATE POLICY "calls_rep_select_own" ON public.calls
  FOR SELECT USING (
    get_my_role() = 'rep' AND user_id = auth.uid()
  );

-- Reps: insert their own calls
DROP POLICY IF EXISTS "calls_rep_insert_own" ON public.calls;
CREATE POLICY "calls_rep_insert_own" ON public.calls
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND org_id = get_my_org_id()
  );

-- Reps: delete their own calls
DROP POLICY IF EXISTS "calls_rep_delete_own" ON public.calls;
CREATE POLICY "calls_rep_delete_own" ON public.calls
  FOR DELETE USING (
    get_my_role() = 'rep' AND user_id = auth.uid()
  );

-- ─── Insights RLS ─────────────────────────────────────────────────────────────
-- Users see insights for calls they can access
DROP POLICY IF EXISTS "insights_select_via_calls" ON public.insights;
CREATE POLICY "insights_select_via_calls" ON public.insights
  FOR SELECT USING (
    call_id IN (SELECT id FROM public.calls)
  );

DROP POLICY IF EXISTS "insights_insert_service" ON public.insights;
CREATE POLICY "insights_insert_service" ON public.insights
  FOR INSERT WITH CHECK (true); -- Service role bypasses this anyway

-- ─── Schema cache reload ───────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
