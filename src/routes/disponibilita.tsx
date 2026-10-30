import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MonthControls, ShiftCalendar, ShiftEditDialog, ShiftLegend } from "@/components/shifts/ShiftCalendar";
import { type Collaborator, type ShiftEntry, type ShiftStatus } from "@/lib/shifts";
import logo from "@/assets/mana-flask-logo.png.asset.json";

export const Route = createFileRoute("/disponibilita")({
  head: () => ({ meta: [
    { title: "Le mie disponibilità — Mana Flask" }, { name: "description", content: "Calendario personale riservato delle disponibilità Mana Flask." },
    { property: "og:title", content: "Le mie disponibilità — Mana Flask" }, { property: "og:description", content: "Calendario personale riservato delle disponibilità Mana Flask." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }, { name: "referrer", content: "no-referrer" },
  ] }), component: PersonalShifts,
});

function PersonalShifts() {
  const [token, setToken] = useState<string | null>(null);
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM"));
  const [editing, setEditing] = useState<string | null>(null);
  const qc = useQueryClient();
  // Fragment never reaches web servers or referrer headers.
  useEffect(() => { setToken(window.location.hash.slice(1)); }, []);
  const key = ["personal-shifts", token, month];
  async function call(entry?: { day: string; status: ShiftStatus | null; note: string }): Promise<{ person: Collaborator; entries: ShiftEntry[] }> {
    const res = await fetch("/api/public/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, month, entry }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Impossibile caricare i turni");
    return body;
  }
  const query = useQuery({ queryKey: key, queryFn: () => call(), enabled: !!token, retry: false, staleTime: 300000 });
  const topic = query.data?.person.realtime_topic;
  useEffect(() => {
    if (!topic) return;
    // Opaque 256-bit topic; broadcast carries no names, notes or dates.
    const channel = supabase.channel(`shift:${topic}`).on("broadcast", { event: "refresh" }, () => { qc.invalidateQueries({ queryKey: ["personal-shifts", token] }); }).subscribe(status => {
      if (status === "SUBSCRIBED") qc.invalidateQueries({ queryKey: ["personal-shifts", token] });
    });
    return () => { void supabase.removeChannel(channel); };
  }, [topic, token, qc]);
  const person = query.data?.person;
  const name = person ? `${person.first_name} ${person.last_name}` : "";
  async function save(entry: { day: string; status: ShiftStatus | null; note: string }) {
    try { const result = await call(entry); qc.setQueryData(key, result); toast.success("Disponibilità salvata"); }
    catch (error) { toast.error((error as Error).message); throw error; }
  }
  return <main className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6 sm:py-10"><header className="mb-8 flex items-center justify-between gap-4 border-b pb-5"><img src={logo.url} alt="Mana Flask" className="h-16 w-36 object-contain" /><span className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4" />Area personale</span></header><div className="mb-6"><span className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-info/10 text-info"><CalendarClock /></span><h1 className="text-2xl font-semibold">Le mie disponibilità</h1>{name && <p className="mt-2 break-words text-lg text-muted-foreground">{name}</p>}</div>{token === null || query.isLoading ? <p className="py-8 text-muted-foreground">Caricamento…</p> : !token || query.error ? <div className="space-y-4 py-8"><p className="text-destructive">{query.error?.message ?? "Link personale mancante. Richiedilo all’amministrazione."}</p>{token && <Button variant="outline" onClick={() => query.refetch()}>Riprova</Button>}</div> : person && <><div className="mb-6"><ShiftLegend /></div><MonthControls month={month} onChange={setMonth} /><ShiftCalendar month={month} entries={query.data?.entries ?? []} onEdit={setEditing} />{editing && <ShiftEditDialog day={editing} name={name} entry={query.data?.entries.find(e => e.day === editing)} onClose={() => setEditing(null)} onSave={save} />}</>}</main>;
}