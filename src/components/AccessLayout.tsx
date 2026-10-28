import type { ReactNode } from "react";
import { Check, UserRound } from "lucide-react";
import logoAsset from "@/assets/mana-flask-logo.png.asset.json";

export function OperatorPreview({ name, pending = false }: { name: string; pending?: boolean }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("it");
  return (
    <div className="flex min-w-0 items-center gap-3 text-left">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {initials || <UserRound className="size-4" aria-hidden="true" />}
        <span aria-hidden="true" className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-card ${pending ? "bg-muted-foreground" : "bg-success"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">Operatore</p>
        <p className="break-words text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{name || "Da selezionare"}</p>
      </div>
    </div>
  );
}

export function AccessLayout({ step, title, children }: { step: 1 | 2; title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto my-auto w-full max-w-md">
        <header className="mb-7 flex flex-col items-center gap-2">
          <img src={logoAsset.url} alt="Mana Flask" className="h-28 w-52 object-contain sm:h-32" />
          <p className="text-xs font-semibold text-muted-foreground">Gestionale del negozio</p>
        </header>
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="h-1 bg-primary" />
          <div className="p-6 sm:p-8">
            <ol aria-label="Passaggi di accesso" className="mb-7 flex items-center gap-3 text-xs font-medium">
              <li className={`flex shrink-0 items-center gap-2 ${step === 1 ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`grid size-6 place-items-center rounded-full ${step === 1 ? "bg-primary/10" : "bg-success/10 text-success"}`}>{step === 2 ? <Check className="size-3.5" aria-hidden="true" /> : "1"}</span>
                Accesso
              </li>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              <li className={`flex shrink-0 items-center gap-2 ${step === 2 ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`grid size-6 place-items-center rounded-full ${step === 2 ? "bg-primary/10" : "bg-muted"}`}>2</span>
                Operatore
              </li>
            </ol>
            <h1 className="mb-6 break-words text-xl font-semibold tracking-normal sm:text-2xl">{title}</h1>
            {children}
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted-foreground">Mana Flask · Area riservata</p>
      </div>
    </main>
  );
}