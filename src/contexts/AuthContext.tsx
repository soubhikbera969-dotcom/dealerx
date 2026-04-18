import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceLogo: string | null;
  role: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  workspaceId: null,
  workspaceName: null,
  workspaceLogo: null,
  role: null,
  isAdmin: false,
  isSuperAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshWorkspace: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  employee: 2,
  intern: 1,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = useCallback(async (userId: string) => {
    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name, logo_url)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!memberData) return;
    setWorkspaceId(memberData.workspace_id);
    const ws = memberData.workspaces as unknown as { id: string; name: string; logo_url: string | null };
    setWorkspaceName(ws?.name || null);
    setWorkspaceLogo(ws?.logo_url || null);

    // Fetch highest role for this user in this workspace
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("workspace_id", memberData.workspace_id);

    if (roles && roles.length > 0) {
      const top = roles
        .map((r) => r.role as AppRole)
        .sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
      setRole(top);
    } else {
      setRole(null);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (user) await fetchWorkspace(user.id);
  }, [user, fetchWorkspace]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchWorkspace(session.user.id), 0);
        } else {
          setWorkspaceId(null);
          setWorkspaceName(null);
          setWorkspaceLogo(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchWorkspace(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchWorkspace]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === "super_admin" || role === "admin";
  const isSuperAdmin = role === "super_admin";

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        workspaceId,
        workspaceName,
        workspaceLogo,
        role,
        isAdmin,
        isSuperAdmin,
        loading,
        signOut,
        refreshWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
