import { useState } from "react";
import { AlertTriangle, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MIN_STAFF_PER_DAY, planChanges, planKey, planningOrder, planSlots, SHIFT_STATUSES, type Collaborator, type PlanSlot, type ShiftAssignment, type ShiftEntry } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export type WeekChanges = Pick<ReturnType<typeof planChanges>, "save" | "remove">;
const dayName = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", options);

export function WeekPlanner({ days, people, entries, assignments, onSave, onPublish, onClose }: { days: string[]; people: Collaborator[]; entries: ShiftEntry[]; assignments: ShiftAssignment[]; onSave: (changes: WeekChanges) => Promise<void>; onPublish: () => Promise<boolean>; onClose: () => void }) {
  const [slots, setSlots] = useState<Record<string, PlanSlot>>(() => planSlots(assignments, days));
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("19:00");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const names = new Map(people.map(p => [p.id, `${p.first_name} ${p.last_name}`]));
  const listed = people.filter(p => p.active || assignments.some(a => a.collaborator_id === p.id && days.includes(a.day)));
  const count = (day: string) => listed.filter(p => slots[planKey(p.id, day)]?.on).length;
  function update(key: string, patch: Partial<PlanSlot>) {
    setSlots(s => ({ ...s, [key]: { ...(s[key] ?? { on: false, starts_at: start, ends_at: end, ends_next_day: false, note: "" }), ...patch } }));
  }
  function toggle(key: string, on: boolean) {
    const slot = slots[key];
    update(key, on && (!slot?.starts_at || !slot.ends_at) ? { on, starts_at: start, ends_at: end } : { on });
  }
  async function save(publish: boolean) {
    const changes = planChanges(assignments, slots, names);
    setErrors(changes.errors);
    if (changes.errors.length) return;
    setBusy(true);
    try {
      if (changes.save.length || changes.remove.length) await onSave(changes);
      if (publish ? await onPublish() : true) onClose();
    } catch (e) { setErrors([(e as Error).message]); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Pianifica settimana {dayName(days[0] ?? "", { day: "numeric", month: "long" })} – {dayName(days.at(-1) ?? "", { day: "numeric", month: "long" })}</DialogTitle></DialogHeader>
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-3"><p className="w-full text-sm text-muted-foreground">Spunta chi metti in turno: l’orario parte da quello predefinito e puoi cambiarlo per ognuno.</p><div className="space-y-1"><Label htmlFor="plan-start">Inizio predefinito</Label><Input id="plan-start" type="time" value={start} onChange={e => setStart(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="plan-end">Fine predefinita</Label><Input id="plan-end" type="time" value={end} onChange={e => setEnd(e.target.value)} /></div></div>
    <Tabs defaultValue={days[0] ?? ""}><TabsList className="flex h-auto flex-wrap justify-start">{days.map(day => <TabsTrigger key={day} value={day} className="gap-1 capitalize">{dayName(day, { weekday: "short", day: "numeric" })}<span className={cn("rounded px-1 text-[10px]", count(day) < MIN_STAFF_PER_DAY ? "bg-warning/20 text-warning" : "bg-success/15 text-success")}>{count(day)}</span></TabsTrigger>)}</TabsList>
      {days.map(day => <TabsContent key={day} value={day} className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium capitalize">{dayName(day, { weekday: "long", day: "numeric", month: "long" })}{count(day) < MIN_STAFF_PER_DAY && <span className="flex items-center gap-1 text-xs font-normal normal-case text-warning"><AlertTriangle className="size-3.5" />meno di {MIN_STAFF_PER_DAY} persone</span>}</p>
        <ul className="divide-y rounded-lg border">{planningOrder(listed, entries, day).map(({ person, entry }) => {
          const key = planKey(person.id, day); const slot = slots[key]; const state = SHIFT_STATUSES.find(s => s.value === entry?.status);
          return <li key={key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 p-3", slot?.on && "bg-primary/5")}>
            <label className="flex min-w-48 flex-1 items-start gap-2"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={!!slot?.on} disabled={busy} onChange={e => toggle(key, e.target.checked)} /><span className="min-w-0"><span className="block break-words font-medium">{person.first_name} {person.last_name}</span><span className={cn("mt-0.5 inline-block rounded border px-1.5 text-[11px]", state?.className ?? "border-dashed text-muted-foreground")}>{state?.label ?? "Da inserire"}</span>{entry?.note && <span className="block break-words text-xs text-muted-foreground">{entry.note}</span>}</span></label>
            {slot?.on && <div className="flex flex-wrap items-center gap-2"><Input aria-label={`Inizio ${person.first_name}`} type="time" className="w-28" value={slot.starts_at} disabled={busy} onChange={e => update(key, { starts_at: e.target.value })} /><span>–</span><Input aria-label={`Fine ${person.first_name}`} type="time" className="w-28" value={slot.ends_at} disabled={busy} onChange={e => update(key, { ends_at: e.target.value })} /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={slot.ends_next_day} disabled={busy} onChange={e => update(key, { ends_next_day: e.target.checked })} />+1 giorno</label></div>}
          </li>;
        })}</ul>
      </TabsContent>)}
    </Tabs>
    {errors.length > 0 && <ul role="alert" className="space-y-1 text-sm text-destructive">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Annulla</Button><Button variant="outline" disabled={busy} onClick={() => save(false)}><Save />Salva bozza</Button><Button disabled={busy} onClick={() => save(true)}><Send />Salva e pubblica settimana</Button></div>
  </DialogContent></Dialog>;
}
