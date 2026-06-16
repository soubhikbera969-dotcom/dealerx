import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, UserPlus, Copy, Trash2, Lock } from "lucide-react";

const ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: "super_admin", label: "Super Admin", color: "bg-primary/15 text-primary" },
  { value: "admin", label: "Admin", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "manager", label: "Manager", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { value: "employee", label: "Employee", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "intern", label: "Intern", color: "bg-muted text-muted-foreground" },
];

interface Member {
  id: string;
  user_id: string;
  designation: string | null;
  salary: number | null;
  can_view_salary: boolean;
  joined_at: string;
  role: AppRole | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: AppRole;
  designation: string | null;
  expires_at: string;
  token: string;
}

export default function Members() {
  const { workspaceId, isAdmin, isSuperAdmin, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("employee");
  const [inviteDesignation, setInviteDesignation] = useState("");
  const [sending, setSending] = useState(false);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);

    const { data: memberRows } = await supabase
      .from("workspace_members_view")
      .select("*")
      .eq("workspace_id", workspaceId);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    const roleMap = new Map<string, AppRole>();
    (roleRows || []).forEach((r) => {
      const existing = roleMap.get(r.user_id);
      const rank: Record<AppRole, number> = { super_admin: 5, admin: 4, manager: 3, employee: 2, intern: 1 };
      if (!existing || rank[r.role as AppRole] > rank[existing]) {
        roleMap.set(r.user_id, r.role as AppRole);
      }
    });

    const enriched: Member[] = (memberRows || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      designation: m.designation,
      salary: m.salary,
      can_view_salary: m.can_view_salary,
      joined_at: m.joined_at,
      role: roleMap.get(m.user_id) || null,
      email: m.email ?? null,
      full_name: m.full_name ?? null,
      avatar_url: m.avatar_url ?? null,
    }));

    setMembers(enriched);

    if (isAdmin) {
      const { data: inv } = await supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      setInvites((inv || []) as any);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, isAdmin]);

  const handleInvite = async () => {
    if (!workspaceId || !user) return;
    if (!inviteEmail.trim()) return toast.error("Email required");

    setSending(true);
    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        designation: inviteDesignation.trim() || null,
        invited_by: user.id,
      })
      .select("token")
      .single();
    setSending(false);

    if (error) {
      if (error.code === "23505") return toast.error("This email already has a pending invite");
      return toast.error(error.message);
    }

    const link = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite created — link copied to clipboard");
    setInviteEmail("");
    setInviteDesignation("");
    setInviteRole("employee");
    setInviteOpen(false);
    loadData();
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success("Invite link copied");
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    loadData();
  };

  const changeRole = async (memberUserId: string, newRole: AppRole) => {
    if (!workspaceId) return;
    // Remove existing roles for this user in this workspace, then assign new
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberUserId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ workspace_id: workspaceId, user_id: memberUserId, role: newRole });
    if (insErr) return toast.error(insErr.message);
    toast.success("Role updated");
    loadData();
  };

  const updateMemberField = async (memberId: string, field: "designation" | "salary", value: string) => {
    const payload =
      field === "salary"
        ? { salary: value === "" ? null : Number(value) }
        : { designation: value || null };
    const { error } = await supabase.from("workspace_members").update(payload as never).eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    loadData();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    loadData();
  };

  const roleBadge = (r: AppRole | null) => {
    const found = ROLES.find((x) => x.value === r);
    if (!found) return <Badge variant="outline">No role</Badge>;
    return <Badge className={found.color + " border-0"}>{found.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Members</h1>
            <p className="text-muted-foreground mt-1">Manage roles, designations, and invites</p>
          </div>
          {isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a new member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => isSuperAdmin || r.value !== "super_admin").map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Designation (optional)</Label>
                    <Input
                      value={inviteDesignation}
                      onChange={(e) => setInviteDesignation(e.target.value)}
                      placeholder="e.g. Senior Developer, Sales Head"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A unique invite link will be generated. Share it with them — it expires in 7 days.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={handleInvite} disabled={sending}>
                    {sending ? "Creating..." : "Create Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground py-8 text-center">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Joined</TableHead>
                    {isAdmin && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.user_id === user?.id ? "You" : m.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {isAdmin && m.user_id !== user?.id && (m.role !== "super_admin" || isSuperAdmin) ? (
                          <Select
                            value={m.role || "employee"}
                            onValueChange={(v) => changeRole(m.user_id, v as AppRole)}
                          >
                            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.filter((r) => isSuperAdmin || r.value !== "super_admin").map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          roleBadge(m.role)
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Input
                            defaultValue={m.designation || ""}
                            placeholder="—"
                            className="h-8 max-w-[180px]"
                            onBlur={(e) => {
                              if (e.target.value !== (m.designation || "")) {
                                updateMemberField(m.id, "designation", e.target.value);
                              }
                            }}
                          />
                        ) : (
                          m.designation || <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.can_view_salary ? (
                          isAdmin ? (
                            <Input
                              type="number"
                              defaultValue={m.salary ?? ""}
                              placeholder="—"
                              className="h-8 max-w-[120px]"
                              onBlur={(e) => {
                                if (e.target.value !== String(m.salary ?? "")) {
                                  updateMemberField(m.id, "salary", e.target.value);
                                }
                              }}
                            />
                          ) : m.salary ? (
                            `$${m.salary.toLocaleString()}`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Hidden
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {m.user_id !== user?.id && (m.role !== "super_admin" || isSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMember(m.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isAdmin && invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invites ({invites.length})</CardTitle>
              <CardDescription>Invites that haven't been accepted yet</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>{roleBadge(inv.role)}</TableCell>
                      <TableCell>{inv.designation || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyInviteLink(inv.token)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeInvite(inv.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
