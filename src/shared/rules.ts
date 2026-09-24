// Leitplanken — deterministisch, im Code. Werden VOR (Kennzahlen) und NACH (Prüfung/Korrektur)
// dem Claude-Aufruf angewendet. Gleicher Code im Frontend für Live-Hinweise beim Bearbeiten.
import type { Availability, Intensitaet, PlanItem, SlotArt, Warnung, WeekConstraint } from "./schemas";
import { addDays, diffDays, isoWeekday, weekDates } from "./dates";

export interface RuleSettings {
  intervall_pro_woche_max: number;
  kraft_pro_woche_ziel: number;
  entlastungswoche_aktiv: boolean;
}

export interface RuleContext {
  /** Montag der Zielwoche */
  wocheStart: string;
  settings: RuleSettings;
  availability: Availability[];
  constraints: WeekConstraint[];
  /** Foster-Last der letzten Wochen, jüngste zuerst (max. 3 werden verwendet) */
  lastWeeksLoad: number[];
  /** Fortlaufender Wochenindex (0-basiert) für den 4-Wochen-Rhythmus der Entlastung */
  weekIndex: number;
  /** Beschwerden in den letzten 3 Tagen erfasst */
  beschwerdenAktuell: boolean;
  /** Termine harter Einheiten / Krafteinheiten vor der Zielwoche (für Grenzen zur Vorwoche) */
  previousHardDates: string[];
  previousKraftDates: string[];
}

export interface RuleResult {
  items: PlanItem[];
  warnungen: Warnung[];
  /** Geschätzte Foster-Last des Plans */
  lastGeschaetzt: number;
  /** Zulässige Obergrenze der Wochenlast (null = keine Historie) */
  lastObergrenze: number | null;
  entlastungswoche: boolean;
}

export const SRPE_SCHAETZUNG: Record<Intensitaet, number> = { locker: 3, mittel: 5, hart: 8 };
/** Konservative Obergrenze ohne Historie (Foster-Einheiten: min × sRPE). */
export const LAST_OHNE_HISTORIE = 1800;
export const LAST_STEIGERUNG_MAX = 0.1;
export const ENTLASTUNG_FAKTOR = 0.7;

export function slotArt(item: Pick<PlanItem, "art" | "unterart">): SlotArt {
  if (item.art === "tennis") return item.unterart === "ballmaschine" ? "ballmaschine" : "tennis";
  return item.art;
}

export function istHart(item: Pick<PlanItem, "art" | "unterart" | "intensitaet">): boolean {
  return item.intensitaet === "hart" || item.art === "lauf_4x4" || (item.art === "tennis" && item.unterart === "match");
}

/** Tennistraining/Match (nicht Ballmaschine) — relevant für 4×4-Abstand. */
export function istTennisBelastung(item: Pick<PlanItem, "art" | "unterart">): boolean {
  return item.art === "tennis" && item.unterart !== "ballmaschine";
}

export function itemLast(item: Pick<PlanItem, "dauer_min" | "intensitaet">): number {
  return item.dauer_min * SRPE_SCHAETZUNG[item.intensitaet];
}

export function planLast(items: Pick<PlanItem, "dauer_min" | "intensitaet">[]): number {
  return items.reduce((s, i) => s + itemLast(i), 0);
}

export function istEntlastungswoche(weekIndex: number, aktiv: boolean): boolean {
  return aktiv && weekIndex > 0 && weekIndex % 4 === 3;
}

export function lastObergrenze(lastWeeksLoad: number[], entlastung: boolean): number | null {
  const hist = lastWeeksLoad.filter((x) => x > 0).slice(0, 3);
  if (hist.length === 0) return entlastung ? Math.round(LAST_OHNE_HISTORIE * ENTLASTUNG_FAKTOR) : LAST_OHNE_HISTORIE;
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  return Math.round(avg * (entlastung ? ENTLASTUNG_FAKTOR : 1 + LAST_STEIGERUNG_MAX));
}

// ---------------------------------------------------------------------------
// Slot-Prüfung
// ---------------------------------------------------------------------------
function constraintAm(ctx: RuleContext, datum: string) {
  return ctx.constraints.find((c) => c.datum === datum);
}

export function slotErlaubt(ctx: RuleContext, item: PlanItem, datum = item.datum, tageszeit = item.tageszeit): boolean {
  const c = constraintAm(ctx, datum);
  if (c?.typ === "nicht_verfuegbar") return false;
  const wd = isoWeekday(datum);
  const art = slotArt(item);
  return ctx.availability.some((a) => a.wochentag === wd && a.tageszeit === tageszeit && a.erlaubte_arten.includes(art));
}

function fixeTennisTermine(ctx: RuleContext): { datum: string; tageszeit: PlanItem["tageszeit"]; dauer_min: number }[] {
  const out: { datum: string; tageszeit: PlanItem["tageszeit"]; dauer_min: number }[] = [];
  for (const d of weekDates(ctx.wocheStart)) {
    const wd = isoWeekday(d);
    for (const a of ctx.availability) {
      if (a.typ === "fix_tennis" && a.wochentag === wd && constraintAm(ctx, d)?.typ !== "nicht_verfuegbar") {
        out.push({ datum: d, tageszeit: a.tageszeit, dauer_min: a.dauer_min });
      }
    }
  }
  return out;
}

function istFix(ctx: RuleContext, item: PlanItem): boolean {
  return istTennisBelastung(item) && fixeTennisTermine(ctx).some((f) => f.datum === item.datum && f.tageszeit === item.tageszeit);
}

/** Prüft die Abstandsregeln für ein Item an einem hypothetischen Datum (ohne das Item selbst). */
function abstandOk(ctx: RuleContext, item: PlanItem, datum: string, andere: PlanItem[], tageszeit = item.tageszeit): boolean {
  if (!slotErlaubt(ctx, item, datum, tageszeit)) return false;
  const c = constraintAm(ctx, datum);
  if (c?.typ === "eingeschraenkt" && istHart(item)) return false;
  const hart = istHart(item);
  if (hart) {
    const harteTage = [...ctx.previousHardDates, ...andere.filter(istHart).map((i) => i.datum)];
    if (harteTage.some((d) => Math.abs(diffDays(d, datum)) <= 1)) return false;
  }
  if (item.art === "lauf_4x4") {
    const tennisTage = andere.filter(istTennisBelastung).map((i) => i.datum);
    if (tennisTage.some((d) => d === datum || d === addDays(datum, 1))) return false;
  }
  if (item.art === "lauf_4x4" || istTennisBelastung(item)) {
    // spiegelbildlich: kein 4×4 am Tag vor/gleich Tennis
    const gegen = item.art === "lauf_4x4" ? istTennisBelastung : (i: PlanItem) => i.art === "lauf_4x4";
    for (const o of andere.filter(gegen)) {
      const x4 = item.art === "lauf_4x4" ? datum : o.datum;
      const tn = item.art === "lauf_4x4" ? o.datum : datum;
      if (x4 === tn || addDays(x4, 1) === tn) return false;
    }
  }
  if (item.art === "kraft") {
    const kraftTage = [...ctx.previousKraftDates, ...andere.filter((i) => i.art === "kraft").map((i) => i.datum)];
    if (kraftTage.some((d) => Math.abs(diffDays(d, datum)) < 2)) return false;
    if (tageszeit === "morgens" && andere.some((i) => istTennisBelastung(i) && i.datum === datum)) return false;
  }
  if (istTennisBelastung(item) && andere.some((i) => i.art === "kraft" && i.datum === datum && i.tageszeit === "morgens")) return false;
  return true;
}

/** Sucht den nächsten freien Slot in der Woche (erst nach dem Datum, dann davor). */
function freienSlotFinden(ctx: RuleContext, item: PlanItem, andere: PlanItem[]): { datum: string; tageszeit: PlanItem["tageszeit"] } | null {
  const tage = weekDates(ctx.wocheStart);
  const idx = Math.max(0, tage.indexOf(item.datum));
  const reihenfolge = [...tage.slice(idx + 1), ...tage.slice(0, idx + 1).reverse()];
  const zeiten: PlanItem["tageszeit"][] = [item.tageszeit, "abends", "morgens", "mittags"];
  for (const d of reihenfolge) {
    for (const tz of zeiten) {
      if (d === item.datum && tz === item.tageszeit) continue;
      if (andere.some((o) => o.datum === d && o.tageszeit === tz)) continue;
      if (abstandOk(ctx, item, d, andere, tz)) return { datum: d, tageszeit: tz };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------
export interface CheckOptions {
  /** true: Verstöße korrigieren (Edge Function); false: nur Warnungen (Live-Hinweise beim Bearbeiten) */
  korrigieren: boolean;
}

export function checkPlan(input: PlanItem[], ctx: RuleContext, opts: CheckOptions = { korrigieren: true }): RuleResult {
  const warn: Warnung[] = [];
  const fix = opts.korrigieren;
  const tage = weekDates(ctx.wocheStart);
  let items: PlanItem[] = input
    .filter((i) => tage.includes(i.datum))
    .map((i) => ({ ...i, inhalt: { ...(i.inhalt ?? {}) } }));
  if (items.length !== input.length) {
    warn.push({ code: "ausserhalb_woche", text: "Einheiten außerhalb der Zielwoche entfernt.", schwere: "warnung", korrigiert: true });
  }
  const ohne = (x: PlanItem) => items.filter((i) => i !== x);
  const entfernen = (x: PlanItem, code: string, text: string, schwere: Warnung["schwere"] = "warnung") => {
    if (fix) items = ohne(x);
    warn.push({ code, text, datum: x.datum, schwere, korrigiert: fix });
  };
  const verschiebenOderEntfernen = (x: PlanItem, code: string, text: string) => {
    if (!fix) {
      warn.push({ code, text, datum: x.datum, schwere: "warnung", korrigiert: false });
      return;
    }
    const slot = freienSlotFinden(ctx, x, ohne(x));
    if (slot) {
      warn.push({ code, text: `${text} → verschoben auf ${slot.datum} ${slot.tageszeit}.`, datum: x.datum, schwere: "info", korrigiert: true });
      x.datum = slot.datum;
      x.tageszeit = slot.tageszeit;
    } else {
      entfernen(x, code, `${text} — kein freier Slot, Einheit entfernt.`);
    }
  };

  // 1. Feste Tennistermine: nie entfernen, nie überplanen.
  for (const f of fixeTennisTermine(ctx)) {
    const vorhanden = items.find((i) => istTennisBelastung(i) && i.datum === f.datum);
    if (!vorhanden) {
      warn.push({ code: "fix_tennis_fehlt", text: `Festes Tennistraining am ${f.datum} fehlte im Vorschlag.`, datum: f.datum, schwere: "warnung", korrigiert: fix });
      if (fix) {
        items.push({ datum: f.datum, tageszeit: f.tageszeit, art: "tennis", unterart: "training", dauer_min: f.dauer_min, intensitaet: "mittel", inhalt: {}, hinweis: "Fester Termin" });
      }
    } else if (vorhanden.tageszeit !== f.tageszeit) {
      warn.push({ code: "fix_tennis_zeit", text: `Tennistraining am ${f.datum} auf festes Zeitfenster (${f.tageszeit}) gesetzt.`, datum: f.datum, schwere: "info", korrigiert: fix });
      if (fix) vorhanden.tageszeit = f.tageszeit;
    }
    // andere Einheit im selben Slot?
    for (const o of items.filter((i) => i.datum === f.datum && i.tageszeit === f.tageszeit && !istTennisBelastung(i))) {
      verschiebenOderEntfernen(o, "fix_tennis_ueberplant", `${o.art} kollidiert mit festem Tennistermin am ${f.datum}`);
    }
  }

  // 2. Beschwerden → keine harte Einheit
  if (ctx.beschwerdenAktuell) {
    warn.push({ code: "beschwerden", text: "Beschwerden in den letzten 3 Tagen: keine harten Einheiten geplant. Bei Schmerzen Training abbrechen.", schwere: "info", korrigiert: fix });
    for (const x of [...items]) {
      if (x.art === "lauf_4x4") entfernen(x, "beschwerden_4x4", "4×4-Intervall wegen aktueller Beschwerden entfernt.");
      else if (x.intensitaet === "hart") {
        if (fix) x.intensitaet = "mittel";
        warn.push({ code: "beschwerden_hart", text: `Intensität am ${x.datum} auf „mittel" reduziert.`, datum: x.datum, schwere: "info", korrigiert: fix });
      }
    }
  }

  // 3. Max. Intervall-Einheiten
  const x4 = items.filter((i) => i.art === "lauf_4x4");
  if (x4.length > ctx.settings.intervall_pro_woche_max) {
    for (const x of x4.slice(ctx.settings.intervall_pro_woche_max)) {
      entfernen(x, "intervall_max", `Mehr als ${ctx.settings.intervall_pro_woche_max} 4×4-Einheit(en) geplant — überzählige entfernt.`);
    }
  }

  // 4. Zeitfenster / Ausnahmen
  for (const x of [...items]) {
    if (istFix(ctx, x)) continue;
    const c = constraintAm(ctx, x.datum);
    if (c?.typ === "nicht_verfuegbar") {
      verschiebenOderEntfernen(x, "nicht_verfuegbar", `${x.datum} ist als nicht verfügbar markiert${c.notiz ? ` (${c.notiz})` : ""}`);
      continue;
    }
    if (!slotErlaubt(ctx, x)) {
      verschiebenOderEntfernen(x, "slot_ungueltig", `${slotArt(x)} am ${x.datum} ${x.tageszeit} ist kein freigegebenes Zeitfenster`);
      continue;
    }
    if (c?.typ === "eingeschraenkt" && istHart(x)) {
      if (x.art === "lauf_4x4") verschiebenOderEntfernen(x, "eingeschraenkt_hart", `Eingeschränkter Tag ${x.datum}: 4×4 nicht möglich`);
      else {
        if (fix) x.intensitaet = "locker";
        warn.push({ code: "eingeschraenkt_hart", text: `Eingeschränkter Tag ${x.datum}: Intensität auf „locker" gesetzt.`, datum: x.datum, schwere: "info", korrigiert: fix });
      }
    }
  }

  // 5. Kein 4×4 am Tag vor / am selben Tag wie Tennistraining/Match
  for (const x of [...items].filter((i) => i.art === "lauf_4x4")) {
    const tennisTage = items.filter(istTennisBelastung).map((i) => i.datum);
    if (tennisTage.some((d) => d === x.datum || d === addDays(x.datum, 1))) {
      verschiebenOderEntfernen(x, "x4_vor_tennis", `4×4 am ${x.datum} liegt am Tag vor/gleich Tennis`);
    }
  }

  // 6. Keine zwei harten Einheiten an aufeinanderfolgenden Tagen (inkl. Vorwochenrand)
  {
    const sortiert = () => [...items].filter(istHart).sort((a, b) => a.datum.localeCompare(b.datum));
    let guard = 0;
    let konflikt = true;
    while (konflikt && guard++ < 10) {
      konflikt = false;
      const harte = sortiert();
      for (const x of harte) {
        if (istFix(ctx, x)) continue;
        const andereHart = [...ctx.previousHardDates, ...harte.filter((h) => h !== x).map((h) => h.datum)];
        if (andereHart.some((d) => Math.abs(diffDays(d, x.datum)) <= 1)) {
          konflikt = true;
          if (x.art === "lauf_4x4") verschiebenOderEntfernen(x, "hart_folgetag", `4×4 am ${x.datum} direkt neben einer anderen harten Einheit`);
          else if (x.intensitaet === "hart") {
            if (fix) x.intensitaet = "mittel";
            warn.push({ code: "hart_folgetag", text: `Zwei harte Einheiten an Folgetagen: ${x.datum} auf „mittel" reduziert.`, datum: x.datum, schwere: "info", korrigiert: fix });
          } else {
            // Match o. ä. — nicht änderbar
            verschiebenOderEntfernen(x, "hart_folgetag", `Harte Einheit am ${x.datum} direkt neben einer anderen harten Einheit`);
          }
          if (!fix) break;
          break;
        }
      }
      if (!fix) break;
    }
  }

  // 7. Kraft: ≥ 48 h Abstand, nicht morgens vor Tennis
  {
    const kraft = () => items.filter((i) => i.art === "kraft").sort((a, b) => a.datum.localeCompare(b.datum));
    for (const x of kraft()) {
      const andereK = [...ctx.previousKraftDates, ...kraft().filter((k) => k !== x).map((k) => k.datum)];
      if (andereK.some((d) => Math.abs(diffDays(d, x.datum)) < 2 && d <= x.datum)) {
        verschiebenOderEntfernen(x, "kraft_abstand", `Kraft am ${x.datum}: weniger als 48 h zur vorherigen Krafteinheit`);
        continue;
      }
      if (x.tageszeit === "morgens" && items.some((i) => istTennisBelastung(i) && i.datum === x.datum)) {
        verschiebenOderEntfernen(x, "kraft_vor_tennis", `Kraft am Morgen vor Tennis (${x.datum})`);
      }
    }
    const n = items.filter((i) => i.art === "kraft").length;
    if (n < ctx.settings.kraft_pro_woche_ziel) {
      warn.push({ code: "kraft_ziel", text: `${n} von ${ctx.settings.kraft_pro_woche_ziel} Krafteinheiten geplant.`, schwere: "info", korrigiert: false });
    }
  }

  // 8. Mindestens ein kompletter Ruhetag
  {
    const belegt = new Set(items.map((i) => i.datum));
    if (belegt.size >= 7) {
      const kandidaten = items.filter((i) => !istFix(ctx, i)).sort((a, b) => itemLast(a) - itemLast(b));
      const x = kandidaten[0];
      if (x) entfernen(x, "ruhetag", `Kein Ruhetag in der Woche — ${x.art} am ${x.datum} entfernt.`);
      else warn.push({ code: "ruhetag", text: "Kein Ruhetag in der Woche.", schwere: "warnung", korrigiert: false });
    }
  }

  // 9. Wochenlast: max. +10 % ggü. Ø der letzten 3 Wochen; jede 4. Woche Entlastung (−30 %)
  const entlastung = istEntlastungswoche(ctx.weekIndex, ctx.settings.entlastungswoche_aktiv);
  const grenze = lastObergrenze(ctx.lastWeeksLoad, entlastung);
  if (entlastung) warn.push({ code: "entlastungswoche", text: "Entlastungswoche (jede 4. Woche): Ziel ca. −30 % Last.", schwere: "info", korrigiert: false });
  if (grenze !== null) {
    let last = planLast(items);
    if (last > grenze) {
      const vorher = last;
      if (fix) {
        // Intensitäten nicht-fester Einheiten stufenweise senken (hart→mittel→locker), harte zuerst
        const stufe: Intensitaet[] = ["hart", "mittel"];
        for (const s of stufe) {
          for (const x of items.filter((i) => !istFix(ctx, i) && i.intensitaet === s && i.art !== "lauf_4x4").sort((a, b) => itemLast(b) - itemLast(a))) {
            if (planLast(items) <= grenze) break;
            x.intensitaet = s === "hart" ? "mittel" : "locker";
          }
        }
        last = planLast(items);
      }
      warn.push({
        code: "wochenlast",
        text: `Geschätzte Wochenlast ${vorher} über Obergrenze ${grenze}${fix && last <= grenze ? ` → Intensitäten reduziert (jetzt ${last}).` : fix ? ` — auch nach Reduktion ${last}. Bitte Einheiten kürzen.` : "."}`,
        schwere: last > grenze ? "warnung" : "info",
        korrigiert: fix && last <= grenze,
      });
    }
  }

  items.sort((a, b) => a.datum.localeCompare(b.datum) || TZ_ORDER[a.tageszeit] - TZ_ORDER[b.tageszeit]);
  return { items, warnungen: warn, lastGeschaetzt: planLast(items), lastObergrenze: grenze, entlastungswoche: entlastung };
}

const TZ_ORDER: Record<PlanItem["tageszeit"], number> = { morgens: 0, mittags: 1, abends: 2 };

/** Kennzahlen für den KI-Kontext (deterministische Vorprüfung). */
export function kennzahlen(lastWeeksLoad: number[], hartAnteil: number, weekIndex: number, entlastungAktiv: boolean) {
  const entlastung = istEntlastungswoche(weekIndex, entlastungAktiv);
  const hist = lastWeeksLoad.filter((x) => x > 0).slice(0, 3);
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const letzte = lastWeeksLoad[0] ?? 0;
  const vorletzte = lastWeeksLoad[1] ?? 0;
  return {
    last_letzte_woche: letzte,
    last_avg_3_wochen: Math.round(avg),
    veraenderung_zur_vorwoche_prozent: vorletzte > 0 ? Math.round(((letzte - vorletzte) / vorletzte) * 100) : null,
    anteil_harte_einheiten_prozent: Math.round(hartAnteil * 100),
    entlastungswoche: entlastung,
    last_obergrenze_zielwoche: lastObergrenze(lastWeeksLoad, entlastung),
    historie_wochen: hist.length,
  };
}
