// Baut den RuleContext für Live-Hinweise im Frontend aus den geladenen Daten.
import { useMemo } from "react";
import { useAvailability, useConstraints, useSessions, useSettings, useWeekLoad } from "../../shared/queries";
import type { RuleContext } from "../../shared/rules";
import type { Availability, WeekConstraint } from "../../shared/schemas";
import { addDays, diffDays, todayIso, weekStart } from "../../shared/dates";

export function useRuleContext(wocheStart: string): RuleContext | null {
  const settings = useSettings();
  const availability = useAvailability();
  const constraints = useConstraints();
  const weekLoad = useWeekLoad();
  const recent = useSessions(addDays(wocheStart, -10), addDays(wocheStart, -1), 100);
  const heute = todayIso();

  return useMemo(() => {
    if (!settings.data || !availability.data || !constraints.data || !weekLoad.data || !recent.data) return null;
    const vorherigeWochen = weekLoad.data.filter((w) => w.woche_start < wocheStart).sort((a, b) => b.woche_start.localeCompare(a.woche_start));
    const erste = weekLoad.data.length ? weekLoad.data.reduce((m, w) => (w.woche_start < m ? w.woche_start : m), weekLoad.data[0].woche_start) : wocheStart;
    const weekIndex = Math.max(0, Math.floor(diffDays(weekStart(erste), wocheStart) / 7));
    const drei = addDays(heute, -3);
    return {
      wocheStart,
      settings: {
        intervall_pro_woche_max: settings.data.intervall_pro_woche_max,
        kraft_pro_woche_ziel: settings.data.kraft_pro_woche_ziel,
        entlastungswoche_aktiv: settings.data.entlastungswoche_aktiv,
      },
      availability: availability.data.map<Availability>((a) => ({
        id: a.id,
        wochentag: a.wochentag,
        tageszeit: a.tageszeit,
        typ: a.typ,
        erlaubte_arten: a.erlaubte_arten as Availability["erlaubte_arten"],
        dauer_min: a.dauer_min,
      })),
      constraints: constraints.data.map<WeekConstraint>((c) => ({ id: c.id, datum: c.datum, typ: c.typ, notiz: c.notiz })),
      lastWeeksLoad: vorherigeWochen.slice(0, 3).map((w) => Number(w.last_gesamt)),
      weekIndex,
      beschwerdenAktuell: recent.data.some((s) => s.datum >= drei && s.beschwerden),
      previousHardDates: recent.data.filter((s) => s.srpe >= 7 || s.art === "lauf_4x4").map((s) => s.datum),
      previousKraftDates: recent.data.filter((s) => s.art === "kraft").map((s) => s.datum),
    };
  }, [settings.data, availability.data, constraints.data, weekLoad.data, recent.data, wocheStart, heute]);
}
