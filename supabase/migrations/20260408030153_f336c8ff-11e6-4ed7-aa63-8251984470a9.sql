
-- Create deal status enum
CREATE TYPE public.deal_status AS ENUM ('lead', 'in_progress', 'completed', 'payment_done');

-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workspace_members table
CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status deal_status NOT NULL DEFAULT 'lead',
  value NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;

-- Workspaces policies
CREATE POLICY "Users can view their workspaces" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id));

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = owner_id);

-- Workspace members policies
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can insert themselves as members" ON public.workspace_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Contacts policies
CREATE POLICY "Members can view workspace contacts" ON public.contacts
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create contacts" ON public.contacts
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update contacts" ON public.contacts
  FOR UPDATE USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete contacts" ON public.contacts
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Deals policies
CREATE POLICY "Members can view workspace deals" ON public.deals
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create deals" ON public.deals
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update deals" ON public.deals
  FOR UPDATE USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete deals" ON public.deals
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Auto-create workspace and membership on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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
  
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
