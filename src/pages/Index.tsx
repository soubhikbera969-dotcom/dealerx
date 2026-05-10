import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Handshake,
  Users,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Pipeline Dashboard",
    description: "Track your deals across 7-day, monthly, yearly and lifetime views.",
  },
  {
    icon: Handshake,
    title: "Deal Management",
    description: "Create, update and audit every deal with full modification history.",
  },
  {
    icon: Users,
    title: "Contacts & Teams",
    description: "Organise customers and invite teammates with role-based access.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & Permissions",
    description: "Super Admin, Admin, Manager, Employee and Intern levels built in.",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant",
    description: "Ask questions about your CRM data and get instant answers.",
  },
  {
    icon: Sparkles,
    title: "Custom Themes",
    description: "Pick your accent color and switch light or dark mode anytime.",
  },
];

const benefits = [
  "Multi-currency support (USD, EUR, INR)",
  "Workspace branding with logo and description",
  "Secure invite links for new team members",
  "Real-time deal change tracking",
];

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Handshake className="h-4 w-4" />
            </div>
            DealerX
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 md:py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" /> The all-in-one CRM for modern teams
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          Close more deals with a CRM your team will actually use
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Manage your sales pipeline, contacts and team — all from one beautifully simple workspace.
          Built for founders, sales teams and growing companies.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/signup">
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to grow</h2>
          <p className="mt-3 text-muted-foreground">A complete toolkit for your sales workflow.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-colors hover:bg-accent/30">
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl border border-border bg-muted/30 p-8 md:p-12 grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-3">Built for the way you work</h2>
            <p className="text-muted-foreground">
              From solo founders to growing teams, DealerX adapts to you.
            </p>
          </div>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">Ready to get started?</h2>
        <p className="mt-3 text-muted-foreground">Create your workspace in less than a minute.</p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/signup">
            Create your free account <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} DealerX. All rights reserved.
      </footer>
    </div>
  );
}
