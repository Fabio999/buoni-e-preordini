import { Link } from "@tanstack/react-router";
import { SectionLabel } from "@/components/Status";
import { useTasks, useCalendarEntries } from "@/lib/data";
import { planningDate, taskStats, upcomingEvents } from "@/lib/planning";

export function PlanningSummary({ showEvents = true }: { showEvents?: boolean }) {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEntries();
  const s = taskStats(tasks);
  const stats = [{label:"Task totali",value:s.total,tone:"border-secondary"},{label:"Aperte",value:s.todo,tone:"border-primary"},{label:"Work in progress",value:s.progress,tone:"border-info"},{label:"Completate",value:s.done,tone:"border-success"},{label:"Obbligatorie aperte",value:s.mandatory,tone:"border-primary"},{label:"Scadute",value:s.overdue,tone:"border-destructive"}];
  const next = upcomingEvents(events).slice(0, 4);
  return <section><SectionLabel>Task</SectionLabel><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
    {stats.map(stat => <div key={stat.label} className={`min-w-0 rounded-lg border border-l-4 bg-card p-4 ${stat.tone}`}><p className="min-h-10 break-words text-sm font-medium leading-5 text-muted-foreground">{stat.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p></div>)}
  </div>{showEvents && <><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Prossimi appuntamenti</h3><Link to="/calendario" className="text-sm font-medium text-primary">Apri Calendario →</Link></div>
    {next.length ? <ul className="mt-2 divide-y">{next.map(e => <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{e.title} {!e.confirmed && <span className="text-muted-foreground">· Da programmare</span>}</span><span>{planningDate(e.starts_at, e.timezone)}</span></li>)}</ul> : <p className="py-3 text-sm text-muted-foreground">Nessun appuntamento in programma.</p>}
  </>}</section>;
}