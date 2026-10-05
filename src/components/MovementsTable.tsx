import { ArrowDownRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client, Movement } from "@/lib/data";
import { euro, fmtDateTime, fullName, MOVEMENT_TYPE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Empty } from "./Status";

const icons = { ricarica: ArrowUpRight, acquisto: ArrowDownRight, correzione: SlidersHorizontal };

export function MovementsTable({ movements, clients }: { movements: Movement[]; clients?: Map<string, Client> }) {
  if (!movements.length) return <Empty>Nessun movimento</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Data</th>
            {clients && <th className="py-2 pr-3 font-semibold">Cliente</th>}
            <th className="py-2 pr-3 font-semibold">Tipo</th>
            <th className="py-2 pr-3 font-semibold">Descrizione</th>
            <th className="py-2 pr-3 text-right font-semibold">Importo</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo prec.</th>
            <th className="py-2 text-right font-semibold">Saldo succ.</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const t = MOVEMENT_TYPE[m.type];
            const Icon = icons[m.type];
            const amt = Number(m.amount);
            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{fmtDateTime(m.created_at)}</td>
                {clients && <td className="py-2.5 pr-3 font-medium">{fullName(clients.get(m.client_id))}</td>}
                <td className="py-2.5 pr-3">
                  <Badge variant={t.variant} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {t.label}
                  </Badge>
                </td>
                <td className="py-2.5 pr-3">{m.description}</td>
                <td className={cn("whitespace-nowrap py-2.5 pr-3 text-right font-semibold", amt < 0 ? "text-destructive" : "text-success")}>
                  {amt > 0 ? "+" : "−"}
                  {euro(Math.abs(amt))}
                </td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">{euro(m.balance_before)}</td>
                <td className="py-2.5 text-right font-semibold">{euro(m.balance_after)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
