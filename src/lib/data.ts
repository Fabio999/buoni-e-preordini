import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export const useTasks = () => useQuery({ queryKey: ["company-tasks"], queryFn: async () => unwrap(await supabase.from("company_tasks").select("*").order("created_at", { ascending: false })) });
export const useCalendarEntries = () => useQuery({ queryKey: ["calendar-entries"], queryFn: async () => unwrap(await supabase.from("calendar_entries").select("*").order("starts_at")) });
export const usePlanningHistory = (type: string, id: string) => useQuery({ queryKey: ["planning-history", type, id], enabled: !!id, queryFn: async () => unwrap(await supabase.from("planning_history").select("*").eq("entity_type", type).eq("entity_id", id).order("created_at", { ascending: false })) });
export type EventRow = Tables<"events">;
export type Product = Tables<"products">;
export type Movement = Tables<"balance_movements">;
export type Purchase = Tables<"purchases">;
export type ChecklistItem = Tables<"checklist_items">;
export type BookingItem = Tables<"booking_items"> & {
  products: { name: string; category: string } | null;
};
export type Booking = Tables<"bookings"> & {
  clients: { id: string; first_name: string; last_name: string } | null;
  events: { id: string; name: string; event_date: string } | null;
  booking_items: BookingItem[];
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const useClients = () =>
  useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      unwrap(await supabase.from("clients").select("*").order("last_name").order("first_name")),
  });

export const useEvents = () =>
  useQuery({
    queryKey: ["events"],
    queryFn: async () =>
      unwrap(await supabase.from("events").select("*").order("event_date", { ascending: false })),
  });

export const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: async () => unwrap(await supabase.from("products").select("*").order("name")),
  });

export const useBookings = () =>
  useQuery({
    queryKey: ["bookings"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("bookings")
          .select(
            "*, clients(id, first_name, last_name), events(id, name, event_date), booking_items(*, products(name, category))",
          )
          .order("created_at", { ascending: false }),
      ) as unknown as Booking[],
  });

export const useMovements = () =>
  useQuery({
    queryKey: ["movements"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("balance_movements")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
  });

export const usePurchases = () =>
  useQuery({
    queryKey: ["purchases"],
    queryFn: async () =>
      unwrap(
        await supabase.from("purchases").select("*").order("created_at", { ascending: false }),
      ),
  });

export const useChecklist = (eventId: string) =>
  useQuery({
    queryKey: ["checklist", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("checklist_items")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at"),
      ),
  });

export const useRefresh = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
};

export const bookingSubtotal = (b: Pick<Booking, "booking_items">) =>
  b.booking_items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

/** Final total = items subtotal minus the booking discount (in euro). */
export const bookingTotal = (b: Pick<Booking, "booking_items"> & { discount?: number | null }) =>
  Math.max(0, bookingSubtotal(b) - Number(b.discount ?? 0));

/** Discount percentage from subtotal and discount amount, rounded to 2 decimals. */
export const discountPercent = (subtotal: number, discount: number) =>
  subtotal > 0 ? Math.round((discount / subtotal) * 10000) / 100 : 0;

/**
 * Splits a sale between buono and cash: the buono used is capped at the sale
 * total and at the available balance, so the buono can never go negative.
 */
export function saleSplit(total: number, buono: number, requested: number) {
  const used = Math.min(Math.max(0, requested), Math.max(0, total), Math.max(0, buono));
  return { used, toPay: Math.max(0, total) - used, remaining: Math.max(0, buono) - used };
}

/** Latest balance per client, derived from the movement ledger. */
export function balancesByClient(movements: Movement[] | undefined) {
  const map = new Map<string, { balance: number; loaded: number; used: number }>();
  // movements are newest-first
  for (const m of movements ?? []) {
    const cur = map.get(m.client_id);
    const amt = Number(m.amount);
    if (!cur) {
      map.set(m.client_id, {
        balance: Number(m.balance_after),
        loaded: amt > 0 ? amt : 0,
        used: m.type === "acquisto" ? -amt : 0,
      });
    } else {
      if (amt > 0) cur.loaded += amt;
      if (m.type === "acquisto") cur.used += -amt;
    }
  }
  return map;
}

export function errMsg(e: unknown) {
  const msg = e instanceof Error ? e.message :
    typeof e === "object" && e !== null && "message" in e ? String(e.message) : String(e);
  if (msg.includes("clients_unique_name"))
    return "Esiste già un cliente con questo nome e cognome.";
  if (msg.includes("violates foreign key"))
    return "Elemento collegato ad altri dati: non può essere eliminato.";
  return msg;
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return !!data;
    },
  });
}
