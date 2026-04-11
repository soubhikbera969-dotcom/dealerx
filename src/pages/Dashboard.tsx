import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Handshake, Clock, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { subDays, subMonths, subYears, startOfMonth } from "date-fns";

type TimeFrame = "7d" | "15d" | "1m" | "prev_month" | "3m" | "6m" | "1y" | "5y" | "lifetime";

const TIME_FRAME_LABELS: Record<TimeFrame, string> = {
  "7d": "Last 7 Days",
  "15d": "Last 15 Days",
  "1m": "Last Month",
  "prev_month": "Previous Month",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  "1y": "Last Year",
  "5y": "Last 5 Years",
  "lifetime": "Lifetime",
};

function getDateRange(tf: TimeFrame): { from: Date | null; to: Date } {
  const now = new Date();
  switch (tf) {
    case "7d": return { from: subDays(now, 7), to: now };
    case "15d": return { from: subDays(now, 15), to: now };
    case "1m": return { from: subMonths(now, 1), to: now };
    case "prev_month": {
      const start = startOfMonth(subMonths(now, 1));
      const end = startOfMonth(now);
      return { from: start, to: end };
    }
    case "3m": return { from: subMonths(now, 3), to: now };
    case "6m": return { from: subMonths(now, 6), to: now };
    case "1y": return { from: subYears(now, 1), to: now };
    case "5y": return { from: subYears(now, 5), to: now };
    case "lifetime": return { from: null, to: now };
  }
}

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("7d");
  const [stats, setStats] = useState({ contacts: 0, leads: 0, completed: 0, paymentDone: 0 });
  const [chartData, setChartData] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchStats = async () => {
      const { from, to } = getDateRange(timeFrame);

      // Contacts count (always total, not time-filtered)
      const contactsRes = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      // Deals filtered by time frame
      let dealsQuery = supabase
        .from("deals")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (from) {
        dealsQuery = dealsQuery.gte("created_at", from.toISOString());
      }
      dealsQuery = dealsQuery.lte("created_at", to.toISOString());

      const dealsRes = await dealsQuery;
      const deals = dealsRes.data || [];
      const leads = deals.filter((d) => d.status === "lead").length;
      const completed = deals.filter((d) => d.status === "completed").length;
      const paymentDone = deals.filter((d) => d.status === "payment_done").length;

      setStats({
        contacts: contactsRes.count || 0,
        leads,
        completed,
        paymentDone,
      });

      setChartData([
        { name: "Leads", count: leads },
        { name: "In Progress", count: deals.filter((d) => d.status === "in_progress").length },
        { name: "Completed", count: completed },
        { name: "Paid", count: paymentDone },
      ]);
    };

    fetchStats();
  }, [workspaceId, timeFrame]);

  const cards = [
    { title: "Total Contacts", value: stats.contacts, icon: Users, color: "text-primary" },
    { title: "Active Leads", value: stats.leads, icon: Clock, color: "text-accent" },
    { title: "Completed Deals", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
    { title: "Payments Done", value: stats.paymentDone, icon: Handshake, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIME_FRAME_LABELS) as TimeFrame[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {TIME_FRAME_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card key={card.title} className="glass-card hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              Deal Pipeline Overview — {TIME_FRAME_LABELS[timeFrame]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
