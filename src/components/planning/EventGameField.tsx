import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCalendarEntries, useProducts } from "@/lib/data";
import { mergeGames, readGames } from "@/lib/event-recurrence";
import { Field } from "@/components/forms/SimpleDialogs";
import { Input } from "@/components/ui/input";

export function EventGameField({ value, onChange, open }: { value: string; onChange: (value: string) => void; open: boolean }) {
  const { session } = useAuth();
  const { data: events = [] } = useCalendarEntries(), { data: products = [] } = useProducts();
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => { setSaved(session ? readGames(session.user.id) : []); }, [open, session?.user.id]);
  const games = mergeGames(saved, events.map(e => e.game), products.map(p => p.game));
  return <Field label="Gioco"><Input aria-label="Gioco evento" list="event-games" placeholder="Es. Magic, Pokémon, Riftbound…" value={value} onChange={e => onChange(e.target.value)}/><datalist id="event-games">{games.map(game => <option key={game} value={game}/>)}</datalist></Field>;
}