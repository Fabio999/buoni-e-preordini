import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { AccessLayout, OperatorPreview } from "@/components/AccessLayout";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Accesso non riuscito: controlla email e password.");
    setBusy(false);
  };

  return (
    <AccessLayout step={1} title="Accedi al negozio">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" className="h-11" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <div className="relative">
              <Input
              id="pw"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 pr-12"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9 text-muted-foreground" aria-label={visible ? "Nascondi password" : "Mostra password"} title={visible ? "Nascondi password" : "Mostra password"} onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <Button type="submit" className="h-11 w-full gap-2" disabled={busy}>
            {busy ? "Accesso in corso…" : "Accedi"}
            {busy ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <ArrowRight className="size-4" />}
          </Button>
        </form>
        <div className="mt-6 border-t pt-5"><OperatorPreview name="" pending /></div>
    </AccessLayout>
  );
}
