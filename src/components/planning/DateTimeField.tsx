import { CalendarIcon } from "lucide-react";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const pickClass = "h-9 min-w-0 rounded-md border border-input bg-transparent px-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Date + time picker. Hours are 00-23 so evening times (20, 21, 22, 23) are never turned into morning ones. */
export function DateTimeField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const date = value ? new Date(value) : undefined;
  const hour = value.slice(11, 13);
  const minute = value.slice(14, 16);
  const setPart = (h: string, m: string) => onChange(`${value.slice(0, 10) || format(new Date(), "yyyy-MM-dd")}T${h}:${m}`);
  const hourOptions = HOURS.includes(hour) ? HOURS : [hour, ...HOURS];
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [minute, ...MINUTES];
  return <div className="space-y-1.5"><p className="text-sm font-medium">{label}</p><div className="flex min-w-0 items-center gap-2">
    <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="min-w-0 flex-1 justify-start px-2.5" aria-label={label}><CalendarIcon className="size-4 shrink-0"/><span className="truncate">{date ? format(date, "dd/MM/yyyy") : "Scegli data"}</span></Button></PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start"><Calendar locale={it} mode="single" selected={date} onSelect={d => onChange(d ? `${format(d, "yyyy-MM-dd")}T${hour || "09"}:${minute || "00"}` : "")} className="pointer-events-auto"/>{value && !required && <div className="border-t p-1"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange("")}>Rimuovi</Button></div>}</PopoverContent></Popover>
    {value && <div className="flex shrink-0 items-center gap-1" title="Orario in formato 24 ore: 20 = le otto di sera">
      <select aria-label={`${label}: ore`} className={cn(pickClass, "w-14")} value={hour} onChange={e => setPart(e.target.value, minute)}>{hourOptions.map(h => <option key={h} value={h}>{h}</option>)}</select>
      <span aria-hidden="true" className="text-sm font-medium">:</span>
      <select aria-label={`${label}: minuti`} className={cn(pickClass, "w-14")} value={minute} onChange={e => setPart(hour, e.target.value)}>{minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}</select>
    </div>}
  </div></div>;
}
