import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const message = (error: unknown) => (error as Error).message;

export const createShiftSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Non autorizzato");
    const { createPersonSheet } = await import("./shift-sheets.server");
    return { sheetId: await createPersonSheet(context.supabase, data.id) };
  });

export const syncShiftSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data: allowed, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Non autorizzato");
    const { syncPersonSheet } = await import("./shift-sheets.server");
    const { data: people, error: peopleError } = await db.from("shift_collaborators").select("id,first_name,last_name,contact_email,sheet_id").eq("active", true).neq("sheet_id", "").order("last_name");
    if (peopleError) throw new Error(peopleError.message);
    const { data: run } = await db.from("shift_sync_runs").insert({ kind: "importazione" }).select("id").single();
    const summary = { people: 0, changed: 0, invalid: [] as string[], late: [] as string[], errors: [] as string[] };
    for (const person of people ?? []) {
      const name = `${person.first_name} ${person.last_name}`;
      try {
        const result = await syncPersonSheet(db, person);
        summary.people++; summary.changed += result.changed;
        summary.invalid.push(...result.invalid.map(i => `${name} — ${i}`));
        if (result.late.length) summary.late.push(`${name} — ${result.late.join(", ")}`);
      } catch (e) { summary.errors.push(`${name}: ${message(e)}`); }
    }
    if (run) await db.from("shift_sync_runs").update({ status: summary.errors.length ? (summary.people ? "con_errori" : "fallita") : "completata", finished_at: new Date().toISOString(), summary, error: summary.errors.join("\n").slice(0, 4000) }).eq("id", run.id);
    return summary;
  });
