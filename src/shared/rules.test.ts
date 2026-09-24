import { describe, expect, it } from "vitest";
import { checkPlan, istEntlastungswoche, lastObergrenze, planLast, type RuleContext } from "./rules";
import type { Availability, PlanItem } from "./schemas";
import { PlanResponseSchema, normalizeAiResponse, PlanResponseAiSchema } from "./schemas";
import { weekStart, isoWeekday, addDays } from "./dates";

// Zielwoche: Montag 2026-09-28 … Sonntag 2026-10-04
const MO = "2026-09-28";
const DI = "2026-09-29";
const MI = "2026-09-30";
const DO = "2026-10-01";
const FR = "2026-10-02";
const SA = "2026-10-03";
const SO = "2026-10-04";

function availability(): Availability[] {
  const a: Availability[] = [
    { wochentag: 2, tageszeit: "abends", typ: "fix_tennis", erlaubte_arten: ["tennis"], dauer_min: 90 },
    { wochentag: 4, tageszeit: "abends", typ: "fix_tennis", erlaubte_arten: ["tennis"], dauer_min: 90 },
  ];
  for (const d of [1, 3, 5, 6, 7]) {
    a.push({ wochentag: d, tageszeit: "morgens", typ: "moeglich", erlaubte_arten: ["ballmaschine"], dauer_min: 60 });
    a.push({ wochentag: d, tageszeit: "abends", typ: "moeglich", erlaubte_arten: ["lauf_ga1", "lauf_4x4", "kraft"], dauer_min: 60 });
  }
  return a;
}

function ctx(over: Partial<RuleContext> = {}): RuleContext {
  return {
    wocheStart: MO,
    settings: { intervall_pro_woche_max: 1, kraft_pro_woche_ziel: 2, entlastungswoche_aktiv: true },
    availability: availability(),
    constraints: [],
    lastWeeksLoad: [],
    weekIndex: 0,
    beschwerdenAktuell: false,
    previousHardDates: [],
    previousKraftDates: [],
    ...over,
  };
}

const tennis = (datum: string, unterart = "training", tageszeit: PlanItem["tageszeit"] = "abends"): PlanItem => ({
  datum, tageszeit, art: "tennis", unterart, dauer_min: 90, intensitaet: "mittel", inhalt: {},
});
const ga1 = (datum: string, intensitaet: PlanItem["intensitaet"] = "locker"): PlanItem => ({
  datum, tageszeit: "abends", art: "lauf_ga1", unterart: null, dauer_min: 45, intensitaet, inhalt: {},
});
const x4 = (datum: string): PlanItem => ({
  datum, tageszeit: "abends", art: "lauf_4x4", unterart: null, dauer_min: 40, intensitaet: "hart",
  inhalt: { einlaufen_min: 10, wiederholungen: 4, belastung_min: 4, pause_min: 3, auslaufen_min: 5 },
});
const kraft = (datum: string, tageszeit: PlanItem["tageszeit"] = "abends"): PlanItem => ({
  datum, tageszeit, art: "kraft", unterart: null, dauer_min: 50, intensitaet: "mittel", inhalt: { uebungen: [{ name: "Kniebeuge", saetze: 3, wdh: 8 }] },
});
const basis = () => [tennis(DI), tennis(DO)];

describe("dates", () => {
  it("weekStart liefert Montag", () => {
    expect(weekStart(FR)).toBe(MO);
    expect(weekStart(MO)).toBe(MO);
    expect(weekStart(SO)).toBe(MO);
    expect(isoWeekday(SO)).toBe(7);
    expect(addDays(SO, 1)).toBe("2026-10-05");
  });
});

describe("Leitplanken", () => {
  it("feste Tennistermine werden ergänzt, wenn sie fehlen", () => {
    const r = checkPlan([ga1(MO)], ctx());
    const t = r.items.filter((i) => i.art === "tennis");
    expect(t.map((i) => i.datum)).toEqual([DI, DO]);
    expect(r.warnungen.some((w) => w.code === "fix_tennis_fehlt")).toBe(true);
  });

  it("feste Tennistermine werden nie überplant (kollidierende Einheit wird verschoben)", () => {
    const r = checkPlan([...basis(), ga1(DI)], ctx());
    expect(r.items.filter((i) => i.datum === DI)).toHaveLength(1);
    expect(r.items.filter((i) => i.art === "lauf_ga1")).toHaveLength(1);
    expect(r.items.find((i) => i.art === "lauf_ga1")!.datum).not.toBe(DI);
  });

  it("max. intervall_pro_woche_max 4×4-Einheiten", () => {
    const r = checkPlan([...basis(), x4(MO), x4(SA)], ctx());
    expect(r.items.filter((i) => i.art === "lauf_4x4")).toHaveLength(1);
    expect(r.warnungen.some((w) => w.code === "intervall_max")).toBe(true);
    const r2 = checkPlan([...basis(), x4(SA), x4(MO)], ctx({ settings: { intervall_pro_woche_max: 2, kraft_pro_woche_ziel: 2, entlastungswoche_aktiv: false } }));
    // MO liegt am Tag vor Tennis (DI) → wird verschoben/entfernt; SA bleibt
    expect(r2.items.some((i) => i.art === "lauf_4x4" && i.datum === SA)).toBe(true);
  });

  it("kein 4×4 am Tag vor oder am selben Tag wie Tennis", () => {
    const r = checkPlan([...basis(), x4(MI)], ctx());
    const i = r.items.find((x) => x.art === "lauf_4x4");
    expect(i).toBeDefined();
    expect([MI, DI, DO, MO]).not.toContain(i!.datum); // MI = Tag vor DO, MO = Tag vor DI
    expect(r.warnungen.some((w) => w.code === "x4_vor_tennis")).toBe(true);
  });

  it("keine zwei harten Einheiten an Folgetagen (auch über den Wochenrand)", () => {
    const r = checkPlan([...basis(), ga1(FR, "hart"), ga1(SA, "hart")], ctx());
    const hart = r.items.filter((i) => i.intensitaet === "hart").map((i) => i.datum).sort();
    for (let k = 1; k < hart.length; k++) {
      expect(Math.abs(new Date(hart[k]).getTime() - new Date(hart[k - 1]).getTime())).toBeGreaterThan(86_400_000);
    }
    const r2 = checkPlan([...basis(), ga1(MO, "hart")], ctx({ previousHardDates: ["2026-09-27"] }));
    expect(r2.items.find((i) => i.art === "lauf_ga1")!.intensitaet).toBe("mittel");
  });

  it("mindestens ein kompletter Ruhetag", () => {
    const voll = [...basis(), ga1(MO), ga1(MI), kraft(FR), ga1(SA), ga1(SO)];
    const r = checkPlan(voll, ctx({ lastWeeksLoad: [5000] }));
    const tage = new Set(r.items.map((i) => i.datum));
    expect(tage.size).toBeLessThanOrEqual(6);
    expect(r.warnungen.some((w) => w.code === "ruhetag")).toBe(true);
  });

  it("Kraft: ≥ 48 h Abstand und nicht morgens vor Tennis", () => {
    const r = checkPlan([...basis(), kraft(MO), kraft(MI)], ctx());
    const k = r.items.filter((i) => i.art === "kraft").map((i) => i.datum).sort();
    for (let i = 1; i < k.length; i++) {
      expect((new Date(k[i]).getTime() - new Date(k[i - 1]).getTime()) / 86_400_000).toBeGreaterThanOrEqual(2);
    }
    // Kraft morgens am Tennistag: morgens ist für Kraft kein Slot → verschoben
    const r2 = checkPlan([...basis(), kraft(DI, "morgens")], ctx());
    const k2 = r2.items.find((i) => i.art === "kraft");
    expect(!k2 || k2.datum !== DI).toBe(true);
    // Vorwoche: Kraft am Sonntag davor → Montag ungültig
    const r3 = checkPlan([...basis(), kraft(MO)], ctx({ previousKraftDates: ["2026-09-27"] }));
    const k3 = r3.items.find((i) => i.art === "kraft");
    expect(!k3 || k3.datum !== MO).toBe(true);
  });

  it("Wochenlast max. +10 % ggü. Ø der letzten 3 Wochen; ohne Historie konservativ", () => {
    expect(lastObergrenze([1000, 1200, 800], false)).toBe(1100);
    expect(lastObergrenze([], false)).toBe(1800);
    const plan = [...basis(), ga1(MO, "hart"), ga1(FR, "hart"), kraft(SA)];
    const last = planLast(plan);
    const r = checkPlan(plan, ctx({ lastWeeksLoad: [Math.round(last * 0.8)] }));
    expect(r.warnungen.some((w) => w.code === "wochenlast")).toBe(true);
    expect(r.lastGeschaetzt).toBeLessThanOrEqual(r.lastObergrenze! + 1e-9);
  });

  it("jede 4. Woche Entlastung (−30 %), deaktivierbar", () => {
    expect(istEntlastungswoche(3, true)).toBe(true);
    expect(istEntlastungswoche(7, true)).toBe(true);
    expect(istEntlastungswoche(4, true)).toBe(false);
    expect(istEntlastungswoche(3, false)).toBe(false);
    expect(lastObergrenze([1000], true)).toBe(700);
    const r = checkPlan(basis(), ctx({ weekIndex: 3 }));
    expect(r.entlastungswoche).toBe(true);
    expect(r.warnungen.some((w) => w.code === "entlastungswoche")).toBe(true);
  });

  it("nur freigegebene Zeitfenster; keine Einheiten an nicht_verfuegbar-Tagen", () => {
    const r = checkPlan([...basis(), { ...ga1(MO), tageszeit: "mittags" }], ctx());
    const g = r.items.find((i) => i.art === "lauf_ga1");
    expect(g && g.tageszeit).toBe("abends");
    const r2 = checkPlan([...basis(), ga1(SA)], ctx({ constraints: [{ datum: SA, typ: "nicht_verfuegbar", notiz: "Urlaub" }] }));
    expect(r2.items.some((i) => i.datum === SA)).toBe(false);
    // festes Tennis an nicht_verfuegbar-Tag wird nicht erzwungen
    const r3 = checkPlan([tennis(DO)], ctx({ constraints: [{ datum: DI, typ: "nicht_verfuegbar" }] }));
    expect(r3.items.some((i) => i.datum === DI)).toBe(false);
  });

  it("Beschwerden in den letzten 3 Tagen → keine harte Einheit + Hinweis", () => {
    const r = checkPlan([...basis(), x4(SA), ga1(MO, "hart")], ctx({ beschwerdenAktuell: true }));
    expect(r.items.some((i) => i.art === "lauf_4x4")).toBe(false);
    expect(r.items.every((i) => i.intensitaet !== "hart")).toBe(true);
    expect(r.warnungen.some((w) => w.code === "beschwerden")).toBe(true);
  });

  it("korrigieren=false meldet nur, ändert nichts", () => {
    const plan = [...basis(), x4(MI), x4(SA)];
    const r = checkPlan(plan, ctx(), { korrigieren: false });
    expect(r.items).toHaveLength(4);
    expect(r.warnungen.length).toBeGreaterThan(0);
    expect(r.warnungen.every((w) => !w.korrigiert || w.code === "ausserhalb_woche")).toBe(true);
  });

  it("gültiger Plan bleibt unverändert", () => {
    const plan = [...basis(), ga1(MO), kraft(FR), x4(SA)];
    const r = checkPlan(plan, ctx());
    expect(r.items.map((i) => `${i.datum}:${i.art}`)).toEqual([`${MO}:lauf_ga1`, `${DI}:tennis`, `${DO}:tennis`, `${FR}:kraft`, `${SA}:lauf_4x4`]);
    expect(r.warnungen.filter((w) => w.schwere !== "info")).toHaveLength(0);
  });
});

describe("Schemas", () => {
  it("KI-Antwort wird normalisiert und strikt validiert", () => {
    const ai = PlanResponseAiSchema.parse({
      woche_start: MO,
      begruendung: "Fokus Grundlage.",
      einheiten: [
        {
          datum: MO, tageszeit: "abends", art: "lauf_ga1", unterart: null, dauer_min: 45, intensitaet: "locker", hinweis: null,
          inhalt: { ziel_pace_von: "6:15", ziel_pace_bis: "6:45", hf_obergrenze: 145, einlaufen_min: null, wiederholungen: null, belastung_min: null, pause_min: null, hf_ziel_von: null, hf_ziel_bis: null, auslaufen_min: null, uebungen: null, schwerpunkt: null },
        },
        {
          datum: DI, tageszeit: "abends", art: "tennis", unterart: "training", dauer_min: 90, intensitaet: "mittel", hinweis: "Fester Termin",
          inhalt: { ziel_pace_von: null, ziel_pace_bis: null, hf_obergrenze: null, einlaufen_min: null, wiederholungen: null, belastung_min: null, pause_min: null, hf_ziel_von: null, hf_ziel_bis: null, auslaufen_min: null, uebungen: null, schwerpunkt: ["Rückhand longline"] },
        },
      ],
    });
    const strict = PlanResponseSchema.parse(normalizeAiResponse(ai));
    expect(strict.einheiten[0].inhalt).toEqual({ ziel_pace_von: "6:15", ziel_pace_bis: "6:45", hf_obergrenze: 145 });
    expect(strict.einheiten[1].inhalt).toEqual({ schwerpunkt: ["Rückhand longline"] });
  });

  it("ungültiger Inhalt je Art wird abgelehnt", () => {
    const bad = PlanResponseSchema.safeParse({
      woche_start: MO,
      begruendung: "x",
      einheiten: [{ datum: MO, tageszeit: "abends", art: "lauf_4x4", unterart: null, dauer_min: 40, intensitaet: "hart", inhalt: { wiederholungen: 4 } }],
    });
    expect(bad.success).toBe(false);
  });
});
