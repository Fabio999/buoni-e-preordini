import { CalendarIcon } from "lucide-react";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

export function DateTimeField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const date = value ? new Date(value) : undefined;
  return <div className="space-y-1.5"><p className="text-sm font-medium">{label}</p><div className="flex min-w-0 items-center gap-2">
    <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="min-w-0 flex-1 justify-start px-2.5" aria-label={label}><CalendarIcon className="size-4 shrink-0"/><span className="truncate">{date ? format(date, "dd/MM/yyyy") : "Scegli data"}</span></Button></PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start"><Calendar locale={it} mode="single" selected={date} onSelect={d => onChange(d ? `${format(d, "yyyy-MM-dd")}T${value.slice(11) || "09:00"}` : "")} className="pointer-events-auto"/>{value && !required && <div className="border-t p-1"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange("")}>Rimuovi</Button></div>}</PopoverContent></Popover>
    {value && <Input type="time" aria-label={`${label}: ora`} className="w-17 shrink-0 px-2" value={value.slice(11)} onChange={e => onChange(`${value.slice(0,10) || format(new Date(), "yyyy-MM-dd")}T${e.target.value}`)} required={required}/>}
  </div></div>;
}
