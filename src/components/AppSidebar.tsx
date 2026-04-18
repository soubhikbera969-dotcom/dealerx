import { LayoutDashboard, Users, Handshake, LogOut, Sun, Moon, DollarSign, Settings, UserCog } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeColorPicker } from "@/components/ThemeColorPicker";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Deals", url: "/deals", icon: Handshake },
];

const adminItems = [
  { title: "Members", url: "/members", icon: UserCog },
  { title: "Workspace", url: "/settings/workspace", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, workspaceName, workspaceLogo, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

  const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
    { value: "USD", label: "USD ($)", symbol: "$" },
    { value: "EUR", label: "EUR (€)", symbol: "€" },
    { value: "INR", label: "INR (₹)", symbol: "₹" },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            <div className="flex items-center gap-2 py-1">
              <Avatar className="h-6 w-6">
                <AvatarImage src={workspaceLogo || undefined} />
                <AvatarFallback className="text-[10px]">{workspaceName?.[0]?.toUpperCase() || "C"}</AvatarFallback>
              </Avatar>
              {!collapsed && <span className="truncate">{workspaceName || "CRM"}</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              {!collapsed && "Admin"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-accent/50 transition-colors"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="space-y-2 p-2">
        {!collapsed ? (
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
            <SelectTrigger className="w-full h-9 text-sm">
              <DollarSign className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = CURRENCY_OPTIONS[(CURRENCY_OPTIONS.findIndex(o => o.value === currency) + 1) % 3];
              setCurrency(next.value);
            }}
            className="w-full"
            title={currency}
          >
            <span className="text-sm font-semibold">{CURRENCY_OPTIONS.find(o => o.value === currency)?.symbol}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={toggleTheme}
          className="w-full justify-start"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">{theme === "light" ? "Dark mode" : "Light mode"}</span>}
        </Button>
        <ThemeColorPicker collapsed={collapsed} />
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full justify-start text-destructive hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
