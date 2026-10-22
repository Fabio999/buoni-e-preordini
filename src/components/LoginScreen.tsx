import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/mana-flask-logo.png.asset.json";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Accesso non riuscito: controlla email e password.");
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <h1 className="sr-only">Mana Flask</h1>
          <img src={logoAsset.url} alt="Mana Flask" className="h-36 w-44 object-contain" />
          <p className="text-sm text-muted-foreground">Gestionale</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Accedi
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          I nuovi accessi si creano dalla sezione Amministrazione.
        </p>
      </div>
    </div>
  );
}
