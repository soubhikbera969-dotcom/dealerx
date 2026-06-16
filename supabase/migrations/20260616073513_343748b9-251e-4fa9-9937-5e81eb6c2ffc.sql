
-- 1. Remove escalation policy: users can no longer insert themselves directly into any workspace.
-- Joining is handled by SECURITY DEFINER functions accept_workspace_invite / join_workspace_by_token.
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.workspace_members;

-- 2. Hide workspaces.invite_token from regular SELECT; expose via admin-only RPC.
REVOKE SELECT (invite_token) ON public.workspaces FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_workspace_invite_token(_workspace_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_token
  FROM public.workspaces
  WHERE id = _workspace_id
    AND public.is_workspace_admin(_workspace_id)
$$;

CREATE OR REPLACE FUNCTION public.rotate_workspace_invite_token(_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_workspace_admin(_workspace_id) THEN
    RAISE EXCEPTION 'Only admins can rotate the invite link';
  END IF;
  UPDATE public.workspaces SET invite_token = _new WHERE id = _workspace_id;
  RETURN _new;
END;
$$;

-- 3. Hide workspace_members.salary from broad SELECT; the workspace_members_view already masks it for non-admins.
REVOKE SELECT (salary) ON public.workspace_members FROM anon, authenticated;
-- Admins still need to write salary via UPDATE on the table:
GRANT UPDATE (salary) ON public.workspace_members TO authenticated;

-- 4. Lock down EXECUTE on SECURITY DEFINER functions.

-- Trigger-only functions: no role should call them directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_deal_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RLS helpers: callable only by signed-in users (used inside policies).
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

-- Workspace join flows: must be signed in.
REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_workspace_by_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_workspace_by_token(uuid) TO authenticated;

-- Invite preview shown before login on /join/:token — allow anon.
REVOKE EXECUTE ON FUNCTION public.get_workspace_by_invite_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_by_invite_token(uuid) TO anon, authenticated;

-- New admin-only RPCs
REVOKE EXECUTE ON FUNCTION public.get_workspace_invite_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rotate_workspace_invite_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_invite_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_workspace_invite_token(uuid) TO authenticated;
