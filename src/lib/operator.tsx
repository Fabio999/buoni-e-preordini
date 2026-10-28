import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessLayout, OperatorPreview } from "@/components/AccessLayout";
import { ArrowRight, LoaderCircle } from "lucide-react";

const key = (uid: string) => `mf-operator:${uid}`;
const OperatorContext = createContext<string>("");
export const useOperator = () => useContext(OperatorContext);

/** Clears the operator name, then signs out: next login asks for it again. */
export async function signOutOperator() {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    localStorage.removeItem(key(data.user.id));
    await supabase.from("operator_sessions").delete().eq("user_id", data.user.id);
  }
  await supabase.auth.signOut();
}

export function OperatorGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key(userId));
    if (stored) {
      setName(stored);
      void supabase.from("operator_sessions").upsert({ user_id: userId, operator_name: stored });
    }
    supabase
      .from("account_operators")
      .select("id, first_name, last_name")
      .eq("user_id", userId)
      .order("first_name")
      .then(({ data }) => {
        setSaved(data ?? []);
        setReady(true);
      });
  }, [userId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return;
    await choose(`${first.trim()} ${last.trim()}`);
  }

  async function choose(full: string) {
    setBusy(true);
    const { error } = await supabase
      .from("operator_sessions")
      .upsert({ user_id: userId, operator_name: full, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return;
    localStorage.setItem(key(userId), full);
    setName(full);
  }

  if (!ready) return null;
  if (name) return <OperatorContext.Provider value={name}>{children}</OperatorContext.Provider>;
  return (
    <AccessLayout step={2} title="Chi sta lavorando?">
      <form onSubmit={submit} className="space-y-5">
        {saved.length > 0 && !manual ? (
          <div className="space-y-2">
            {saved.map((o) => (
              <Button key={o.id} type="button" variant="outline" className="h-auto min-h-16 w-full justify-start whitespace-normal px-3 py-3" disabled={busy}
                onClick={() => choose(`${o.first_name} ${o.last_name}`)}>
                <OperatorPreview name={`${o.first_name} ${o.last_name}`} />
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            ))}
            <Button type="button" variant="ghost" onClick={() => setManual(true)} className="w-full text-sm text-primary">
              Non sono in elenco
            </Button>
          </div>
        ) : (<>
        <div className="space-y-1">
          <Label htmlFor="op-first">Nome</Label>
          <Input id="op-first" autoComplete="given-name" className="h-11" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-last">Cognome</Label>
          <Input id="op-last" autoComplete="family-name" className="h-11" value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <div className="border-y py-4" aria-live="polite"><OperatorPreview name={`${first.trim()} ${last.trim()}`.trim()} pending={!first.trim() || !last.trim()} /></div>
        <Button type="submit" className="h-11 w-full gap-2" disabled={busy}>{busy ? "Accesso in corso…" : "Inizia"}{busy ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <ArrowRight className="size-4" />}</Button>
        {saved.length > 0 && <Button type="button" variant="ghost" className="w-full" onClick={() => setManual(false)}>Torna ai nomi salvati</Button>}
        </>)}
        <Button type="button" variant="ghost" disabled={busy} onClick={() => signOutOperator()} className="w-full text-sm text-muted-foreground">
          Esci
        </Button>
      </form>
    </AccessLayout>
  );
}
