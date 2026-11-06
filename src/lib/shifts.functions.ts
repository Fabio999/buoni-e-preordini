import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignmentInputSchema, shiftDaySchema, shiftEntrySchema, toAssignmentStatus } from "./shifts";

export const manageShiftCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    action: z.enum(["create", "rename", "rotate", "activate", "delete"]),
    id: z.string().uuid().optional(),
    first_name: z.string().trim().min(1).max(80).optional(),
    last_name: z.string().trim().min(1).max(80).optional(),
    active: z.boolean().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_manager");
    if (roleError || !allowed) throw new Error("Non autorizzato");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const id = data.id;
    if (data.action === "create") {
      if (!data.first_name || !data.last_name) throw new Error("Inserisci nome e cognome");
      // Generate the key before inserting: both are stored atomically by the RPC.
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const { data: created, error } = await admin.rpc("create_shift_collaborator", { _first: data.first_name, _last: data.last_name, _hash: hash });
      if (error) throw new Error(error.message);
      return { id: created, token };
    }
    if (!id) throw new Error("Collaboratore non valido");
    if (data.action === "rotate") {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const { error } = await admin.rpc("rotate_shift_link", { _id: id, _hash: hash });
      if (error) throw new Error(error.message);
      return { id, token };
    }
    if (data.action === "delete") {
      const { error } = await admin.from("shift_collaborators").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      if (data.action === "rename" && (!data.first_name || !data.last_name)) throw new Error("Inserisci nome e cognome");
      const update = data.action === "activate" ? { active: data.active ?? false } : { first_name: data.first_name ?? "", last_name: data.last_name ?? "" };
      const { error } = await admin.from("shift_collaborators").update(update).eq("id", id);
      if (error) throw new Error(error.message);
    }
    return { id, token: null };
  });

export const saveAdminShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => shiftEntrySchema.extend({ collaborator_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_manager");
    if (error || !allowed) throw new Error("Non autorizzato");
    const query = context.supabase.from("shift_availability");
    const result = data.status === null
      ? await query.delete().eq("collaborator_id", data.collaborator_id).eq("day", data.day)
      : await query.upsert({ ...data, status: data.status, updated_at: new Date().toISOString() }, { onConflict: "collaborator_id,day" });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const saveShiftAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.discriminatedUnion("action", [
    z.object({ action: z.literal("save"), entry: assignmentInputSchema }),
    z.object({ action: z.literal("delete"), collaborator_id: z.string().uuid(), day: shiftDaySchema }),
  ]).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_manager");
    if (error || !allowed) throw new Error("Non autorizzato");
    const table = context.supabase.from("shift_assignments");
    const result = data.action === "delete"
      ? await table.delete().eq("collaborator_id", data.collaborator_id).eq("day", data.day)
      : await table.upsert({ ...data.entry, updated_at: new Date().toISOString() }, { onConflict: "collaborator_id,day" });
    if (result.error) throw new Error(result.error.message);
    try {
      const { refreshSheetShifts } = await import("./shift-sheets.server");
      await refreshSheetShifts(context.supabase, data.action === "delete" ? data.collaborator_id : data.entry.collaborator_id);
    } catch (e) { return { ok: true, sheetWarning: `Turno salvato, ma il foglio Google non è stato aggiornato: ${(e as Error).message}` }; }
    return { ok: true, sheetWarning: null };
  });
export const publishShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ from: shiftDaySchema, to: shiftDaySchema }).refine(d => d.from <= d.to, "Periodo non valido").parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_manager");
    if (error || !allowed) throw new Error("Non autorizzato");
    const { data: published, error: publishError } = await context.supabase.rpc("publish_shifts", { _from: data.from, _to: data.to });
    if (publishError) throw new Error(publishError.message);
    const rows = (published ?? []).map(e => ({ ...e, status: toAssignmentStatus(e.status) }));
    const notice = { count: rows.length, mailed: 0, noEmail: [] as string[], errors: [] as string[] };
    if (!rows.length) return notice;
    const { refreshSheetShifts, sendPublicationEmail } = await import("./shift-sheets.server");
    const { data: people, error: peopleError } = await context.supabase.from("shift_collaborators").select("id,first_name,last_name,contact_email,sheet_id,active").in("id", [...new Set(rows.map(r => r.collaborator_id))]);
    if (peopleError) { notice.errors.push(peopleError.message); return notice; }
    for (const person of people ?? []) {
      const name = `${person.first_name} ${person.last_name}`;
      if (!person.active) continue;
      try {
        if (person.sheet_id) await refreshSheetShifts(context.supabase, person.id);
        if (await sendPublicationEmail(person, rows.filter(r => r.collaborator_id === person.id))) notice.mailed++;
        else notice.noEmail.push(name);
      } catch (e) { notice.errors.push(`${name}: ${(e as Error).message}`); }
    }
    await context.supabase.from("shift_sync_runs").insert({ kind: "pubblicazione", status: notice.errors.length ? "con_errori" : "completata", finished_at: new Date().toISOString(), summary: { ...notice, from: data.from, to: data.to }, error: notice.errors.join("\n").slice(0, 4000) });
    return notice;
  });

export const saveWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    save: z.array(assignmentInputSchema).max(500),
    remove: z.array(z.object({ collaborator_id: z.string().uuid(), day: shiftDaySchema })).max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_manager");
    if (error || !allowed) throw new Error("Non autorizzato");
    for (const r of data.remove) {
      const { error: removeError } = await context.supabase.from("shift_assignments").delete().eq("collaborator_id", r.collaborator_id).eq("day", r.day);
      if (removeError) throw new Error(removeError.message);
    }
    if (data.save.length) {
      const now = new Date().toISOString();
      const { error: saveError } = await context.supabase.from("shift_assignments").upsert(data.save.map(e => ({ ...e, updated_at: now })), { onConflict: "collaborator_id,day" });
      if (saveError) throw new Error(saveError.message);
    }
    const { refreshSheetShifts } = await import("./shift-sheets.server");
    const sheetWarnings: string[] = [];
    for (const id of new Set([...data.save, ...data.remove].map(e => e.collaborator_id))) {
      try { await refreshSheetShifts(context.supabase, id); } catch (e) { sheetWarnings.push((e as Error).message); }
    }
    return { saved: data.save.length, removed: data.remove.length, sheetWarnings };
  });
