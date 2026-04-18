import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

interface Props {
  mode: "invite" | "join";
}

interface WorkspacePreview {
  workspace_id: string;
  workspace_name: string;
  workspace_logo: string | null;
  workspace_description: string | null;
}

export default function AcceptInvite({ mode }: Props) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, refreshWorkspace, loading: authLoading } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspacePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Load workspace preview
  useEffect(() => {
    if (!token) return;
    (async () => {
      if (mode === "join") {
        const { data } = await supabase.rpc("get_workspace_by_invite_token", { _token: token });
        if (data && data.length > 0) setWorkspace(data[0] as WorkspacePreview);
      } else {
        // For email invites, fetch via the invite record (anon allowed via security definer would be needed; here we just show generic)
        const { data: invData } = await supabase
          .from("workspace_invites")
          .select("workspace_id, email, workspaces(name, logo_url, description)")
          .eq("token", token)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (invData) {
          const ws = invData.workspaces as unknown as { name: string; logo_url: string | null; description: string | null };
          setWorkspace({
            workspace_id: invData.workspace_id,
            workspace_name: ws?.name || "Workspace",
            workspace_logo: ws?.logo_url || null,
            workspace_description: ws?.description || null,
          });
          setEmail(invData.email);
        }
      }
      setLoadingPreview(false);
    })();
  }, [token, mode]);

  // Auto-accept when authenticated
  useEffect(() => {
    if (!session || !token || accepting || authLoading) return;
    (async () => {
      setAccepting(true);
      const fn = mode === "join" ? "join_workspace_by_token" : "accept_workspace_invite";
      const { error } = await supabase.rpc(fn as any, { _token: token });
      if (error) {
        toast.error(error.message);
        setAccepting(false);
        return;
      }
      toast.success(`Joined ${workspace?.workspace_name || "workspace"}`);
      await refreshWorkspace();
      navigate("/dashboard");
    })();
  }, [session, token, mode, workspace, accepting, authLoading, navigate, refreshWorkspace]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAuth(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, business_name: workspace?.workspace_name || "" },
          emailRedirectTo: window.location.href,
        },
      });
      if (error) toast.error(error.message);
      else toast.success("Account created — joining workspace...");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setSubmittingAuth(false);
  };

  if (loadingPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>This invite link is invalid, expired, or already used.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/login")} className="w-full">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={workspace.workspace_logo || undefined} />
              <AvatarFallback>
                <Building2 className="h-7 w-7" />
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle>Join {workspace.workspace_name}</CardTitle>
          {workspace.workspace_description && (
            <CardDescription>{workspace.workspace_description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {session || accepting ? (
            <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining workspace...
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={mode === "invite"}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submittingAuth}>
                {submittingAuth ? "Please wait..." : authMode === "signup" ? "Sign up & Join" : "Log in & Join"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {authMode === "signup" ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
                >
                  {authMode === "signup" ? "Log in" : "Sign up"}
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
