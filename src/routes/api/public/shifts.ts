import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { monthBounds, shiftEntrySchema, shiftMonthSchema, shiftTokenSchema } from "@/lib/shifts";

export const Route = createFileRoute("/api/public/shifts")({
  server: { handlers: { POST: async ({ request }) => {
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
    // All secrets travel in POST bodies, never in API query strings or logs.
    try {
      if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Richiesta non consentita" }, { status: 403, headers });
      const raw = await request.text();
      if (raw.length > 6000) return Response.json({ error: "Richiesta troppo grande" }, { status: 413, headers });
      const data = z.object({ token: shiftTokenSchema, month: shiftMonthSchema, entry: shiftEntrySchema.optional() }).parse(JSON.parse(raw));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { data: key, error: keyError } = await admin.from("shift_link_keys").select("collaborator_id").eq("token_hash", hash).maybeSingle();
      if (keyError) throw keyError;
      if (!key) return Response.json({ error: "Link non valido o disattivato" }, { status: 403, headers });
      const { data: person, error: personError } = await admin.from("shift_collaborators").select("id,first_name,last_name,active,realtime_topic").eq("id", key.collaborator_id).eq("active", true).maybeSingle();
      if (personError) throw personError;
      if (!person) return Response.json({ error: "Link non valido o disattivato" }, { status: 403, headers });
      if (data.entry) {
        const { error } = await admin.rpc("save_personal_shift", { _hash: hash, _day: data.entry.day, _status: data.entry.status as string, _note: data.entry.note });
        if (error) throw error;
      }
      const { first, last } = monthBounds(data.month);
      const { data: entries, error } = await admin.from("shift_availability").select("*").eq("collaborator_id", person.id).gte("day", first).lte("day", last);
      if (error) throw error;
      return Response.json({ person, entries: entries ?? [] }, { headers });
    } catch (error) {
      return Response.json({ error: error instanceof z.ZodError ? "Dati non validi" : "Impossibile aggiornare i turni. Riprova." }, { status: error instanceof z.ZodError ? 400 : 503, headers });
    }
  } } },
});