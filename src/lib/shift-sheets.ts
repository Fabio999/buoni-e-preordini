import { formatInTimeZone } from "date-fns-tz";
import { addDays, format, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { assignmentTime, isAvailabilityLocked, SHIFT_STATUSES, type ShiftAssignment, type ShiftEntry, type ShiftStatus } from "./shifts";

export const SHEET_HEADER = ["Data", "Giorno", "Disponibilità", "Nota", "Turno"];
export const SHEET_WEEKS = 5;
export const SHEET_MAX_ROWS = 400;
export const SHEET_PROTECTION = "mana-flask: solo Disponibilità e Nota delle settimane aperte";

export function sheetUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}

// From the Monday of the current week (Rome), so the running week stays visible but locked.
export function sheetWindow(now = new Date(), weeks = SHEET_WEEKS) {
  const today = new Date(`${formatInTimeZone(now, "Europe/Rome", "yyyy-MM-dd")}T12:00:00`);
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: weeks * 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
}

export function sheetDate(day: string) {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

export function parseSheetDate(value: string) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value);
  if (!m) return null;
  const day = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const d = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day ? day : null;
}

export function shiftCell(entry: Pick<ShiftAssignment, "status" | "starts_at" | "ends_at" | "ends_next_day" | "note"> | undefined) {
  if (!entry || entry.status === "bozza") return "";
  return `${assignmentTime(entry)}${entry.status === "modificato" ? " (modificato)" : ""}${entry.note ? ` — ${entry.note}` : ""}`;
}

export function sheetRows(days: string[], entries: Pick<ShiftEntry, "day" | "status" | "note">[], assignments: ShiftAssignment[]) {
  const byDay = new Map(entries.map(e => [e.day, e]));
  const shifts = new Map(assignments.map(a => [a.day, a]));
  return [SHEET_HEADER, ...days.map(day => {
    const entry = byDay.get(day);
    return [sheetDate(day), format(new Date(`${day}T12:00:00`), "EEEE", { locale: it }), SHIFT_STATUSES.find(s => s.value === entry?.status)?.label ?? "", entry?.note ?? "", shiftCell(shifts.get(day))];
  })];
}

export function shiftColumn(dates: string[][], assignments: ShiftAssignment[]) {
  const shifts = new Map(assignments.map(a => [a.day, a]));
  return dates.map(row => {
    const day = parseSheetDate(row[0] ?? "");
    return [day ? shiftCell(shifts.get(day)) : ""];
  });
}

function statusFromLabel(label: string): ShiftStatus | "" | undefined {
  const clean = label.trim().toLowerCase();
  if (!clean || clean === "da inserire") return "";
  return SHIFT_STATUSES.find(s => s.label.toLowerCase() === clean || s.value === clean)?.value;
}

type SheetRow = { day: string; status: ShiftStatus | ""; note: string };
export type SheetImport = { rows: SheetRow[]; invalid: string[]; locked: SheetRow[] };

// Locked weeks are never imported: after the Friday deadline the sheet no longer counts.
export function parseSheetRows(values: string[][], now = new Date()): SheetImport {
  const result: SheetImport = { rows: [], invalid: [], locked: [] };
  const seen = new Set<string>();
  for (const row of values) {
    const day = parseSheetDate(row[0] ?? "");
    if (!day || seen.has(day)) continue;
    seen.add(day);
    const status = statusFromLabel(row[2] ?? "");
    const locked = isAvailabilityLocked(day, now);
    if (status === undefined) { if (!locked) result.invalid.push(`${sheetDate(day)}: «${(row[2] ?? "").trim()}»`); continue; }
    (locked ? result.locked : result.rows).push({ day, status, note: (row[3] ?? "").trim().slice(0, 1000) });
  }
  return result;
}

// Edits to closed weeks are discarded by the next rewrite, so the admin is told which days changed.
export function lateEdits(locked: SheetRow[], entries: Pick<ShiftEntry, "day" | "status" | "note">[]) {
  const byDay = new Map(entries.map(e => [e.day, e]));
  return locked.filter(r => { const e = byDay.get(r.day); return (e?.status ?? "") !== r.status || (e?.note ?? "") !== r.note; }).map(r => sheetDate(r.day));
}

// Open days are always the tail of the window, so one unprotected block is enough.
export function sheetFormatRequests(days: string[], oldProtections: number[], now = new Date()) {
  const firstOpen = days.findIndex(day => !isAvailabilityLocked(day, now));
  const lastRow = days.length + 1;
  return [
    ...oldProtections.map(protectedRangeId => ({ deleteProtectedRange: { protectedRangeId } })),
    { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
    { setDataValidation: { range: { sheetId: 0, startRowIndex: 1, endRowIndex: lastRow, startColumnIndex: 2, endColumnIndex: 3 }, rule: { condition: { type: "ONE_OF_LIST", values: SHIFT_STATUSES.map(s => ({ userEnteredValue: s.label })) }, strict: true, showCustomUi: true } } },
    { addProtectedRange: { protectedRange: { range: { sheetId: 0 }, description: SHEET_PROTECTION, warningOnly: false, unprotectedRanges: firstOpen < 0 ? [] : [{ sheetId: 0, startRowIndex: firstOpen + 1, endRowIndex: lastRow, startColumnIndex: 2, endColumnIndex: 4 }] } } },
    { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 5 } } },
  ];
}

function base64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
const utf8 = (text: string) => base64(new TextEncoder().encode(text));

export function publicationEmail({ to, firstName, shifts, link }: { to: string; firstName: string; shifts: ShiftAssignment[]; link: string | null }) {
  const lines = [...shifts].sort((a, b) => a.day.localeCompare(b.day)).map(s => `- ${format(new Date(`${s.day}T12:00:00`), "EEEE d MMMM", { locale: it })}: ${assignmentTime(s)}${s.note ? ` (${s.note})` : ""}`);
  const body = [`Ciao ${firstName},`, "", "questi sono i tuoi turni confermati:", "", ...lines, "", ...(link ? ["Li trovi anche nel tuo foglio:", link, ""] : []), "Mana Flask"].join("\r\n");
  const message = [
    `To: ${to.replace(/[\r\n<>]/g, "")}`,
    `Subject: =?UTF-8?B?${utf8("Mana Flask — i tuoi turni")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    (utf8(body).match(/.{1,76}/g) ?? []).join("\r\n"),
  ].join("\r\n");
  return utf8(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
