
-- Replace the broad SELECT policy with a no-op that only allows reading specific objects via signed/public URL
DROP POLICY IF EXISTS "Anyone can view workspace logos" ON storage.objects;

-- Logos are still publicly accessible by URL because the bucket is public,
-- but we don't allow listing via the API. Restrict SELECT to workspace members only.
CREATE POLICY "Members can list their workspace logos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workspace-logos'
    AND auth.uid() IS NOT NULL
    AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
