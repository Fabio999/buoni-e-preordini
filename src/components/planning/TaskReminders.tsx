import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BellRing, AlertTriangle } from "lucide-react";
import { useTasks } from "@/lib/data";
import { useOperator } from "@/lib/operator";
import { planningDate } from "@/lib/planning";
import { taskReminders } from "@/lib/task-reminders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TaskReminders({ userId }: { userId: string }) {
  const { data: tasks = [] } = useTasks();
  const operator = useOperator();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [seen, setSeen] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const storageKey = `mf-task-reminders:${userId}:${operator}`;
  useEffect(() => {
    setReady(false);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      setSeen(Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : []);
    } catch { setSeen([]); }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const reminder = ready ? taskReminders(tasks, operator, now).find(r => !seen.includes(r.key)) : undefined;
  function dismiss() {
    if (!reminder) return;
    const next = [...seen, reminder.key].slice(-500);
    setSeen(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Still dismiss for this session. */ }
  }
  return <Dialog open={!!reminder} onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">{reminder?.late ? <AlertTriangle className="size-5 shrink-0 text-destructive" /> : <BellRing className="size-5 shrink-0 text-primary" />}{reminder?.late ? "Attività in ritardo" : "Scadenza in arrivo"}</DialogTitle>
        <DialogDescription>{operator}, {reminder?.late ? "questa attività ha superato la scadenza." : "questa attività scade entro un'ora."}</DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-3 border-y py-4">
        <h2 className="break-words text-lg font-semibold">{reminder?.task.title}</h2>
        <p className="text-sm text-muted-foreground">Scadenza: <strong className="text-foreground">{planningDate(reminder?.task.due_at ?? null)}</strong></p>
        {reminder?.task.description && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm">{reminder.task.description}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={dismiss}>Ho visto</Button><Button onClick={() => { dismiss(); void navigate({ to: "/task-calendario" }); }}>Apri attività</Button></div>
    </DialogContent>
  </Dialog>;
}