import { mergeGames } from "./event-recurrence";
export const categoriesKey = (account: string) => `mf-task-categories:${account}`;
export function readCategories(account: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(categoriesKey(account)) ?? "[]");
    return Array.isArray(value) ? mergeGames(value.filter((item): item is string => typeof item === "string")) : [];
  } catch { return []; }
}
export function rememberCategory(account: string, category: string) {
  const categories = mergeGames(readCategories(account), [category]);
  localStorage.setItem(categoriesKey(account), JSON.stringify(categories));
  return categories;
}
