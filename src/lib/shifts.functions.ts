import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignmentInputSchema, shiftDaySchema, shiftEntrySchema } from "./shifts";

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
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Non autorizzato");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    let id = data.id;
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
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
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
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Non autorizzato");
    const table = context.supabase.from("shift_assignments");
    const result = data.action === "delete"
      ? await table.delete().eq("collaborator_id", data.collaborator_id).eq("day", data.day)
      : await table.upsert({ ...data.entry, updated_at: new Date().toISOString() }, { onConflict: "collaborator_id,day" });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });