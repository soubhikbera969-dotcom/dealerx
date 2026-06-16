
-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend handle_new_user to also create the profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  business_name TEXT;
BEGIN
  business_name := NEW.raw_user_meta_data->>'business_name';
  IF business_name IS NULL OR business_name = '' THEN
    business_name := 'My Workspace';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (business_name, NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (new_workspace_id, NEW.id, 'owner', now());

  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (NEW.id, new_workspace_id, 'super_admin');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 2. REBUILD workspace_members_view with profile fields
DROP VIEW IF EXISTS public.workspace_members_view;

CREATE VIEW public.workspace_members_view
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.workspace_id,
  m.user_id,
  m.role,
  m.designation,
  m.invited_at,
  m.joined_at,
  m.created_at,
  p.email,
  p.full_name,
  p.avatar_url,
  CASE
    WHEN public.is_workspace_admin(m.workspace_id) THEN m.salary
    ELSE NULL
  END AS salary,
  CASE
    WHEN public.is_workspace_admin(m.workspace_id) THEN true
    ELSE false
  END AS can_view_salary
FROM public.workspace_members m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE public.is_workspace_member(m.workspace_id);

GRANT SELECT ON public.workspace_members_view TO authenticated;

-- 3. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  color text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_events_workspace_start_idx
  ON public.calendar_events (workspace_id, start_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendar events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can create calendar events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update calendar events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can delete calendar events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
