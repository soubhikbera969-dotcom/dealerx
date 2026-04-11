
-- Create deal audit log table
CREATE TABLE public.deal_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  changed_by UUID,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

-- Members can view audit logs for their workspace
CREATE POLICY "Members can view deal audit logs"
  ON public.deal_audit_log
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Allow inserts from trigger (runs as SECURITY DEFINER)
CREATE POLICY "System can insert audit logs"
  ON public.deal_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_deal_audit_log_deal_id ON public.deal_audit_log(deal_id);
CREATE INDEX idx_deal_audit_log_workspace_id ON public.deal_audit_log(workspace_id);
CREATE INDEX idx_deal_audit_log_created_at ON public.deal_audit_log(created_at);

-- Trigger function to auto-log deal changes
CREATE OR REPLACE FUNCTION public.log_deal_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_audit_log (deal_id, workspace_id, changed_by, action, changes)
    VALUES (NEW.id, NEW.workspace_id, auth.uid(), 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.deal_audit_log (deal_id, workspace_id, changed_by, action, changes)
    VALUES (NEW.id, NEW.workspace_id, auth.uid(), 'updated', jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.deal_audit_log (deal_id, workspace_id, changed_by, action, changes)
    VALUES (OLD.id, OLD.workspace_id, auth.uid(), 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

-- Attach trigger to deals table
CREATE TRIGGER deal_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_changes();
