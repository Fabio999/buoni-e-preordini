import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Voucher operations saved while offline, sent in order when the connection returns. */
export type QueuedOp =
  | { id: string; kind: "add_balance_movement"; client: string; delta: number; args: Record<string, unknown> }
  | { id: string; kind: "register_purchase"; client: string; delta: number; args: Record<string, unknown> }
  | { id: string; kind: "register_sale"; client: string; delta: number; args: Record<string, unknown> };

const KEY = "mf-offline-queue";
const listeners = new Set<() => void>();
let cache: QueuedOp[] | null = null;

function read(): QueuedOp[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    cache = [];
  }
  return cache!;
}
function write(q: QueuedOp[]) {
  cache = q;
  localStorage.setItem(KEY, JSON.stringify(q));
  listeners.forEach((l) => l());
}
const EMPTY: QueuedOp[] = [];
export const useQueue = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => EMPTY,
  );

export function enqueue(op: Omit<QueuedOp, "id">) {
  write([...read(), { ...op, id: crypto.randomUUID() } as QueuedOp]);
}

/** Sum of not-yet-sent voucher changes for a client. */
export const pendingDelta = (q: QueuedOp[], client: string) =>
  q.filter((o) => o.client === client).reduce((s, o) => s + o.delta, 0);

export const isNetworkError = (e: { message?: string } | null) =>
  !!e && /fetch|network|load failed/i.test(e.message ?? "");

export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

let flushing = false;
export async function flush(): Promise<number> {
  if (flushing || isOffline()) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const op of [...read()]) {
      const { error } = await supabase.rpc(op.kind, op.args as never);
      if (error) {
        if (isNetworkError(error)) break;
        toast.error(`Operazione offline non inviata: ${error.message}`);
      }
      write(read().filter((o) => o.id !== op.id));
      if (!error) sent++;
    }
  } finally {
    flushing = false;
  }
  return sent;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/** Banner + automatic send of queued operations when back online. */
export function OfflineSync() {
  const online = useOnline();
  const queue = useQueue();
  const qc = useQueryClient();
  useEffect(() => {
    if (!online || queue.length === 0) return;
    flush().then((n) => {
      if (n > 0) {
        toast.success(`${n} operazioni salvate offline sono state inviate`);
        qc.invalidateQueries();
      }
    });
  }, [online, queue.length, qc]);
  if (online && queue.length === 0) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
      {online ? "Invio operazioni in corso…" : "Sei senza connessione"}
      {queue.length > 0 && ` · ${queue.length} in attesa di invio`}
    </div>
  );
}
