import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Non autorizzato");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const admins = new Set((roles ?? []).map((r) => r.user_id));
    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_admin: admins.has(u.id),
      is_me: u.id === context.userId,
    }));
  });

const validate = (email: string, password?: string) => {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email non valida");
  if (password !== undefined && password.length > 0 && password.length < 6)
    throw new Error("La password deve avere almeno 6 caratteri");
};

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    validate(data.email, data.password);
    if (!data.password) throw new Error("Inserisci una password");
    const admin = await assertAdmin(context);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    if (created.user) {
      const { error: sErr } = await admin.from("staff_members").insert({ user_id: created.user.id });
      if (sErr) throw new Error("Accesso creato ma non abilitato: riprova");
    }
    return { ok: true };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; email: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    validate(data.email, data.password);
    const admin = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.id, {
      email: data.email.trim(),
      email_confirm: true,
      ...(data.password ? { password: data.password } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.id === context.userId) throw new Error("Non puoi eliminare il tuo accesso");
    const admin = await assertAdmin(context);
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
