import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  UserRound,
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
import { signOutOperator, useOperator } from "@/lib/operator";
import { useIsAdmin } from "@/lib/data";
import { GlobalSearch } from "./GlobalSearch";
import logoAsset from "@/assets/mana-flask-logo.png.asset.json";
import iconAsset from "@/assets/mana-flask-icon.jpg.asset.json";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Eventi", url: "/eventi", icon: CalendarDays },
  { title: "Task", url: "/task-calendario", icon: ClipboardList },
  { title: "Calendario", url: "/calendario", icon: CalendarDays },
  { title: "Prenotazioni", url: "/prenotazioni", icon: ClipboardList },
  { title: "Clienti", url: "/clienti", icon: Users },
  { title: "Saldo Negozio", url: "/saldo", icon: Wallet },
  { title: "Prodotti", url: "/prodotti", icon: Package },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  const { data: isAdmin } = useIsAdmin();
  const operator = useOperator();
  const all = isAdmin
    ? [...items, { title: "Amministrazione", url: "/amministrazione", icon: ShieldCheck } as const]
    : items;
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-3 group-data-[collapsible=icon]:px-0">
          <img src={logoAsset.url} alt="Mana Flask" className="h-28 w-full object-contain group-data-[collapsible=icon]:hidden" />
          <img src={iconAsset.url} alt="Mana Flask" className="hidden h-8 w-8 shrink-0 rounded-md object-contain group-data-[collapsible=icon]:block" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {all.map((item) => (
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
            <SidebarMenuButton tooltip={operator} className="pointer-events-none">
              <UserRound className="h-4 w-4" />
              <span className="truncate">{operator}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Esci" onClick={() => signOutOperator()}>
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
