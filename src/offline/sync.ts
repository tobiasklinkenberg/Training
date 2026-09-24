// Synchronisation des Offline-Puffers + Speichern mit Fallback in die Queue.
import { useEffect, useState } from "react";
import { supabase } from "../shared/supabase";
import type { DailyCheck, SessionInput } from "../shared/schemas";
import { enqueue, listQueue, removeFromQueue, subscribeQueue, updateQueue, type QueueEntry } from "./queue";

function istNetzfehler(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return !navigator.onLine || /fetch|network|Failed to|NetworkError|timeout|load failed/i.test(msg);
}

async function sendSession(payload: SessionInput): Promise<string> {
  const { data, error } = await supabase.rpc("save_session", { p: payload });
  if (error) throw error;
  return data as string;
}

async function sendDailyCheck(payload: DailyCheck): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("nicht angemeldet");
  const { error } = await supabase.from("daily_check").upsert({ user_id: u.user.id, ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id,datum" });
  if (error) throw error;
}

/** Speichert direkt; bei Netzfehler in die Queue. Rückgabe: "online" | "gepuffert". */
export async function saveSession(payload: SessionInput): Promise<"online" | "gepuffert"> {
  if (!navigator.onLine) {
    await enqueue({ id: payload.client_id, typ: "session", payload, created_at: Date.now(), versuche: 0, fehler: null });
    return "gepuffert";
  }
  try {
    await sendSession(payload);
    return "online";
  } catch (e) {
    if (istNetzfehler(e)) {
      await enqueue({ id: payload.client_id, typ: "session", payload, created_at: Date.now(), versuche: 0, fehler: null });
      return "gepuffert";
    }
    throw e;
  }
}

export async function saveDailyCheck(payload: DailyCheck): Promise<"online" | "gepuffert"> {
  const id = `dc-${payload.datum}`;
  if (!navigator.onLine) {
    await enqueue({ id, typ: "daily_check", payload, created_at: Date.now(), versuche: 0, fehler: null });
    return "gepuffert";
  }
  try {
    await sendDailyCheck(payload);
    return "online";
  } catch (e) {
    if (istNetzfehler(e)) {
      await enqueue({ id, typ: "daily_check", payload, created_at: Date.now(), versuche: 0, fehler: null });
      return "gepuffert";
    }
    throw e;
  }
}

let syncing = false;
/** Arbeitet die Queue ab. Rückgabe: Anzahl erfolgreich synchronisierter Einträge. */
export async function syncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let ok = 0;
  try {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return 0;
    for (const e of await listQueue()) {
      try {
        if (e.typ === "session") await sendSession(e.payload);
        else await sendDailyCheck(e.payload);
        await removeFromQueue(e.id);
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const next: QueueEntry = { ...e, versuche: e.versuche + 1, fehler: msg };
        await updateQueue(next);
        if (istNetzfehler(err)) break; // Netz weg → Rest später
      }
    }
  } finally {
    syncing = false;
  }
  return ok;
}

/** Hook: Pufferstatus + automatische Synchronisation bei Online-Gang. */
export function useOfflineQueue(onSynced?: () => void) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const refresh = () => {
      listQueue().then(setEntries);
    };
    refresh();
    const unsub = subscribeQueue(refresh);
    const goOnline = () => {
      setOnline(true);
      syncQueue().then((n) => {
        if (n > 0) onSynced?.();
      });
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) goOnline();
    const iv = window.setInterval(() => {
      if (navigator.onLine) syncQueue().then((n) => n > 0 && onSynced?.());
    }, 60_000);
    return () => {
      unsub();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { entries, online, sync: () => syncQueue().then((n) => n > 0 && onSynced?.()) };
}
