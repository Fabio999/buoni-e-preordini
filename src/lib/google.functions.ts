import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { googleFetch } from "./google.server";

type Result = { ok: true; value: string } | { ok: false; error: string };

async function attempt(fn: () => Promise<string>): Promise<Result> {
  try { return { ok: true, value: await fn() }; }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}

export const googleConnectionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Non autorizzato");
    const [gmail, drive, sheets] = await Promise.all([
      attempt(async () => ((await (await googleFetch("gmail", "/users/me/profile")).json()) as { emailAddress: string }).emailAddress),
      attempt(async () => ((await (await googleFetch("drive", "/about?fields=user")).json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? "ok"),
      attempt(async () => {
        try { await googleFetch("sheets", "/spreadsheets/foglio-inesistente-prova"); return "ok"; }
        catch (e) {
          const m = (e as Error).message;
          // 404 = token accettato, foglio semplicemente inesistente
          if (m.includes("[404]")) return "ok (404 atteso)";
          throw e;
        }
      }),
    ]);
    return { gmail, drive, sheets };
  });
