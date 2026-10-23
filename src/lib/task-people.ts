import { normalizeText } from "@/lib/search";

export function taskPeople(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/\n|;/).map(name => name.trim()).filter(name => {
    const key = normalizeText(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const formatTaskPeople = (value: string) => taskPeople(value).join("\n");