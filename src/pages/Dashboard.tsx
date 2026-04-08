import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, Clock, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const [stats, setStats] = useState({ contacts: 0, leads: 0, completed: 0, paymentDone: 0 });
  const [chartData, setChartData] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchStats = async () => {
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("deals").select("*").eq("workspace_id", workspaceId),
      ]);

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
  }, [workspaceId]);

  const cards = [
    { title: "Total Contacts", value: stats.contacts, icon: Users, color: "text-primary" },
    { title: "Active Leads", value: stats.leads, icon: Clock, color: "text-accent" },
    { title: "Completed Deals", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
    { title: "Payments Done", value: stats.paymentDone, icon: Handshake, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
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
            <CardTitle className="text-foreground">Deal Pipeline Overview</CardTitle>
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
