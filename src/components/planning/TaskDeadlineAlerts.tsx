import { useEffect, useState } from "react";
import { AlertTriangle, BellRing, Minimize2 } from "lucide-react";
import { deadlineReminders, type PersonalDeadlineTask } from "@/lib/task-reminders";
import { planningDate } from "@/lib/planning";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function TaskDeadlineAlerts({ tasks, scope, popup = false, onTask }: { tasks: PersonalDeadlineTask[]; scope?: string; popup?: boolean; onTask?: (id: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  const [seen, setSeen] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const storageKey = `mf-personal-task-reminders:${scope ?? ""}`;
  const collapsedKey = `mf-task-alerts-collapsed:${scope ?? ""}`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(collapsedKey) === "1"); } catch { setCollapsed(false); } }, [collapsedKey]);
  function collapse(value: boolean) {
    setCollapsed(value);
    try { localStorage.setItem(collapsedKey, value ? "1" : "0"); } catch { /* Preference lasts for this visit only. */ }
  }
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  useEffect(() => {
    setReady(false);
    try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); setSeen(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []); } catch { setSeen([]); }
    setReady(true);
  }, [storageKey]);
  const alerts = deadlineReminders(tasks, now);
  const current = popup && ready ? alerts.find(alert => !seen.includes(alert.key)) : undefined;
  function dismiss() {
    if (!current) return;
    const next = [...seen, current.key].slice(-500);
    setSeen(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session acknowledgement remains available. */ }
  }
  return <>
    {alerts.length > 0 && collapsed && <div className="my-4 flex justify-end"><Button variant="outline" size="sm" className="relative" aria-expanded={false} aria-label={`Mostra notifiche task (${alerts.length})`} title="Mostra notifiche task" onClick={() => collapse(false)}><BellRing className={alerts.some(a => a.late) ? "text-destructive" : "text-primary"}/><span className={cn("rounded-full px-1.5 text-[11px] font-semibold text-white", alerts.some(a => a.late) ? "bg-destructive" : "bg-primary")}>{alerts.length}</span></Button></div>}
    {alerts.length > 0 && !collapsed && <section aria-label="Notifiche task" className="my-6 border-y py-4" aria-live="polite"><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><BellRing className="size-5 text-primary"/>Notifiche task <span className="text-sm text-muted-foreground">{alerts.length}</span><Button variant="ghost" size="sm" className="ml-auto font-normal" aria-expanded title="Riduci a icona" onClick={() => collapse(true)}><Minimize2/>Riduci a icona</Button></h2><ul className="divide-y">{alerts.map(alert => <li key={alert.key} className="flex min-w-0 flex-wrap items-center gap-3 py-3"><span className={cn("shrink-0", alert.late ? "text-destructive" : "text-primary")}>{alert.late ? <AlertTriangle className="size-5"/> : <BellRing className="size-5"/>}</span><div className="min-w-0 flex-1"><p className="break-words font-semibold">{alert.task.title}</p><p className={cn("text-sm", alert.late ? "text-destructive" : "text-primary")}>{alert.late ? "Scaduta" : "Scade entro un’ora"} · {planningDate(alert.task.due_at)}</p></div>{onTask && <Button variant="outline" size="sm" onClick={() => onTask(alert.task.id)}>Apri task</Button>}</li>)}</ul></section>}
    {popup && <Dialog open={!!current} onOpenChange={open => { if (!open) dismiss(); }}><DialogContent className="max-w-md bg-reminder text-reminder-foreground"><DialogHeader><DialogTitle className="flex items-center gap-2">{current?.late ? <AlertTriangle className="size-5 text-destructive"/> : <BellRing className="size-5 text-primary"/>}{current?.late ? "Attività in ritardo" : "Scadenza in arrivo"}</DialogTitle><DialogDescription>{current?.late ? "Questa task ha superato la scadenza." : "Questa task scade entro un’ora."}</DialogDescription></DialogHeader><div className="min-w-0 space-y-3 border-y py-4"><h2 className="break-words text-lg font-semibold">{current?.task.title}</h2><p className="text-sm">Scadenza: {planningDate(current?.task.due_at ?? null)}</p></div><div className="flex justify-end"><Button onClick={dismiss}>Ho visto</Button></div></DialogContent></Dialog>}
  </>;
}