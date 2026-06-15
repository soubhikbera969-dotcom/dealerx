import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BentoGrid, type BentoItem } from "@/components/ui/bento-grid";
import {
  Handshake,
  Users,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Palette,
  Mail,
  DollarSign,
} from "lucide-react";

const bentoFeatures: BentoItem[] = [
  {
    title: "Pipeline Dashboard",
    meta: "7d · 30d · 1y",
    description:
      "Visualise deal flow across time ranges with live revenue, win-rate and growth metrics.",
    icon: <LayoutDashboard className="w-4 h-4 text-primary" />,
    status: "Live",
    tags: ["Analytics", "Reports"],
    colSpan: 2,
    hasPersistentHover: true,
  },
  {
    title: "Deal Management",
    meta: "Full history",
    description: "Create, update and audit every deal with complete change tracking.",
    icon: <Handshake className="w-4 h-4 text-emerald-500" />,
    status: "Core",
    tags: ["Deals", "Audit"],
  },
  {
    title: "Contacts & Teams",
    meta: "Role-based",
    description:
      "Organise customers and invite teammates with Super Admin, Admin, Manager, Employee and Intern roles.",
    icon: <Users className="w-4 h-4 text-purple-500" />,
    tags: ["CRM", "Roles"],
    colSpan: 2,
  },
  {
    title: "AI Assistant",
    meta: "Built-in",
    description: "Ask questions about your CRM data and get instant answers.",
    icon: <MessageSquare className="w-4 h-4 text-sky-500" />,
    status: "New",
    tags: ["AI", "Chat"],
  },
  {
    title: "Workspace Invites",
    meta: "Token links",
    description: "Send secure email invites so teammates join only your workspace.",
    icon: <Mail className="w-4 h-4 text-amber-500" />,
    status: "Secure",
    tags: ["Invites", "Auth"],
  },
  {
    title: "Custom Themes",
    meta: "6 palettes",
    description: "Pick an accent color and switch light or dark mode anytime.",
    icon: <Palette className="w-4 h-4 text-rose-500" />,
    tags: ["Theme", "UI"],
  },
  {
    title: "Multi-Currency",
    meta: "USD · EUR · INR",
    description: "Track revenue in your preferred currency with live exchange rates.",
    icon: <DollarSign className="w-4 h-4 text-green-500" />,
    status: "Global",
    tags: ["Finance"],
  },
  {
    title: "Permissions & Security",
    meta: "RLS protected",
    description: "Row-level security keeps every workspace private and isolated.",
    icon: <ShieldCheck className="w-4 h-4 text-indigo-500" />,
    tags: ["Security"],
    colSpan: 2,
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
      <HeroGeometric
        badge="The all-in-one CRM for modern teams"
        title1="Close more deals."
        title2="Run a tighter team."
        description="Manage your sales pipeline, contacts and team from one beautifully simple workspace. Built for founders, sales teams and growing companies."
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/signup">
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">I already have an account</Link>
          </Button>
        </div>
      </HeroGeometric>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to grow</h2>
          <p className="mt-3 text-muted-foreground">A complete toolkit for your sales workflow.</p>
        </div>
        <BentoGrid items={bentoFeatures} />
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
