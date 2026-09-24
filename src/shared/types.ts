// Zeilentypen der Tabellen/Views im Schema `training` (manuell gepflegt, siehe Migrationen).
import type { Art, Intensitaet, Tageszeit, Warnung } from "./schemas";

export interface SettingsRow {
  user_id: string;
  hf_max: number | null;
  hf_ruhe: number | null;
  ziel: string;
  ziel_typ: "spielfitness" | "ausdauer" | "kraft" | "wettkampf" | "sonstiges";
  wochenstart: number;
  kraft_pro_woche_ziel: number;
  intervall_pro_woche_max: number;
  entlastungswoche_aktiv: boolean;
  hinweis_bestaetigt_at: string | null;
  updated_at: string;
}

export interface AvailabilityRow {
  id: string;
  user_id: string;
  wochentag: number;
  tageszeit: Tageszeit;
  typ: "fix_tennis" | "moeglich";
  erlaubte_arten: string[];
  dauer_min: number;
}

export interface WeekConstraintRow {
  id: string;
  user_id: string;
  datum: string;
  typ: "nicht_verfuegbar" | "eingeschraenkt";
  notiz: string | null;
}

export interface StreckeRow {
  id: string;
  name: string;
  distanz_km: number | null;
  aktiv: boolean;
}

export interface ExerciseRow {
  id: string;
  name: string;
  kategorie: string;
  aktiv: boolean;
  sortierung: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  datum: string;
  startzeit: string | null;
  art: Art;
  unterart: string | null;
  geplant: boolean;
  dauer_min: number;
  srpe: number;
  last: number;
  befinden_vorher: number | null;
  beschwerden: string | null;
  beschwerden_stelle: string | null;
  notiz: string | null;
  plan_item_id: string | null;
  client_id: string | null;
  created_at: string;
  run_detail?: RunDetailRow | null;
  tennis_detail?: TennisDetailRow | null;
  interval_rep?: IntervalRepRow[];
  strength_set?: StrengthSetRow[];
}

export interface RunDetailRow {
  session_id: string;
  distanz_km: number | null;
  pace_sek_pro_km: number | null;
  hf_avg: number | null;
  hf_max: number | null;
  strecke_id: string | null;
}
export interface TennisDetailRow {
  session_id: string;
  schwerpunkte: string[];
  programm: string | null;
}
export interface IntervalRepRow {
  id: string;
  session_id: string;
  nr: number;
  dauer_sek: number | null;
  distanz_m: number | null;
  hf_avg: number | null;
  hf_max: number | null;
  rpe: number | null;
}
export interface StrengthSetRow {
  id: string;
  session_id: string;
  exercise_id: string;
  satz_nr: number;
  wdh: number;
  gewicht_kg: number;
  rir: number | null;
  exercise?: { name: string } | null;
}

export interface DailyCheckRow {
  user_id: string;
  datum: string;
  schlaf: number | null;
  energie: number | null;
  muskelkater: number | null;
}

export interface PlanWeekRow {
  id: string;
  user_id: string;
  woche_start: string;
  status: "vorschlag" | "aktiv" | "verworfen";
  quelle: "claude" | "manuell" | "vorwoche";
  begruendung: string | null;
  warnungen: Warnung[];
  kennzahlen: Record<string, unknown> | null;
  modell: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
  plan_item?: PlanItemRow[];
}

export interface PlanItemRow {
  id: string;
  plan_week_id: string;
  datum: string;
  tageszeit: Tageszeit;
  art: Art;
  unterart: string | null;
  dauer_min: number;
  intensitaet: Intensitaet;
  inhalt: Record<string, unknown>;
  hinweis: string | null;
  erledigt: boolean;
  sortierung: number;
}

export interface WeekLoadRow {
  user_id: string;
  woche_start: string;
  last_gesamt: number;
  einheiten: number;
  n_tennis: number;
  n_lauf_ga1: number;
  n_lauf_4x4: number;
  n_kraft: number;
  n_hart: number;
  minuten: number;
}
export interface RunTrendRow {
  session_id: string;
  datum: string;
  distanz_km: number | null;
  pace_sek_pro_km: number | null;
  hf_avg: number | null;
  hf_max: number | null;
  effizienz: number | null;
}
export interface X4TrendRow {
  session_id: string;
  datum: string;
  wiederholungen: number;
  pace_avg_sek_pro_km: number | null;
  hf_avg: number | null;
  hf_max: number | null;
  rpe_avg: number | null;
}
export interface StrengthProgressRow {
  datum: string;
  session_id: string;
  exercise_id: string;
  uebung: string;
  max_gewicht_kg: number;
  wdh_bei_max: number | null;
  e1rm_epley: number;
  volumen_kg: number;
}
