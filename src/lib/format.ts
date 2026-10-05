import type { Database } from "@/integrations/supabase/types";

export type EventStatus = Database["public"]["Enums"]["event_status"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type MovementType = Database["public"]["Enums"]["movement_type"];

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export const euro = (n: number | string | null | undefined) => eur.format(Number(n ?? 0));

export const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const EVENT_STATUS: Record<
  EventStatus,
  { label: string; variant: "info" | "action" | "success" }
> = {
  programmato: { label: "Programmato", variant: "info" },
  in_preparazione: { label: "In preparazione", variant: "action" },
  concluso: { label: "Concluso", variant: "success" },
};

export const BOOKING_STATUS: Record<
  BookingStatus,
  { label: string; variant: "action" | "info" | "success" | "neutral" }
> = {
  da_preparare: { label: "Da preparare", variant: "action" },
  pronta: { label: "Pronta", variant: "info" },
  consegnata: { label: "Consegnata", variant: "success" },
  annullata: { label: "Annullata", variant: "neutral" },
};

export const MOVEMENT_TYPE: Record<
  MovementType,
  { label: string; variant: "success" | "danger" | "info" }
> = {
  ricarica: { label: "Ricarica", variant: "success" },
  acquisto: { label: "Acquisto", variant: "danger" },
  correzione: { label: "Correzione", variant: "info" },
};

export const CHECKLIST_CATEGORIES = [
  "Prodotti",
  "Materiale stand",
  "Espositori",
  "POS",
  "Contanti",
  "Materiale promozionale",
  "Documenti",
  "Altro",
];

export const fullName = (c?: { first_name: string; last_name: string } | null) =>
  c ? `${c.first_name} ${c.last_name}` : "—";
