import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearch } from "./GlobalSearch";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Eventi", url: "/eventi", icon: CalendarDays },
  { title: "Prenotazioni", url: "/prenotazioni", icon: ClipboardList },
  { title: "Clienti", url: "/clienti", icon: Users },
  { title: "Saldo Negozio", url: "/saldo", icon: Wallet },
  { title: "Prodotti", url: "/prodotti", icon: Package },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
            MF
          </div>
          <div className="font-display text-base font-semibold text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Mana Flask
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Esci" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
              <span>Esci</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur md:px-6">
            <SidebarTrigger />
            <GlobalSearch />
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
