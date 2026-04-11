import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
}

const ACTION_ICONS: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  created: "text-emerald-500",
  updated: "text-primary",
  deleted: "text-destructive",
};

export function DealHistoryDialog({
  dealId,
  dealTitle,
  open,
  onOpenChange,
}: {
  dealId: string;
  dealTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !dealId) return;
    setLoading(true);
    supabase
      .from("deal_audit_log")
      .select("id, action, changes, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLogs((data as AuditLog[]) || []);
        setLoading(false);
      });
  }, [open, dealId]);

  const getChangeSummary = (log: AuditLog) => {
    if (log.action === "created") return "Deal was created";
    if (log.action === "deleted") return "Deal was deleted";
    const changes = log.changes as { old?: Record<string, unknown>; new?: Record<string, unknown> };
    if (!changes.old || !changes.new) return "Deal was modified";
    const diffs: string[] = [];
    const skip = new Set(["updated_at", "created_at", "id", "workspace_id"]);
    for (const key of Object.keys(changes.new)) {
      if (skip.has(key)) continue;
      if (JSON.stringify(changes.old[key]) !== JSON.stringify(changes.new[key])) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        diffs.push(`${label}: ${String(changes.old[key] ?? "—")} → ${String(changes.new[key] ?? "—")}`);
      }
    }
    return diffs.length ? diffs.join("\n") : "No visible changes";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> History — {dealTitle}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history found.</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const Icon = ACTION_ICONS[log.action] || Pencil;
                const color = ACTION_COLORS[log.action] || "text-muted-foreground";
                return (
                  <div key={log.id} className="flex gap-3 items-start">
                    <div className={`mt-0.5 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground capitalize">{log.action}</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-line mt-0.5">
                        {getChangeSummary(log)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
