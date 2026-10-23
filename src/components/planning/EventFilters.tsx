import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field, selectClass } from "@/components/forms/SimpleDialogs";
import { EVENT_COLORS } from "@/lib/planning";
import { emptyEventFilters, type EventFilters as Filters } from "@/lib/event-reminders";

export function EventFilters({ value, onChange }: { value: Filters; onChange: (value: Filters) => void }) {
  const change = (key: keyof Filters, next: string) => onChange({ ...value, [key]: next });
  function dateField(key: "from" | "to", label: string) {
    const selected = value[key] ? new Date(`${value[key]}T12:00:00`) : undefined;
    return <Field label={label}><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start" aria-label={label}><CalendarIcon className="size-4"/>{selected ? format(selected, "dd/MM/yyyy") : "Tutte le date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={it} mode="single" selected={selected} onSelect={date => change(key, date ? format(date, "yyyy-MM-dd") : "")} className="pointer-events-auto"/><Button variant="ghost" className="w-full" onClick={() => change(key, "")}>Rimuovi data</Button></PopoverContent></Popover></Field>;
  }
  return <div className="space-y-3 border-y py-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Nome evento"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input className="pl-9" aria-label="Cerca eventi in programma" placeholder="Cerca per nome…" value={value.q} onChange={e => change("q", e.target.value)}/></div></Field>{dateField("from", "Eventi dal")}{dateField("to", "Eventi al")}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(["hourFrom", "hourTo"] as const).map((key, index) => <Field key={key} label={index ? "Ora di inizio fino alle" : "Ora di inizio dalle"}><select className={selectClass} aria-label={index ? "Ora eventi fino alle" : "Ora eventi dalle"} value={value[key]} onChange={e => change(key, e.target.value)}><option value="">Tutti gli orari</option>{Array.from({ length: 96 }, (_, i) => { const time = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String(i % 4 * 15).padStart(2, "0")}`; return <option key={time}>{time}</option>; })}</select></Field>)}<Field label="Colore"><div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filtra colore eventi"><Button size="sm" variant={value.color ? "outline" : "secondary"} role="radio" aria-checked={!value.color} onClick={() => change("color", "")}>Tutti</Button>{EVENT_COLORS.map(color => <Button key={color.value} size="icon" variant="outline" role="radio" aria-label={`Filtra ${color.label}`} aria-checked={value.color === color.value} title={color.label} className={value.color === color.value ? "ring-2 ring-ring" : ""} onClick={() => change("color", color.value)}><span className={`size-4 rounded-full ${color.dot}`}/></Button>)}</div></Field></div><div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => onChange({ ...emptyEventFilters })}><RotateCcw className="size-4"/>Reimposta filtri eventi</Button></div></div>;
}