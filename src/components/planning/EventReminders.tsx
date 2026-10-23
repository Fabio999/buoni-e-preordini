import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { useCalendarEntries } from "@/lib/data";
import { useOperator } from "@/lib/operator";
import { eventReminders } from "@/lib/event-reminders";
import { planningDate } from "@/lib/planning";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function EventReminders({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { data: events = [] } = useCalendarEntries();
  const operator = useOperator(), navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [seen, setSeen] = useState<string[]>([]), [ready, setReady] = useState(false);
  const storageKey = `mf-event-reminders:${userId}:${operator}`;
  useEffect(() => {
    setReady(false);
    try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); setSeen(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []); } catch { setSeen([]); }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const reminder = ready && enabled ? eventReminders(events, operator, now).find(item => !seen.includes(item.key)) : undefined;
  function dismiss() {
    if (!reminder) return;
    const next = [...seen, reminder.key].slice(-500); setSeen(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Dismissed for this session. */ }
  }
  return <Dialog open={!!reminder} onOpenChange={open => { if (!open) dismiss(); }}><DialogContent className="max-w-md border-t-4 border-t-primary bg-reminder text-reminder-foreground"><DialogHeader><DialogTitle className="flex items-center gap-3"><BellRing className="size-6 shrink-0 text-primary"/>Promemoria evento</DialogTitle><DialogDescription className="text-reminder-foreground">{reminder ? planningDate(reminder.event.starts_at, reminder.event.timezone) : ""}</DialogDescription></DialogHeader><div className="space-y-3 border-y py-5"><h2 className="break-words text-xl font-semibold">{reminder?.event.title}</h2>{reminder?.event.reminder_text && <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words">{reminder.event.reminder_text}</p>}</div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={dismiss}>Ho visto</Button><Button onClick={() => { dismiss(); void navigate({ to: "/calendario" }); }}>Apri calendario</Button></div></DialogContent></Dialog>;
}