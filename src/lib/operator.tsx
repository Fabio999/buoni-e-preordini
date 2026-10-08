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

  useEffect(() => {
    const stored = localStorage.getItem(key(userId));
    if (stored) {
      setName(stored);
      void supabase.from("operator_sessions").upsert({ user_id: userId, operator_name: stored });
    }
    setReady(true);
  }, [userId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const full = `${first.trim()} ${last.trim()}`.trim();
    if (!first.trim() || !last.trim()) return;
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
        <div className="space-y-1">
          <Label htmlFor="op-first">Nome</Label>
          <Input id="op-first" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-last">Cognome</Label>
          <Input id="op-last" value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Inizia</Button>
        <button type="button" onClick={() => signOutOperator()} className="w-full text-sm text-muted-foreground hover:text-foreground">
          Esci
        </button>
      </form>
    </div>
  );
}
