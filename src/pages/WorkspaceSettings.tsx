import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Copy, Upload, Link as LinkIcon, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function WorkspaceSettings() {
  const { workspaceId, isAdmin, refreshWorkspace } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const inviteUrl = inviteToken ? `${window.location.origin}/join/${inviteToken}` : "";

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("name, description, logo_url")
        .eq("id", workspaceId)
        .single();
      if (data) {
        setName(data.name);
        setDescription(data.description || "");
        setLogoUrl(data.logo_url);
      }
      if (isAdmin) {
        const { data: tok } = await supabase.rpc("get_workspace_invite_token", {
          _workspace_id: workspaceId,
        });
        if (tok) setInviteToken(tok as string);
      }
      setLoading(false);
    })();
  }, [workspaceId, isAdmin]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), description: description.trim() || null })
      .eq("id", workspaceId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace updated");
    refreshWorkspace();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${workspaceId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("workspace-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("workspace-logos").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("workspaces")
      .update({ logo_url: pub.publicUrl })
      .eq("id", workspaceId);
    setUploading(false);
    if (updErr) return toast.error(updErr.message);
    setLogoUrl(pub.publicUrl);
    toast.success("Logo updated");
    refreshWorkspace();
  };

  const handleRotateToken = async () => {
    if (!workspaceId) return;
    if (!confirm("Rotate invite link? The old link will stop working.")) return;
    const { data, error } = await supabase.rpc("rotate_workspace_invite_token", {
      _workspace_id: workspaceId,
    });
    if (error) return toast.error(error.message);
    setInviteToken(data as string);
    toast.success("Invite link rotated");
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your company branding and invite link</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Profile
            </CardTitle>
            <CardDescription>
              {isAdmin ? "Update your company details visible to all members" : "View-only — admin access required to edit"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={logoUrl || undefined} />
                <AvatarFallback className="text-xl">{name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {isAdmin && (
                <div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button asChild variant="outline" disabled={uploading}>
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, max 2MB</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-name">Company Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isAdmin}
                placeholder="What does your company do?"
                rows={3}
              />
            </div>

            {isAdmin && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Open Invite Link
              </CardTitle>
              <CardDescription>
                Anyone with this link can join your workspace as an Employee. Rotate it to revoke access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-xs" />
                <Button onClick={copyInvite} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleRotateToken} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Rotate Link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
