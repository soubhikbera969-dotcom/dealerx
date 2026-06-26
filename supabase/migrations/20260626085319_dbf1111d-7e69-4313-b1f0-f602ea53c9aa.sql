
-- Restrict profiles SELECT to shared workspace members or self
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles of shared workspace members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm_self
      JOIN public.workspace_members wm_other
        ON wm_other.workspace_id = wm_self.workspace_id
      WHERE wm_self.user_id = auth.uid()
        AND wm_other.user_id = public.profiles.id
    )
  );

-- Revoke salary column read on workspace_members table from authenticated role
REVOKE SELECT ON public.workspace_members FROM authenticated;
GRANT SELECT (
  id, workspace_id, user_id, role, designation,
  invited_at, joined_at, created_at
) ON public.workspace_members TO authenticated;
