import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, GripVertical } from "lucide-react";
import type { Tables, Database } from "@/integrations/supabase/types";

type Deal = Tables<"deals">;
type Contact = Tables<"contacts">;
type DealStatus = Database["public"]["Enums"]["deal_status"];

const COLUMNS: { status: DealStatus; label: string; color: string }[] = [
  { status: "lead", label: "Lead", color: "bg-accent/20 border-accent/30" },
  { status: "in_progress", label: "In Progress", color: "bg-primary/10 border-primary/30" },
  { status: "completed", label: "Completed", color: "bg-emerald-500/10 border-emerald-500/30" },
  { status: "payment_done", label: "Payment Done", color: "bg-primary/10 border-primary/30" },
];

export default function Deals() {
  const { workspaceId } = useAuth();
  const { formatValue, currency } = useCurrency();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", contact_id: "", value: "", status: "lead" as DealStatus });
  const [dragDeal, setDragDeal] = useState<Deal | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    const [dealsRes, contactsRes] = await Promise.all([
      supabase.from("deals").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").eq("workspace_id", workspaceId),
    ]);
    setDeals(dealsRes.data || []);
    setContacts(contactsRes.data || []);
  }, [workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!workspaceId || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const { error } = await supabase.from("deals").insert({
      title: form.title,
      workspace_id: workspaceId,
      contact_id: form.contact_id || null,
      value: form.value ? parseFloat(form.value) : null,
      status: form.status,
    });
    if (error) toast.error(error.message);
    else { toast.success("Deal created"); setDialogOpen(false); fetchData(); }
  };

  const handleDrop = async (status: DealStatus) => {
    if (!dragDeal || dragDeal.status === status) return;
    const { error } = await supabase.from("deals").update({ status }).eq("id", dragDeal.id);
    if (error) toast.error(error.message);
    else {
      setDeals((prev) => prev.map((d) => (d.id === dragDeal.id ? { ...d, status } : d)));
      toast.success(`Moved to ${COLUMNS.find((c) => c.status === status)?.label}`);
    }
    setDragDeal(null);
  };

  const getContactName = (id: string | null) => {
    if (!id) return null;
    return contacts.find((c) => c.id === id)?.name || null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Deal Pipeline</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> New Deal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div>
                  <Label>Contact</Label>
                  <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value ({currency})</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DealStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((col) => (
                        <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate}>Create Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              className={`rounded-xl border-2 border-dashed p-4 min-h-[300px] transition-colors ${col.color} ${dragDeal ? "border-primary/50" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.status)}
            >
              <h3 className="font-semibold text-sm text-foreground mb-3 uppercase tracking-wider">
                {col.label}
                <span className="ml-2 text-muted-foreground">
                  ({deals.filter((d) => d.status === col.status).length})
                </span>
              </h3>
              <div className="space-y-2">
                {deals
                  .filter((d) => d.status === col.status)
                  .map((deal) => (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragDeal(deal)}
                      onDragEnd={() => setDragDeal(null)}
                      className="cursor-grab active:cursor-grabbing glass-card hover:shadow-lg transition-all hover:-translate-y-0.5"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{deal.title}</p>
                            {getContactName(deal.contact_id) && (
                              <p className="text-xs text-muted-foreground mt-1">{getContactName(deal.contact_id)}</p>
                            )}
                            {deal.value && (
                              <p className="text-xs font-semibold text-primary mt-1">{formatValue(Number(deal.value))}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
