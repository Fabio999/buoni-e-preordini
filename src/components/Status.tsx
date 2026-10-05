import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/format";
import type { ReactNode } from "react";

export function PaymentPill({ status, onClick, className }: { status: PaymentStatus; onClick?: () => void; className?: string }) {
  const paid = status === "pagato";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? "Clicca per cambiare stato pagamento" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition",
        paid ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
        onClick && "cursor-pointer hover:ring-2 hover:ring-ring/40",
        className,
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", paid ? "bg-success" : "bg-destructive")} />
      {paid ? "PAGATO" : "NON PAGATO"}
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "danger" | "action" | "info";
  icon?: ReactNode;
}) {
  const bar = {
    default: "bg-secondary",
    success: "bg-success",
    danger: "bg-destructive",
    action: "bg-primary",
    info: "bg-info",
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-secondary first:mt-0">{children}</h2>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export { Badge };
