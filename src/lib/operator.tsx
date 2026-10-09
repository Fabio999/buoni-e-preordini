import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/mana-flask-logo.png.asset.json";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <img src={logoAsset.url} alt="Mana Flask" className="mx-auto h-20 object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-semibold">Chi sta lavorando?</h1>
          <p className="text-sm text-muted-foreground">Il tuo nome verrà registrato sulle operazioni.</p>
        </div>
        {saved.length > 0 && !manual ? (
          <div className="space-y-2">
            {saved.map((o) => (
              <Button key={o.id} type="button" variant="outline" className="w-full" disabled={busy}
                onClick={() => choose(`${o.first_name} ${o.last_name}`)}>
                {o.first_name} {o.last_name}
              </Button>
            ))}
            <button type="button" onClick={() => setManual(true)} className="w-full text-sm text-primary hover:underline">
              Non sono in elenco
            </button>
          </div>
        ) : (<>
        <div className="space-y-1">
          <Label htmlFor="op-first">Nome</Label>
          <Input id="op-first" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-last">Cognome</Label>
          <Input id="op-last" value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Inizia</Button>
        </>)}
        <button type="button" onClick={() => signOutOperator()} className="w-full text-sm text-muted-foreground hover:text-foreground">
          Esci
        </button>
      </form>
    </div>
  );
}
