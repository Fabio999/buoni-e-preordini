import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/mana-flask-logo.png.asset.json";

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("Accesso non riuscito: controlla email e password.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Controlla la tua email per confermare l'account.");
    }
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
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
            {mode === "login" ? "Accedi" : "Crea account"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "Primo accesso? Crea un account" : "Hai già un account? Accedi"}
        </button>
      </div>
    </div>
  );
}
