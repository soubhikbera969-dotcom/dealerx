
DROP POLICY "System can insert audit logs" ON public.deal_audit_log;

CREATE POLICY "Authenticated trigger can insert audit logs"
  ON public.deal_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));
