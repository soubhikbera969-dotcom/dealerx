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
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, GripVertical, MoreVertical, Pencil, Trash2, History } from "lucide-react";
import { format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { DealHistoryDialog } from "@/components/DealHistoryDialog";
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
  const { formatValue, currency, symbol, toUSD, rates } = useCurrency();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", contact_id: "", value: "", status: "lead" as DealStatus });
  const [dragDeal, setDragDeal] = useState<Deal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Deal | null>(null);
  const [historyDeal, setHistoryDeal] = useState<Deal | null>(null);
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

  const resetForm = () => setForm({ title: "", contact_id: "", value: "", status: "lead" });

  const handleCreate = async () => {
    if (!workspaceId || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const { error } = await supabase.from("deals").insert({
      title: form.title,
      workspace_id: workspaceId,
      contact_id: form.contact_id || null,
      value: form.value ? toUSD(parseFloat(form.value)) : null,
      status: form.status,
    });
    if (error) toast.error(error.message);
    else { toast.success("Deal created"); setDialogOpen(false); resetForm(); fetchData(); }
  };

  const openEdit = (deal: Deal) => {
    const localValue = deal.value ? String(Math.round(Number(deal.value) * rates[currency] * 100) / 100) : "";
    setEditDeal(deal);
    setForm({
      title: deal.title,
      contact_id: deal.contact_id || "",
      value: localValue,
      status: deal.status,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editDeal || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const { error } = await supabase.from("deals").update({
      title: form.title,
      contact_id: form.contact_id || null,
      value: form.value ? toUSD(parseFloat(form.value)) : null,
      status: form.status,
    }).eq("id", editDeal.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deal updated");
      setEditDialogOpen(false);
      setEditDeal(null);
      resetForm();
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from("deals").delete().eq("id", deleteConfirm.id);
    if (error) toast.error(error.message);
    else { toast.success("Deal deleted"); setDeleteConfirm(null); fetchData(); }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setDragDeal(deal);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDragDeal(null);
    if (!over) return;
    const deal = deals.find((d) => d.id === active.id);
    const targetStatus = over.id as DealStatus;
    if (!deal || deal.status === targetStatus) return;
    const { error } = await supabase.from("deals").update({ status: targetStatus }).eq("id", deal.id);
    if (error) toast.error(error.message);
    else {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, status: targetStatus } : d)));
      toast.success(`Moved to ${COLUMNS.find((c) => c.status === targetStatus)?.label}`);
    }
  };

  const getContactName = (id: string | null) => {
    if (!id) return null;
    return contacts.find((c) => c.id === id)?.name || null;
  };

  const renderDealForm = (onSubmit: () => void, submitLabel: string) => (
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
      <div><Label>Value ({symbol})</Label><Input value={form.value} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setForm({ ...form, value: v }); }} placeholder={`Enter amount in ${currency}`} /></div>
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
      <Button className="w-full" onClick={onSubmit}>{submitLabel}</Button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Deal Pipeline</h1>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> New Deal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
              {renderDealForm(handleCreate, "Create Deal")}
            </DialogContent>
          </Dialog>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragDeal(null)}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colDeals = deals.filter((d) => d.status === col.status);
              return (
                <DealColumn key={col.status} status={col.status} label={col.label} color={col.color} isDragging={!!dragDeal}>
                  <h3 className="font-semibold text-sm text-foreground mb-3 uppercase tracking-wider">
                    {col.label}
                    <span className="ml-2 text-muted-foreground">({colDeals.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {colDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        contactName={getContactName(deal.contact_id)}
                        formatValue={formatValue}
                        onEdit={openEdit}
                        onHistory={setHistoryDeal}
                        onDelete={setDeleteConfirm}
                      />
                    ))}
                  </div>
                </DealColumn>
              );
            })}
          </div>
          <DragOverlay>
            {dragDeal ? (
              <Card className="glass-card shadow-2xl rotate-2 cursor-grabbing">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{dragDeal.title}</p>
                      {dragDeal.value && (
                        <p className="text-xs font-semibold text-primary mt-1">{formatValue(Number(dragDeal.value))}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditDeal(null); resetForm(); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
            {renderDealForm(handleUpdate, "Save Changes")}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Deal</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirm?.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Deal History Dialog */}
        {historyDeal && (
          <DealHistoryDialog
            dealId={historyDeal.id}
            dealTitle={historyDeal.title}
            open={!!historyDeal}
            onOpenChange={(open) => { if (!open) setHistoryDeal(null); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
