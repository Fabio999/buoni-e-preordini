/** Accent- and case-insensitive text matching shared by every search box and filter. */
export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * True when every word of `query` appears in the text, in any order.
 * `haystacks` adds alternative forms (e.g. "cognome nome") so reversed searches work.
 */
export function matchesText(text: string, query: string, haystacks: string[] = []) {
  const q = normalizeText(query);
  if (!q) return true;
  const fields = [normalizeText(text), ...haystacks.map(normalizeText)];
  return q.split(" ").every((token) => fields.some((f) => f.includes(token)));
}
