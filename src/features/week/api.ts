// Datenzugriff für Wochenpläne und den Aufruf der Edge Function `trn-plan`.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../shared/supabase";
import type { PlanItem, Warnung } from "../../shared/schemas";
import type { PlanItemRow, PlanWeekRow } from "../../shared/types";

export interface PlanResult {
  plan_week_id: string;
  begruendung: string | null;
  warnungen: Warnung[];
  quelle: string;
}

export class PlanError extends Error {
  constructor(
    message: string,
    public readonly fallbackVerfuegbar: boolean,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Ruft die Edge Function auf. Bei API-Ausfall signalisiert `fallbackVerfuegbar` das Kopieren der Vorwoche. */
export async function vorschlagAnfordern(wocheStart: string, modus: "claude" | "vorwoche" = "claude"): Promise<PlanResult> {
  const { data, error } = await supabase.functions.invoke<PlanResult>("trn-plan", { body: { woche_start: wocheStart, modus } });
  if (error) {
    let msg = error.message;
    let fallback = false;
    let status = 500;
    if (error instanceof FunctionsHttpError) {
      status = error.context.status;
      try {
        const j = (await error.context.json()) as { error?: string; fallback_verfuegbar?: boolean };
        msg = j.error ?? msg;
        fallback = Boolean(j.fallback_verfuegbar);
      } catch {
        /* kein JSON */
      }
    }
    throw new PlanError(msg, fallback, status);
  }
  return data!;
}

export function rowToItem(r: PlanItemRow): PlanItem {
  return {
    id: r.id,
    datum: r.datum,
    tageszeit: r.tageszeit,
    art: r.art,
    unterart: r.unterart,
    dauer_min: r.dauer_min,
    intensitaet: r.intensitaet,
    inhalt: r.inhalt ?? {},
    hinweis: r.hinweis,
    erledigt: r.erledigt,
  };
}

export async function planItemsSpeichern(planWeekId: string, items: PlanItem[]): Promise<void> {
  const { error } = await supabase.rpc("replace_plan_items", {
    p_plan_week_id: planWeekId,
    p_items: items.map((i) => ({
      id: i.id ?? null,
      datum: i.datum,
      tageszeit: i.tageszeit,
      art: i.art,
      unterart: i.unterart ?? null,
      dauer_min: i.dauer_min,
      intensitaet: i.intensitaet,
      inhalt: i.inhalt ?? {},
      hinweis: i.hinweis ?? null,
    })),
  });
  if (error) throw new Error(error.message);
}

export async function planAktivieren(planWeekId: string): Promise<void> {
  const { error } = await supabase.rpc("activate_plan", { p_plan_week_id: planWeekId });
  if (error) throw new Error(error.message);
}

export async function planVerwerfen(planWeekId: string): Promise<void> {
  const { error } = await supabase.from("plan_week").update({ status: "verworfen", updated_at: new Date().toISOString() }).eq("id", planWeekId);
  if (error) throw new Error(error.message);
}

export async function planWarnungenSpeichern(planWeekId: string, warnungen: Warnung[]): Promise<void> {
  const { error } = await supabase.from("plan_week").update({ warnungen, updated_at: new Date().toISOString() }).eq("id", planWeekId);
  if (error) throw new Error(error.message);
}

/** Leeren manuellen Vorschlag anlegen (mit festen Tennisterminen). */
export async function manuellenPlanAnlegen(wocheStart: string, items: PlanItem[]): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("nicht angemeldet");
  // alte Vorschläge dieser Woche verwerfen
  await supabase.from("plan_week").update({ status: "verworfen" }).eq("woche_start", wocheStart).eq("status", "vorschlag");
  const { data, error } = await supabase
    .from("plan_week")
    .insert({ user_id: u.user.id, woche_start: wocheStart, status: "vorschlag", quelle: "manuell", begruendung: "Manuell angelegt." })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  await planItemsSpeichern(data.id, items);
  return data.id;
}

export async function erledigtSetzen(itemId: string, erledigt: boolean): Promise<void> {
  const { error } = await supabase.from("plan_item").update({ erledigt }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export function aktiverPlan(plans: PlanWeekRow[] | undefined) {
  return plans?.find((p) => p.status === "aktiv");
}
export function vorschlag(plans: PlanWeekRow[] | undefined) {
  return plans?.find((p) => p.status === "vorschlag");
}
