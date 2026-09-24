// Offline-Puffer für Erfassungen (IndexedDB). Tennishalle/Wald = schlechtes Netz.
// Einträge werden beim nächsten Online-Gang über training.save_session (idempotent via client_id)
// synchronisiert.
import { openDB, type IDBPDatabase } from "idb";
import type { SessionInput, DailyCheck } from "../shared/schemas";

export type QueueEntry =
  | { id: string; typ: "session"; payload: SessionInput; created_at: number; versuche: number; fehler: string | null }
  | { id: string; typ: "daily_check"; payload: DailyCheck; created_at: number; versuche: number; fehler: string | null };

const DB = "trn-offline";
const STORE = "queue";
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB(DB, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: "id" });
    },
  });
  return dbp;
}

export async function enqueue(entry: QueueEntry): Promise<void> {
  await (await db()).put(STORE, entry);
  notify();
}
export async function listQueue(): Promise<QueueEntry[]> {
  const all = (await (await db()).getAll(STORE)) as QueueEntry[];
  return all.sort((a, b) => a.created_at - b.created_at);
}
export async function removeFromQueue(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
  notify();
}
export async function updateQueue(entry: QueueEntry): Promise<void> {
  await (await db()).put(STORE, entry);
  notify();
}

// Einfache Änderungsbenachrichtigung für den Pufferstatus im UI.
const listeners = new Set<() => void>();
export function subscribeQueue(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  for (const l of listeners) l();
}
