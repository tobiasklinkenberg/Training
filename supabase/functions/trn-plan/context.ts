// Datenaufbereitung für den Claude-Kontext (läuft mit dem JWT des Nutzers → RLS aktiv).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Availability, WeekConstraint } from "./_shared/schemas.ts";
import { hfZone } from "./_shared/schemas.ts";
import { addDays, diffDays, isoWeekday, todayIso, weekDates, weekStart, WOCHENTAGE_LANG } from "./_shared/dates.ts";
import { kennzahlen, type RuleContext } from "./rules.ts";

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export interface BuiltContext {
  ruleCtx: RuleContext;
  prompt: Record<string, unknown>;
  hfMax: number | null;
}

export async function buildContext(sb: SupabaseClient, wocheStart: string): Promise<BuiltContext> {
  const heute = todayIso();
  const wsHeute = weekStart(heute);
  const wocheEnde = addDays(wocheStart, 6);

  const [settingsRows, availability, constraints, sessions, aktuellerPlan, weekLoad, ga1, x4, kraft, befinden, exercises] = await Promise.all([
    q(sb.from("settings").select("*").limit(1)),
    q<Availability[]>(sb.from("availability").select("wochentag,tageszeit,typ,erlaubte_arten,dauer_min").order("wochentag")),
    q<WeekConstraint[]>(sb.from("week_constraint").select("datum,typ,notiz").gte("datum", addDays(wocheStart, -2)).lte("datum", wocheEnde)),
    q(
      sb
        .from("session")
        .select("datum,art,unterart,dauer_min,srpe,last,befinden_vorher,beschwerden,beschwerden_stelle,geplant,notiz, run_detail(distanz_km,pace_sek_pro_km,hf_avg,hf_max), tennis_detail(schwerpunkte,programm), interval_rep(nr,dauer_sek,distanz_m,hf_avg,hf_max,rpe), strength_set(exercise_id,satz_nr,wdh,gewicht_kg,rir, exercise(name))")
        .gte("datum", addDays(wocheStart, -28))
        .lt("datum", wocheStart)
        .order("datum", { ascending: false })
        .limit(60),
    ),
    q(sb.from("plan_week").select("woche_start,begruendung, plan_item(datum,tageszeit,art,unterart,dauer_min,intensitaet,erledigt)").eq("status", "aktiv").eq("woche_start", wsHeute).limit(1)),
    q(sb.from("v_week_load").select("*").lt("woche_start", wocheStart).order("woche_start", { ascending: false }).limit(6)),
    q(sb.from("v_run_trend").select("datum,distanz_km,pace_sek_pro_km,hf_avg,hf_max,srpe").order("datum", { ascending: false }).limit(8)),
    q(sb.from("v_4x4_trend").select("datum,wiederholungen,pace_avg_sek_pro_km,hf_avg,hf_max,rpe_avg,srpe").order("datum", { ascending: false }).limit(6)),
    q(sb.from("v_strength_progress").select("datum,uebung,max_gewicht_kg,wdh_bei_max,e1rm_epley").order("datum", { ascending: false }).limit(80)),
    q(sb.from("daily_check").select("datum,schlaf,energie,muskelkater").gte("datum", addDays(heute, -7)).order("datum")),
    q(sb.from("exercise").select("name,kategorie").eq("aktiv", true).order("sortierung")),
  ]);

  const settings = (settingsRows[0] ?? {}) as Row;
  const hfMax = (settings.hf_max as number | null) ?? null;
  const intervallMax = Number(settings.intervall_pro_woche_max ?? 1);
  const kraftZiel = Number(settings.kraft_pro_woche_ziel ?? 2);
  const entlastungAktiv = settings.entlastungswoche_aktiv !== false;

  // Wochenindex: Wochen seit der ersten erfassten Einheit (für den 4-Wochen-Rhythmus)
  const alleWochen = await q(sb.from("v_week_load").select("woche_start").order("woche_start").limit(1));
  const erste = (alleWochen[0]?.woche_start as string | undefined) ?? wocheStart;
  const weekIndex = Math.max(0, Math.floor(diffDays(weekStart(erste), wocheStart) / 7));

  const lastWeeksLoad = (weekLoad as Row[]).map((w) => Number(w.last_gesamt));
  const harteEinheiten = (sessions as Row[]).filter((s) => Number(s.srpe) >= 7 || s.art === "lauf_4x4").length;
  const hartAnteil = sessions.length ? harteEinheiten / sessions.length : 0;
  const kz = kennzahlen(lastWeeksLoad, hartAnteil, weekIndex, entlastungAktiv);

  const drei = addDays(heute, -3);
  const beschwerdenSessions = (sessions as Row[]).filter((s) => (s.datum as string) >= drei && s.beschwerden);
  const randTage = (sessions as Row[]).filter((s) => diffDays(s.datum as string, wocheStart) <= 2);

  const ruleCtx: RuleContext = {
    wocheStart,
    settings: { intervall_pro_woche_max: intervallMax, kraft_pro_woche_ziel: kraftZiel, entlastungswoche_aktiv: entlastungAktiv },
    availability,
    constraints,
    lastWeeksLoad,
    weekIndex,
    beschwerdenAktuell: beschwerdenSessions.length > 0,
    previousHardDates: randTage.filter((s) => Number(s.srpe) >= 7 || s.art === "lauf_4x4").map((s) => s.datum as string),
    previousKraftDates: randTage.filter((s) => s.art === "kraft").map((s) => s.datum as string),
  };

  // Konkrete Slots der Zielwoche
  const tage = weekDates(wocheStart).map((d) => {
    const c = constraints.find((x) => x.datum === d);
    const wd = isoWeekday(d);
    return {
      datum: d,
      wochentag: WOCHENTAGE_LANG[wd - 1],
      nicht_verfuegbar: c?.typ === "nicht_verfuegbar",
      eingeschraenkt: c?.typ === "eingeschraenkt",
      notiz: c?.notiz ?? undefined,
      slots:
        c?.typ === "nicht_verfuegbar"
          ? []
          : availability
              .filter((a) => a.wochentag === wd)
              .map((a) => ({ tageszeit: a.tageszeit, arten: a.erlaubte_arten, dauer_min: a.dauer_min, fix: a.typ === "fix_tennis" })),
    };
  });

  // Kraft-Trend je Übung: letzte 3 Einträge
  const kraftJeUebung: Record<string, unknown[]> = {};
  for (const k of kraft as Row[]) {
    const n = String(k.uebung);
    kraftJeUebung[n] ??= [];
    if (kraftJeUebung[n].length < 3) kraftJeUebung[n].push({ datum: k.datum, max_kg: k.max_gewicht_kg, wdh: k.wdh_bei_max, e1rm: k.e1rm_epley });
  }

  const plan = (aktuellerPlan[0] ?? null) as Row | null;
  const planItems = ((plan?.plan_item as Row[] | undefined) ?? []).filter((i) => (i.datum as string) <= heute);

  const letzte10 = (sessions as Row[]).slice(0, 10).map((s) => ({
    datum: s.datum,
    art: s.art,
    unterart: s.unterart,
    dauer_min: s.dauer_min,
    srpe: s.srpe,
    geplant: s.geplant,
    beschwerden: s.beschwerden ? `${s.beschwerden}${s.beschwerden_stelle ? ` (${s.beschwerden_stelle})` : ""}` : undefined,
    lauf: s.run_detail ?? undefined,
    tennis: s.tennis_detail ?? undefined,
    intervalle: Array.isArray(s.interval_rep) && s.interval_rep.length ? s.interval_rep : undefined,
    kraft: Array.isArray(s.strength_set) && s.strength_set.length
      ? (s.strength_set as Row[]).map((x) => `${(x.exercise as Row | null)?.name ?? "?"} ${x.satz_nr}: ${x.wdh}×${x.gewicht_kg}${x.rir != null ? ` RIR${x.rir}` : ""}`)
      : undefined,
  }));

  const prompt = {
    heute,
    zielwoche: { woche_start: wocheStart, woche_ende: wocheEnde, tage },
    einstellungen: {
      ziel: settings.ziel ?? "allgemeine Spielfitness",
      ziel_typ: settings.ziel_typ ?? "spielfitness",
      hf_max: hfMax,
      hf_ruhe: settings.hf_ruhe ?? null,
      kraft_pro_woche_ziel: kraftZiel,
      intervall_pro_woche_max: intervallMax,
      entlastungswoche_aktiv: entlastungAktiv,
    },
    hf_zonen: hfMax
      ? { ga1_obergrenze: Math.round(hfMax * 0.78), x4: hfZone(hfMax, 85, 95), x4_pause: hfZone(hfMax, 60, 70) }
      : null,
    kennzahlen: kz,
    wochenlast_verlauf: (weekLoad as Row[]).map((w) => ({ woche_start: w.woche_start, last: w.last_gesamt, einheiten: w.einheiten, hart: w.n_hart })),
    laufende_woche: plan
      ? {
          woche_start: plan.woche_start,
          geplant_bis_heute: planItems.length,
          erledigt_bis_heute: planItems.filter((i) => i.erledigt).length,
          einheiten: (plan.plan_item as Row[]).map((i) => ({ datum: i.datum, art: i.art, unterart: i.unterart, intensitaet: i.intensitaet, erledigt: i.erledigt })),
        }
      : null,
    vorwoche: { harte_tage: ruleCtx.previousHardDates, kraft_tage: ruleCtx.previousKraftDates },
    letzte_einheiten: letzte10,
    trends: { ga1: (ga1 as Row[]).reverse(), x4: (x4 as Row[]).reverse(), kraft: kraftJeUebung },
    befinden: befinden,
    beschwerden: {
      aktuell: beschwerdenSessions.length > 0,
      details: beschwerdenSessions.map((s) => ({ datum: s.datum, text: s.beschwerden, stelle: s.beschwerden_stelle })),
    },
    uebungskatalog: (exercises as Row[]).map((e) => e.name),
  };

  return { ruleCtx, prompt, hfMax };
}
