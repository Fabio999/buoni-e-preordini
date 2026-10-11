import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "@/lib/admin.functions";
import { useIsAdmin } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/amministrazione")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Amministrazione — Mana Flask" },
      { name: "description", content: "Gestione degli accessi al gestionale Mana Flask." },
      { property: "og:title", content: "Amministrazione — Mana Flask" },
      { property: "og:description", content: "Gestione degli accessi al gestionale Mana Flask." },
    ],
  }),
  component: AdminPage,
});

type Account = Awaited<ReturnType<typeof listAccounts>>[number];

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (isLoading) return null;
  if (!isAdmin)
    return <p className="text-muted-foreground">Solo l'account amministratore può vedere questa pagina.</p>;
  return <Accounts />;
}

function Accounts() {
  const list = useServerFn(listAccounts);
  const del = useServerFn(deleteAccount);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => list() });
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [names, setNames] = useState<Account | null>(null);

  async function remove(a: Account) {
    if (!confirm(`Eliminare l'accesso ${a.email}?`)) return;
    try {
      await del({ data: { id: a.id } });
      toast.success("Accesso eliminato");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Amministrazione"
        subtitle="Email e password per entrare nel gestionale"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Nuovo accesso
          </Button>
        }
      />
      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          {data.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {a.email}
                  {a.is_admin && <Badge variant="info">Amministratore</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ultimo accesso: {a.last_sign_in_at ? fmtDateTime(a.last_sign_in_at) : "mai"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" aria-label="Nomi operatori" onClick={() => setNames(a)}>
                  <Users className="h-4 w-4" /> Nomi
                </Button>
                <Button size="icon" variant="ghost" aria-label="Modifica accesso" onClick={() => setEditing(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!a.is_me && (
                  <Button size="icon" variant="ghost" aria-label="Elimina accesso" onClick={() => remove(a)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {names && <NamesDialog account={names} onClose={() => setNames(null)} />}
      {editing && <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const create = useServerFn(createAccount);
  const update = useServerFn(updateAccount);
  const qc = useQueryClient();
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (account) await update({ data: { id: account.id, email, password } });
      else await create({ data: { email, password } });
      toast.success(account ? "Accesso aggiornato" : "Accesso creato");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Modifica accesso" : "Nuovo accesso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="acc-email">Email</Label>
            <Input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc-pw">{account ? "Nuova password (lascia vuoto per non cambiarla)" : "Password"}</Label>
            <Input id="acc-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={!account} minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>Salva</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NamesDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["account-operators", account.id];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_operators")
        .select("*")
        .eq("user_id", account.id)
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!first.trim() || !last.trim()) return;
    const { error } = await supabase
      .from("account_operators")
      .insert({ user_id: account.id, first_name: first.trim(), last_name: last.trim() });
    if (error) { toast.error(error.message); return; }
    setFirst("");
    setLast("");
    qc.invalidateQueries({ queryKey: key });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("account_operators").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chi lavora con {account.email}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          All'accesso basterà toccare il proprio nome invece di scriverlo.
        </p>
        <ul className="divide-y rounded-lg border">
          {!data.length && <li className="px-3 py-2 text-sm text-muted-foreground">Nessun nome inserito</li>}
          {data.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
              {o.first_name} {o.last_name}
              <Button size="icon" variant="ghost" aria-label="Elimina nome" onClick={() => remove(o.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input aria-label="Nome" placeholder="Nome" value={first} onChange={(e) => setFirst(e.target.value)} />
          <Input aria-label="Cognome" placeholder="Cognome" value={last} onChange={(e) => setLast(e.target.value)} />
          <Button type="submit"><Plus className="h-4 w-4" /> Aggiungi</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
