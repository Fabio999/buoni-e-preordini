import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
