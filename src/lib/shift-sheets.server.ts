import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { googleFetch } from "./google.server";
import { toAssignmentStatus, type ShiftAssignment } from "./shifts";
import { lateEdits, parseSheetDate, parseSheetRows, publicationEmail, SHEET_MAX_ROWS, SHEET_PROTECTION, sheetFormatRequests, sheetRows, sheetUrl, sheetWindow, shiftColumn } from "./shift-sheets";

type Db = SupabaseClient<Database>;
type SheetPerson = { id: string; first_name: string; last_name: string; contact_email: string; sheet_id: string };
const json = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

async function sheetTitle(sheetId: string) {
  const meta = await (await googleFetch("sheets", `/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))`)).json() as { sheets?: { properties: { sheetId: number; title: string }; protectedRanges?: { protectedRangeId: number; description?: string }[] }[] };
  const first = meta.sheets?.find(s => s.properties.sheetId === 0);
  if (!first) throw new Error("Nel foglio manca la scheda principale");
  const title = `'${first.properties.title.replace(/'/g, "''")}'`;
  return { title, protections: (first.protectedRanges ?? []).filter(p => p.description === SHEET_PROTECTION).map(p => p.protectedRangeId) };
}
const range = (title: string, cells: string) => encodeURIComponent(`${title}!${cells}`);

async function loadPerson(db: Db, collaboratorId: string): Promise<SheetPerson> {
  const { data, error } = await db.from("shift_collaborators").select("id,first_name,last_name,contact_email,sheet_id").eq("id", collaboratorId).single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadShifts(db: Db, collaboratorId: string, first: string, last: string): Promise<ShiftAssignment[]> {
  const { data, error } = await db.from("shift_assignments").select("*").eq("collaborator_id", collaboratorId).gte("day", first).lte("day", last);
  if (error) throw new Error(error.message);
  return (data ?? []).map(e => ({ ...e, status: toAssignmentStatus(e.status) }));
}

async function writeSheet(db: Db, person: SheetPerson) {
  const days = sheetWindow();
  const first = days[0]!; const last = days.at(-1)!;
  const { data: entries, error } = await db.from("shift_availability").select("day,status,note").eq("collaborator_id", person.id).gte("day", first).lte("day", last);
  if (error) throw new Error(error.message);
  const shifts = await loadShifts(db, person.id, first, last);
  const { title, protections } = await sheetTitle(person.sheet_id);
  await googleFetch("sheets", `/spreadsheets/${person.sheet_id}/values:batchClear`, json({ ranges: [`${title}!A1:E${SHEET_MAX_ROWS}`] }));
  const rows = sheetRows(days, entries ?? [], shifts);
  await googleFetch("sheets", `/spreadsheets/${person.sheet_id}/values/${range(title, `A1:E${rows.length}`)}?valueInputOption=RAW`, json({ values: rows }, "PUT"));
  await googleFetch("sheets", `/spreadsheets/${person.sheet_id}:batchUpdate`, json({ requests: sheetFormatRequests(days, protections) }));
}

export async function createPersonSheet(db: Db, collaboratorId: string) {
  const person = await loadPerson(db, collaboratorId);
  if (person.sheet_id) return person.sheet_id;
  if (!EMAIL.test(person.contact_email)) throw new Error("Inserisci prima un indirizzo email valido nella scheda del collaboratore");
  const file = await (await googleFetch("drive", "/files?fields=id", json({ name: `Mana Flask — Disponibilità ${person.first_name} ${person.last_name}`, mimeType: "application/vnd.google-apps.spreadsheet", writersCanShare: false }))).json() as { id: string };
  await googleFetch("sheets", `/spreadsheets/${file.id}:batchUpdate`, json({ requests: [{ updateSheetProperties: { properties: { sheetId: 0, title: "Disponibilità" }, fields: "title" } }] }));
  await writeSheet(db, { ...person, sheet_id: file.id });
  const message = encodeURIComponent("Questo è il tuo foglio delle disponibilità per Mana Flask. Compila le colonne Disponibilità e Nota entro venerdì per la settimana successiva.");
  await googleFetch("drive", `/files/${file.id}/permissions?sendNotificationEmail=true&emailMessage=${message}`, json({ type: "user", role: "writer", emailAddress: person.contact_email }));
  const { error } = await db.from("shift_collaborators").update({ sheet_id: file.id }).eq("id", person.id);
  if (error) throw new Error(error.message);
  return file.id;
}

export async function syncPersonSheet(db: Db, person: SheetPerson) {
  const { title } = await sheetTitle(person.sheet_id);
  const read = await (await googleFetch("sheets", `/spreadsheets/${person.sheet_id}/values/${range(title, `A2:D${SHEET_MAX_ROWS}`)}?valueRenderOption=FORMATTED_VALUE`)).json() as { values?: string[][] };
  const parsed = parseSheetRows(read.values ?? []);
  const lockedDays = parsed.locked.map(r => r.day);
  const { data: current, error: currentError } = lockedDays.length ? await db.from("shift_availability").select("day,status,note").eq("collaborator_id", person.id).in("day", lockedDays) : { data: [], error: null };
  if (currentError) throw new Error(currentError.message);
  const { data: changed, error } = await db.rpc("apply_sheet_availability", { _collaborator: person.id, _rows: parsed.rows });
  if (error) throw new Error(error.message);
  await writeSheet(db, person);
  return { changed: changed ?? 0, invalid: parsed.invalid, late: lateEdits(parsed.locked, current ?? []) };
}

export async function refreshSheetShifts(db: Db, collaboratorId: string) {
  const person = await loadPerson(db, collaboratorId);
  if (!person.sheet_id) return;
  const { title } = await sheetTitle(person.sheet_id);
  const read = await (await googleFetch("sheets", `/spreadsheets/${person.sheet_id}/values/${range(title, `A2:A${SHEET_MAX_ROWS}`)}`)).json() as { values?: string[][] };
  const dates = read.values ?? [];
  const days = dates.map(r => parseSheetDate(r[0] ?? "")).filter((d): d is string => !!d).sort();
  if (!days.length) return;
  const shifts = await loadShifts(db, person.id, days[0]!, days.at(-1)!);
  await googleFetch("sheets", `/spreadsheets/${person.sheet_id}/values/${range(title, `E2:E${dates.length + 1}`)}?valueInputOption=RAW`, json({ values: shiftColumn(dates, shifts) }, "PUT"));
}

export async function sendPublicationEmail(person: SheetPerson, shifts: ShiftAssignment[]) {
  if (!EMAIL.test(person.contact_email)) return false;
  await googleFetch("gmail", "/users/me/messages/send", json({ raw: publicationEmail({ to: person.contact_email, firstName: person.first_name, shifts, link: person.sheet_id ? sheetUrl(person.sheet_id) : null }) }));
  return true;
}
