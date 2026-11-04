import { normalizeText } from "./search";
import { EVENT_COLORS } from "./planning";

export const DEFAULT_GAME_COLORS: Record<string, string> = {
  riftbound: "arancione",
  cyberpunk: "rosa",
  "magic: the gathering": "blu",
  magic: "blu",
  pokemon: "giallo",
  "one piece": "rosso",
  "yu-gi-oh!": "viola",
  "yu-gi-oh": "viola",
  lorcana: "turchese",
};
const KEY = "mf-game-colors";
const valid = (c: unknown): c is string => typeof c === "string" && EVENT_COLORS.some(e => e.value === c);

function readSaved(): Record<string, string> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, c]) => valid(c))) : {}; } catch { return {}; }
}
/** Colore associato a un gioco: prima quello salvato, poi il predefinito. */
export function gameColor(game: string): string | null {
  const key = normalizeText(game.trim());
  if (!key) return null;
  return readSaved()[key] ?? DEFAULT_GAME_COLORS[key] ?? null;
}
export function rememberGameColor(game: string, color: string) {
  const key = normalizeText(game.trim());
  if (!key || !valid(color)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), [key]: color })); } catch { /* facoltativo */ }
}
/** Legenda: per ogni gioco presente, il colore più usato. */
export function gameLegend(events: { game: string | null; color: string | null }[]) {
  const map = new Map<string, { label: string; counts: Map<string, number> }>();
  for (const e of events) {
    const label = (e.game ?? "").trim(); if (!label || !e.color) continue;
    const k = normalizeText(label); const item = map.get(k) ?? { label, counts: new Map() };
    item.counts.set(e.color, (item.counts.get(e.color) ?? 0) + 1); map.set(k, item);
  }
  return [...map.values()].map(({ label, counts }) => ({ game: label, color: [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "blu" })).sort((a, b) => a.game.localeCompare(b.game, "it"));
}
