// TanStack-Query-Hooks für alle Trainingsdaten (Schema `training`, RLS aktiv).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  AvailabilityRow,
  DailyCheckRow,
  ExerciseRow,
  PlanWeekRow,
  RunTrendRow,
  SessionRow,
  SettingsRow,
  StreckeRow,
  StrengthProgressRow,
  WeekConstraintRow,
  WeekLoadRow,
  X4TrendRow,
} from "./types";
import { addDays, todayIso } from "./dates";

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const keys = {
  settings: ["settings"] as const,
  availability: ["availability"] as const,
  constraints: ["constraints"] as const,
  exercises: ["exercises"] as const,
  strecken: ["strecken"] as const,
  sessions: (von?: string, bis?: string) => ["sessions", von ?? "", bis ?? ""] as const,
  dailyCheck: (d: string) => ["daily_check", d] as const,
  plans: (woche: string) => ["plans", woche] as const,
  planRange: (von: string, bis: string) => ["plans_range", von, bis] as const,
  weekLoad: ["week_load"] as const,
  runTrend: ["run_trend"] as const,
  x4Trend: ["x4_trend"] as const,
  strength: ["strength_progress"] as const,
  lastStrength: ["last_strength"] as const,
};

// ---------------------------------------------------------------------------
export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => must(supabase.from("settings").select("*").maybeSingle<SettingsRow>()),
  });
}
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SettingsRow>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("nicht angemeldet");
      await must(supabase.from("settings").upsert({ user_id: u.user.id, ...patch, updated_at: new Date().toISOString() }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

export function useAvailability() {
  return useQuery({
    queryKey: keys.availability,
    queryFn: () => must(supabase.from("availability").select("*").order("wochentag").order("tageszeit").returns<AvailabilityRow[]>()),
  });
}
export function useConstraints() {
  return useQuery({
    queryKey: keys.constraints,
    queryFn: () => must(supabase.from("week_constraint").select("*").gte("datum", addDays(todayIso(), -60)).order("datum").returns<WeekConstraintRow[]>()),
  });
}
export function useExercises() {
  return useQuery({
    queryKey: keys.exercises,
    queryFn: () => must(supabase.from("exercise").select("*").order("sortierung").order("name").returns<ExerciseRow[]>()),
  });
}
export function useStrecken() {
  return useQuery({
    queryKey: keys.strecken,
    queryFn: () => must(supabase.from("strecke").select("*").order("name").returns<StreckeRow[]>()),
  });
}

/** Generische Tabellen-Mutation (insert/update/delete) mit Invalidierung. */
export function useTableMutation(table: string, invalidate: readonly (readonly string[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: { insert?: Record<string, unknown>; update?: { id: string; patch: Record<string, unknown> }; delete?: string }) => {
      if (op.insert) {
        const { data: u } = await supabase.auth.getUser();
        await must(supabase.from(table).insert({ user_id: u.user!.id, ...op.insert }));
      }
      if (op.update) await must(supabase.from(table).update(op.update.patch).eq("id", op.update.id));
      if (op.delete) await must(supabase.from(table).delete().eq("id", op.delete));
    },
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

// ---------------------------------------------------------------------------
const SESSION_SELECT = "*, run_detail(*), tennis_detail(*), interval_rep(*), strength_set(*, exercise(name))";

export function useSessions(von?: string, bis?: string, limit = 200) {
  return useQuery({
    queryKey: keys.sessions(von, bis),
    queryFn: async () => {
      let q = supabase.from("session").select(SESSION_SELECT).order("datum", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (von) q = q.gte("datum", von);
      if (bis) q = q.lte("datum", bis);
      return must(q.returns<SessionRow[]>());
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(supabase.from("session").delete().eq("id", id)),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDailyCheck(datum: string) {
  return useQuery({
    queryKey: keys.dailyCheck(datum),
    queryFn: () => must(supabase.from("daily_check").select("*").eq("datum", datum).maybeSingle<DailyCheckRow>()),
  });
}

// ---------------------------------------------------------------------------
const PLAN_SELECT = "*, plan_item(*)";

export function usePlansForWeek(wocheStart: string) {
  return useQuery({
    queryKey: keys.plans(wocheStart),
    queryFn: () =>
      must(
        supabase
          .from("plan_week")
          .select(PLAN_SELECT)
          .eq("woche_start", wocheStart)
          .in("status", ["aktiv", "vorschlag"])
          .order("created_at", { ascending: false })
          .returns<PlanWeekRow[]>(),
      ),
  });
}

/** Aktive Pläne in einem Datumsbereich (für „Heute"). */
export function useActivePlansRange(von: string, bis: string) {
  return useQuery({
    queryKey: keys.planRange(von, bis),
    queryFn: () =>
      must(supabase.from("plan_week").select(PLAN_SELECT).eq("status", "aktiv").gte("woche_start", von).lte("woche_start", bis).returns<PlanWeekRow[]>()),
  });
}

// ---------------------------------------------------------------------------
export function useWeekLoad() {
  return useQuery({
    queryKey: keys.weekLoad,
    queryFn: () => must(supabase.from("v_week_load").select("*").order("woche_start", { ascending: false }).limit(12).returns<WeekLoadRow[]>()),
  });
}
export function useRunTrend() {
  return useQuery({
    queryKey: keys.runTrend,
    queryFn: () => must(supabase.from("v_run_trend").select("*").order("datum").limit(100).returns<RunTrendRow[]>()),
  });
}
export function useX4Trend() {
  return useQuery({
    queryKey: keys.x4Trend,
    queryFn: () => must(supabase.from("v_4x4_trend").select("*").order("datum").limit(100).returns<X4TrendRow[]>()),
  });
}
export function useStrengthProgress() {
  return useQuery({
    queryKey: keys.strength,
    queryFn: () => must(supabase.from("v_strength_progress").select("*").order("datum").limit(500).returns<StrengthProgressRow[]>()),
  });
}

/** „Letztes Mal"-Werte je Übung: Sätze der jeweils letzten Krafteinheit mit dieser Übung. */
export interface LastStrength {
  datum: string;
  saetze: { satz_nr: number; wdh: number; gewicht_kg: number; rir: number | null }[];
}
export function useLastStrength() {
  return useQuery({
    queryKey: keys.lastStrength,
    queryFn: async () => {
      const rows = await must(
        supabase
          .from("session")
          .select("datum, strength_set(exercise_id, satz_nr, wdh, gewicht_kg, rir)")
          .eq("art", "kraft")
          .order("datum", { ascending: false })
          .limit(15)
          .returns<{ datum: string; strength_set: { exercise_id: string; satz_nr: number; wdh: number; gewicht_kg: number; rir: number | null }[] }[]>(),
      );
      const out: Record<string, LastStrength> = {};
      for (const s of rows) {
        for (const set of s.strength_set) {
          if (!out[set.exercise_id]) out[set.exercise_id] = { datum: s.datum, saetze: [] };
          if (out[set.exercise_id].datum === s.datum) out[set.exercise_id].saetze.push(set);
        }
      }
      for (const v of Object.values(out)) v.saetze.sort((a, b) => a.satz_nr - b.satz_nr);
      return out;
    },
  });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
