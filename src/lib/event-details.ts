export const EVENT_DETAIL_FIELDS = [
  { key: "cost", label: "Costo / prezzo", emoji: "🎟️", placeholder: "Es. 40 €" },
  { key: "swiss", label: "Svizzera", emoji: "🃏", placeholder: "Es. 4 round" },
  { key: "topCut", label: "Top Cut", emoji: "🏆", placeholder: "Es. 8 oppure Nessuno" },
  { key: "prizes", label: "Premi", emoji: "🎁", placeholder: "Premi previsti" },
  { key: "materials", label: "Materiale", emoji: "🎒", placeholder: "Kit, mazzi, buste…" },
  { key: "promo", label: "Promo", emoji: "✨", placeholder: "Promo previste oppure Nessuna" },
] as const;
export type EventDetails = Record<(typeof EVENT_DETAIL_FIELDS)[number]["key"], string>;
export function emptyEventDetails(isNew = false): EventDetails {
  return { cost: "", swiss: "", topCut: isNew ? "8" : "", prizes: "", materials: "", promo: "" };
}
const aliases: Record<string, keyof EventDetails> = { costo: "cost", prezzo: "cost", "costo / prezzo": "cost", svizzera: "swiss", "top cut": "topCut", premi: "prizes", materiale: "materials", promo: "promo" };
export function parseEventDescription(value: string | null | undefined) {
  const details = emptyEventDetails();
  const notes: string[] = [];
  for (const line of (value ?? "").split("\n")) {
    const match = line.match(/^\s*(?:[^\p{L}\p{N}]*)(costo\s*\/\s*prezzo|costo|prezzo|svizzera|top cut|premi|materiale|promo)\s*:\s*(.*)$/iu);
    const key = match ? aliases[match[1].toLowerCase().replace(/\s+/g, " ")] : undefined;
    if (key && match) details[key] = match[2].trim() === "Da definire" ? "" : match[2].trim();
    else notes.push(line);
  }
  return { details, notes: notes.join("\n").trim() };
}
export function formatEventDescription(details: EventDetails, notes: string) {
  const list = EVENT_DETAIL_FIELDS.map(field => `${field.emoji} ${field.label}: ${details[field.key].trim() || "Da definire"}`).join("\n");
  return [list, notes.trim()].filter(Boolean).join("\n\n");
}