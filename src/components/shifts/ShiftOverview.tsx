import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Minimize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/data";
import { useCollapsed } from "@/hooks/use-collapsed";
import { cn } from "@/lib/utils";
import { criticalDays, formatHours, HISTORY_ACTIONS, HISTORY_SOURCES, hoursByCollaborator, MIN_STAFF_PER_DAY, movePeriod, periodLabel, SHIFT_VIEWS, shiftHistoryChanges, type Collaborator, type ShiftAssignment, type ShiftEntry, type ShiftView } from "@/lib/shifts";

export function PeriodControls({ view, anchor, onView, onAnchor }: { view: ShiftView; anchor: string; onView: (v: ShiftView) => void; onAnchor: (day: string) => void }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold first-letter:uppercase">{periodLabel(view, anchor)}</h2><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1" role="group" aria-label="Vista">{SHIFT_VIEWS.map(v => <Button key={v.value} variant={view === v.value ? "secondary" : "outline"} aria-pressed={view === v.value} onClick={() => onView(v.value)}>{v.label}</Button>)}</div><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Periodo precedente" onClick={() => onAnchor(movePeriod(view, anchor, -1))}><ChevronLeft /></Button><Button variant="outline" onClick={() => onAnchor(formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd"))}>Oggi</Button><Button variant="outline" size="icon" aria-label="Periodo successivo" onClick={() => onAnchor(movePeriod(view, anchor, 1))}><ChevronRight /></Button></div></div></div>;
}

function dayLabel(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export function ShiftSummary({ days, people, assignments, entries }: { days: string[]; people: Collaborator[]; assignments: ShiftAssignment[]; entries: Pick<ShiftEntry, "collaborator_id" | "day">[] }) {
  const first = days[0] ?? ""; const last = days.at(-1) ?? "";
  const totals = hoursByCollaborator(assignments, first, last);
  const listed = people.filter(p => p.active || totals.has(p.id));
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => { try { setDismissed(JSON.parse(localStorage.getItem("mf-critical-days-dismissed") ?? "[]")); } catch { /* ignore */ } }, []);
  const dismiss = (day: string) => setDismissed(prev => { const next = [...new Set([...prev, day])]; localStorage.setItem("mf-critical-days-dismissed", JSON.stringify(next)); return next; });
  const critical = criticalDays(days, people, assignments, entries).filter(d => !dismissed.includes(d.day));
  const [collapsed, collapse] = useCollapsed("mf-critical-days-collapsed");
  return <div className={cn("mt-4 grid gap-4", !collapsed && "lg:grid-cols-2")}>
    <section className="rounded-lg border bg-card p-4"><h3 className="mb-3 flex flex-wrap items-center justify-between gap-2 font-semibold">Ore per collaboratore{collapsed && <Button variant="outline" size="sm" className="font-normal" aria-expanded={false} aria-label={`Mostra giorni con meno di ${MIN_STAFF_PER_DAY} persone (${critical.length})`} title={`Giorni con meno di ${MIN_STAFF_PER_DAY} persone`} onClick={() => collapse(false)}><AlertTriangle className={critical.length ? "text-warning" : "text-muted-foreground"} /><span className={cn("rounded-full px-1.5 text-[11px] font-semibold", critical.length ? "bg-warning text-white" : "bg-muted text-muted-foreground")}>{critical.length}</span></Button>}</h3>{!listed.length ? <p className="text-sm text-muted-foreground">Nessun collaboratore.</p> : <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">Collaboratore</th><th className="py-1 text-right font-medium">Turni</th><th className="py-1 text-right font-medium">Ore</th></tr></thead><tbody>{listed.map(p => { const t = totals.get(p.id); return <tr key={p.id} className="border-t"><td className="break-words py-1.5">{p.first_name} {p.last_name}</td><td className="py-1.5 text-right">{t?.shifts ?? 0}</td><td className="py-1.5 text-right">{formatHours(t?.minutes ?? 0)}</td></tr>; })}</tbody></table>}</section>
    {!collapsed && <section className="rounded-lg border bg-card p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold">Giorni con meno di {MIN_STAFF_PER_DAY} persone<Button variant="ghost" size="sm" className="ml-auto font-normal" aria-expanded title="Riduci a icona" onClick={() => collapse(true)}><Minimize2 />Riduci a icona</Button></h3>{!critical.length ? <p className="text-sm text-muted-foreground">Nessun giorno critico nel periodo.</p> : <ul className="space-y-2 text-sm">{critical.map(d => <li key={d.day} className="rounded border border-warning/40 bg-warning/10 p-2"><p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4 shrink-0 text-warning" /><span className="capitalize">{dayLabel(d.day)}</span> · {d.assigned} {d.assigned === 1 ? "persona" : "persone"} in turno<Button variant="ghost" size="icon" className="ml-auto size-7 shrink-0" aria-label={`Elimina avviso del ${dayLabel(d.day)}`} title="Elimina avviso" onClick={() => dismiss(d.day)}><Trash2 className="size-4" /></Button></p>{d.missing.length > 0 && <p className="mt-1 break-words text-xs text-muted-foreground">Disponibilità da inserire: {d.missing.map(p => `${p.first_name} ${p.last_name}`).join(", ")}</p>}</li>)}</ul>}</section>}
  </div>;
}

export function ShiftHistoryDialog({ collaboratorId, day, name, onClose }: { collaboratorId: string; day: string; name: string; onClose: () => void }) {
  const history = useQuery({ queryKey: ["shift-history", collaboratorId, day], queryFn: async () => {
    const { data, error } = await supabase.from("shift_history").select("*").eq("collaborator_id", collaboratorId).eq("day", day).order("created_at", { ascending: false });
    if (error) throw error; return data;
  } });
  const rows = history.data ?? [];
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="break-words">Cronologia — {name}, <span className="capitalize">{dayLabel(day)}</span></DialogTitle></DialogHeader>
    {history.isLoading ? <p>Caricamento…</p> : history.error ? <p className="text-destructive">{errMsg(history.error)}</p> : !rows.length ? <p className="text-sm text-muted-foreground">Nessuna modifica registrata.</p> : <ol className="divide-y">{rows.map(h => <li key={h.id} className="space-y-1 py-3"><div className="flex flex-wrap justify-between gap-1 text-sm"><strong>{HISTORY_ACTIONS[h.action] ?? h.action} {h.entity_type === "turno" ? "turno" : "disponibilità"}</strong><span className="text-muted-foreground">{formatInTimeZone(h.created_at, "Europe/Rome", "d MMM yyyy, HH:mm", { locale: it })}</span></div><p className="text-xs text-muted-foreground">{h.operator_name || "Operatore non indicato"} · {HISTORY_SOURCES[h.source] ?? h.source}{h.after_deadline && <span className="ml-1 font-semibold text-warning">· dopo la scadenza</span>}</p>{shiftHistoryChanges(h.entity_type, h.before_data as Record<string, unknown> | null, h.after_data as Record<string, unknown> | null).map(c => <p key={c} className="break-words text-xs">{c}</p>)}</li>)}</ol>}
  </DialogContent></Dialog>;
}
