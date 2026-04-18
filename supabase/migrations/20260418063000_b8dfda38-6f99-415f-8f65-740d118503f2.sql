
-- 1. Extend workspaces table with branding + invite token
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS invite_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_invite_token_key ON public.workspaces(invite_token);

-- 2. Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'employee', 'intern');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Create user_roles table (separate from workspace_members for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Extend workspace_members with designation, salary, timestamps
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS salary numeric,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

-- 5. Create workspace_invites table
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  designation text,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- 6. Security definer functions
CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND workspace_id = _workspace_id
      AND role IN ('super_admin', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_super_admin(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND workspace_id = _workspace_id
      AND role = 'super_admin'
  )
$$;

-- Public function: lookup workspace by invite token (for invite landing page)
CREATE OR REPLACE FUNCTION public.get_workspace_by_invite_token(_token uuid)
RETURNS TABLE(workspace_id uuid, workspace_name text, workspace_logo text, workspace_description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, logo_url, description
  FROM public.workspaces
  WHERE invite_token = _token
  LIMIT 1
$$;

-- Function for accepting an email invite by token
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite record;
  _user_email text;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _invite FROM public.workspace_invites
  WHERE token = _token AND used_at IS NULL AND expires_at > now()
  LIMIT 1;

  IF _invite IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  IF lower(_invite.email) <> lower(_user_email) THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;

  -- Add to workspace_members if not already
  INSERT INTO public.workspace_members (workspace_id, user_id, role, designation, invited_at, joined_at)
  VALUES (_invite.workspace_id, auth.uid(), 'member', _invite.designation, _invite.created_at, now())
  ON CONFLICT DO NOTHING;

  -- Assign role
  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (auth.uid(), _invite.workspace_id, _invite.role)
  ON CONFLICT DO NOTHING;

  -- Mark invite used
  UPDATE public.workspace_invites SET used_at = now() WHERE id = _invite.id;

  RETURN _invite.workspace_id;
END;
$$;

-- Function for joining via the workspace invite_token link (open invite)
CREATE OR REPLACE FUNCTION public.join_workspace_by_token(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _workspace_id FROM public.workspaces WHERE invite_token = _token LIMIT 1;
  IF _workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (_workspace_id, auth.uid(), 'member', now())
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (auth.uid(), _workspace_id, 'employee')
  ON CONFLICT DO NOTHING;

  RETURN _workspace_id;
END;
$$;

-- 7. Backfill: existing workspace owners become super_admin
INSERT INTO public.user_roles (user_id, workspace_id, role)
SELECT owner_id, id, 'super_admin'::public.app_role
FROM public.workspaces
ON CONFLICT DO NOTHING;

-- Set joined_at for existing members where null
UPDATE public.workspace_members SET joined_at = created_at WHERE joined_at IS NULL;

-- 8. Update handle_new_user to also assign super_admin role
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

-- 9. RLS POLICIES

-- user_roles
CREATE POLICY "Members can view roles in their workspace"
  ON public.user_roles FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Super admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_workspace_super_admin(workspace_id));

CREATE POLICY "Super admins can remove roles"
  ON public.user_roles FOR DELETE
  USING (public.is_workspace_super_admin(workspace_id));

-- workspace_invites
CREATE POLICY "Admins can view invites"
  ON public.workspace_invites FOR SELECT
  USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can create invites"
  ON public.workspace_invites FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id) AND invited_by = auth.uid());

CREATE POLICY "Admins can delete invites"
  ON public.workspace_invites FOR DELETE
  USING (public.is_workspace_admin(workspace_id));

-- Update workspaces policies: allow admin updates to branding
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;
CREATE POLICY "Admins can update workspace"
  ON public.workspaces FOR UPDATE
  USING (public.is_workspace_admin(id));

CREATE POLICY "Super admins can delete workspace"
  ON public.workspaces FOR DELETE
  USING (public.is_workspace_super_admin(id));

-- Update workspace_members: allow admins to update designation; restrict salary to admins
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can remove members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_admin(workspace_id) AND user_id <> auth.uid());

-- 10. Storage bucket for workspace logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view workspace logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

CREATE POLICY "Workspace admins can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND auth.uid() IS NOT NULL
    AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Workspace admins can update logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Workspace admins can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
  );

-- 11. View that masks salary for non-admins
CREATE OR REPLACE VIEW public.workspace_members_view
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
  CASE
    WHEN public.is_workspace_admin(m.workspace_id) THEN m.salary
    ELSE NULL
  END AS salary,
  CASE
    WHEN public.is_workspace_admin(m.workspace_id) THEN true
    ELSE false
  END AS can_view_salary
FROM public.workspace_members m
WHERE public.is_workspace_member(m.workspace_id);
