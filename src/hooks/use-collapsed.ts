import { useEffect, useState } from "react";

export function useCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(storageKey) === "1"); } catch { setCollapsed(false); } }, [storageKey]);
  function collapse(value: boolean) {
    setCollapsed(value);
    try { localStorage.setItem(storageKey, value ? "1" : "0"); } catch { /* Preference lasts for this visit only. */ }
  }
  return [collapsed, collapse] as const;
}
