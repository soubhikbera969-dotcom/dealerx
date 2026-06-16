import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Trash2,
  Edit3,
  CalendarDays,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
  created_by: string | null;
}

const COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toInputDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const defaultStart = (date?: Date) => {
  const d = date ? new Date(date) : new Date();
  d.setMinutes(0, 0, 0);
  if (!date) d.setHours(d.getHours() + 1);
  else d.setHours(9, 0, 0, 0);
  return toInputDateTime(d.toISOString());
};
const defaultEnd = (start: string) => {
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return toInputDateTime(d.toISOString());
};

export default function CalendarPage() {
  const { workspaceId, isAdmin, user } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_at: defaultStart(),
    end_at: defaultEnd(defaultStart()),
    all_day: false,
    color: COLORS[0].value,
  });
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    // Pad by ~1 week each side so the grid leading/trailing cells show events.
    const rangeStart = new Date(monthStart);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(monthEnd);
    rangeEnd.setDate(rangeEnd.getDate() + 14);

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("start_at", rangeStart.toISOString())
      .lte("start_at", rangeEnd.toISOString())
      .order("start_at", { ascending: true });

    if (error) toast.error(error.message);
    setEvents((data || []) as CalendarEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, cursor]);

  // Build the 6x7 month grid
  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay(); // 0 = Sun
    const cells: Date[] = [];
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startWeekday);
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const d = new Date(e.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const openCreate = (date?: Date) => {
    const s = defaultStart(date);
    setEditing(null);
    setForm({
      title: "",
      description: "",
      location: "",
      start_at: s,
      end_at: defaultEnd(s),
      all_day: false,
      color: COLORS[0].value,
    });
    setOpen(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description || "",
      location: e.location || "",
      start_at: toInputDateTime(e.start_at),
      end_at: toInputDateTime(e.end_at),
      all_day: e.all_day,
      color: e.color || COLORS[0].value,
    });
    setOpen(true);
  };

  const saveEvent = async () => {
    if (!workspaceId || !user) return;
    if (!form.title.trim()) return toast.error("Title is required");
    if (new Date(form.end_at) < new Date(form.start_at))
      return toast.error("End time must be after start time");

    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      all_day: form.all_day,
      color: form.color,
    };

    const { error } = editing
      ? await supabase.from("calendar_events").update(payload).eq("id", editing.id)
      : await supabase
          .from("calendar_events")
          .insert({ ...payload, created_by: user.id });

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Event updated" : "Event scheduled");
    setOpen(false);
    loadEvents();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    loadEvents();
  };

  const today = new Date();
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const selectedDayEvents = selectedDay
    ? eventsByDay.get(dayKey(selectedDay)) || []
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarDays className="h-7 w-7 text-primary" />
              Planner
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? "Schedule events for your workspace"
                : "Workspace events and schedule (view only)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="min-w-[160px] text-center font-semibold text-lg">
              {monthLabel}
            </div>
            {isAdmin && (
              <Button onClick={() => openCreate()}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                New Event
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-3 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = isSameDay(d, today);
                const dayEvents = eventsByDay.get(dayKey(d)) || [];
                const isSelected = selectedDay && isSameDay(d, selectedDay);
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedDay(d)}
                    onDoubleClick={() => isAdmin && openCreate(d)}
                    className={`relative min-h-[92px] border-r border-b p-1.5 text-left transition-colors hover:bg-accent/40 ${
                      !inMonth ? "bg-muted/30 text-muted-foreground/60" : ""
                    } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          isToday
                            ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                            : ""
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: e.color || COLORS[0].value }}
                          title={e.title}
                        >
                          {e.all_day
                            ? e.title
                            : `${new Date(e.start_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })} ${e.title}`}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {selectedDay && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {selectedDay.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </CardTitle>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => openCreate(selectedDay)}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedDayEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No events scheduled.</p>
              ) : (
                selectedDayEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{ backgroundColor: e.color || COLORS[0].value }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{e.title}</h3>
                        {e.all_day && <Badge variant="secondary">All day</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {e.all_day
                            ? "All day"
                            : `${new Date(e.start_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })} – ${new Date(e.end_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}`}
                        </span>
                        {e.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">
                          {e.description}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(e)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteEvent(e.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Loading events...</p>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit event" : "Schedule new event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Team standup, Client demo..."
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      start_at: e.target.value,
                      end_at:
                        new Date(form.end_at) < new Date(e.target.value)
                          ? defaultEnd(e.target.value)
                          : form.end_at,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="all-day" className="cursor-pointer">
                All-day event
              </Label>
              <Switch
                id="all-day"
                checked={form.all_day}
                onCheckedChange={(v) => setForm({ ...form, all_day: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Conference Room A, Zoom link..."
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Agenda, notes, attendees..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.color === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <Button
                variant="destructive"
                onClick={() => {
                  setOpen(false);
                  deleteEvent(editing.id);
                }}
              >
                Delete
              </Button>
            )}
            <Button onClick={saveEvent} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
