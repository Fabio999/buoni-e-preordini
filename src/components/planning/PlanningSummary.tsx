import { Link } from "@tanstack/react-router";
import { StatCard, SectionLabel } from "@/components/Status";
import { useTasks, useCalendarEntries } from "@/lib/data";
import { planningDate, taskStats } from "@/lib/planning";

export function PlanningSummary() {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEntries();
  const s = taskStats(tasks);
  const next = events.filter(e => !e.archived && new Date(e.ends_at) >= new Date()).slice(0, 4);
  return <section><SectionLabel>Task e Calendario</SectionLabel><div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
    <StatCard label="Task totali" value={s.total}/><StatCard label="Da fare" value={s.todo} tone="action"/><StatCard label="In corso" value={s.progress} tone="info"/><StatCard label="Completate" value={s.done} tone="success"/><StatCard label="Obbligatorie aperte" value={s.mandatory} tone="action"/><StatCard label="Scadute" value={s.overdue} tone="danger"/>
  </div><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Prossimi appuntamenti</h3><Link to="/task-calendario" className="text-sm font-medium text-primary">Apri Task e Calendario →</Link></div>
    {next.length ? <ul className="mt-2 divide-y">{next.map(e => <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{e.title} {!e.confirmed && <span className="text-muted-foreground">· Da programmare</span>}</span><span>{planningDate(e.starts_at, e.timezone)}</span></li>)}</ul> : <p className="py-3 text-sm text-muted-foreground">Nessun appuntamento in programma.</p>}
  </section>;
}