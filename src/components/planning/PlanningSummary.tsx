import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, FolderKanban, LoaderCircle } from "lucide-react";
import { SectionLabel } from "@/components/Status";
import { useTasks, useCalendarEntries } from "@/lib/data";
import { planningDate, taskStats, upcomingEvents } from "@/lib/planning";

export function PlanningSummary({ showEvents = true, compact = false }: { showEvents?: boolean; compact?: boolean }) {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEntries();
  const s = taskStats(tasks);
  const stats = [
    { label: "Task totali", value: s.total, icon: FolderKanban, box: "bg-secondary/40 text-secondary-foreground", chip: "bg-secondary text-secondary-foreground" },
    { label: "Aperte", value: s.todo, icon: CircleDashed, box: "bg-primary/10 text-primary", chip: "bg-primary text-primary-foreground" },
    { label: "Work in progress", value: s.progress, icon: LoaderCircle, box: "bg-info/10 text-info", chip: "bg-info text-info-foreground" },
    { label: "Completate", value: s.done, icon: CheckCircle2, box: "bg-success/10 text-success", chip: "bg-success text-success-foreground" },
  ];
  const next = upcomingEvents(events).slice(0, 4);
  return <section><SectionLabel>Task</SectionLabel><div className={compact ? "grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 sm:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-4"}>
    {stats.map(stat => <div key={stat.label} className={compact ? "flex min-w-0 items-center gap-2.5" : "flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"}>
      <span className={`grid shrink-0 place-items-center rounded-lg ${compact ? "size-9" : "size-11"} ${compact && stat.label === "Task totali" ? "bg-muted text-muted-foreground" : stat.box}`}><stat.icon className="size-5" /></span>
      <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p><p className="text-2xl font-semibold tabular-nums leading-tight">{stat.value}</p></div>
    </div>)}
  </div>{showEvents && <><div className="mt-6 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Prossimi appuntamenti</h3><Link to="/calendario" className="text-sm font-medium text-primary">Apri Calendario →</Link></div>
    {next.length ? <ul className="mt-2 divide-y">{next.map(e => <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{e.title} {!e.confirmed && <span className="text-muted-foreground">· Da programmare</span>}</span><span>{planningDate(e.starts_at, e.timezone)}</span></li>)}</ul> : <p className="py-3 text-sm text-muted-foreground">Nessun appuntamento in programma.</p>}
  </>}</section>;
}
