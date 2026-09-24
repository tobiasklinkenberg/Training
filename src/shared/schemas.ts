// zod-Schemas — gemeinsam für Frontend-Formulare und Edge Function `trn-plan`.
// Die Edge Function erhält eine Kopie über scripts/sync-shared.mjs (_shared/).
import { z } from "zod";

// ---------------------------------------------------------------------------
// Grundtypen
// ---------------------------------------------------------------------------
export const ART = ["tennis", "lauf_ga1", "lauf_4x4", "kraft"] as const;
export const ArtSchema = z.enum(ART);
export type Art = z.infer<typeof ArtSchema>;

export const TENNIS_UNTERART = ["training", "ballmaschine", "sparring", "match"] as const;
export const TennisUnterartSchema = z.enum(TENNIS_UNTERART);
export type TennisUnterart = z.infer<typeof TennisUnterartSchema>;

/** Planbare Art — Tennis wird in Zeitfenstern nach Training vs. Ballmaschine unterschieden. */
export const SLOT_ART = ["tennis", "ballmaschine", "lauf_ga1", "lauf_4x4", "kraft"] as const;
export const SlotArtSchema = z.enum(SLOT_ART);
export type SlotArt = z.infer<typeof SlotArtSchema>;

export const TAGESZEIT = ["morgens", "mittags", "abends"] as const;
export const TageszeitSchema = z.enum(TAGESZEIT);
export type Tageszeit = z.infer<typeof TageszeitSchema>;

export const INTENSITAET = ["locker", "mittel", "hart"] as const;
export const IntensitaetSchema = z.enum(INTENSITAET);
export type Intensitaet = z.infer<typeof IntensitaetSchema>;

export const TENNIS_SCHWERPUNKTE = ["Grundschläge", "Aufschlag", "Return", "Volley", "Beinarbeit", "Spielformen"] as const;

export const ART_LABEL: Record<Art, string> = {
  tennis: "Tennis",
  lauf_ga1: "Lauf GA1",
  lauf_4x4: "Lauf 4×4",
  kraft: "Kraft",
};
export const UNTERART_LABEL: Record<TennisUnterart, string> = {
  training: "Training",
  ballmaschine: "Ballmaschine",
  sparring: "Sparring",
  match: "Match",
};

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format YYYY-MM-DD");
const TimeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Uhrzeit HH:MM");

// ---------------------------------------------------------------------------
// Einstellungen / Zeitfenster / Ausnahmen
// ---------------------------------------------------------------------------
export const SettingsSchema = z.object({
  hf_max: z.number().int().min(100).max(230).nullable(),
  hf_ruhe: z.number().int().min(30).max(120).nullable(),
  ziel: z.string().min(1).max(200),
  ziel_typ: z.enum(["spielfitness", "ausdauer", "kraft", "wettkampf", "sonstiges"]),
  wochenstart: z.number().int().min(1).max(7),
  kraft_pro_woche_ziel: z.number().int().min(0).max(7),
  intervall_pro_woche_max: z.number().int().min(0).max(3),
  entlastungswoche_aktiv: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const AvailabilitySchema = z.object({
  id: z.string().uuid().optional(),
  wochentag: z.number().int().min(1).max(7),
  tageszeit: TageszeitSchema,
  typ: z.enum(["fix_tennis", "moeglich"]),
  erlaubte_arten: z.array(SlotArtSchema),
  dauer_min: z.number().int().min(10).max(300),
});
export type Availability = z.infer<typeof AvailabilitySchema>;

export const WeekConstraintSchema = z.object({
  id: z.string().uuid().optional(),
  datum: IsoDateSchema,
  typ: z.enum(["nicht_verfuegbar", "eingeschraenkt"]),
  notiz: z.string().max(200).nullable().optional(),
});
export type WeekConstraint = z.infer<typeof WeekConstraintSchema>;

// ---------------------------------------------------------------------------
// Erfassung einer Einheit
// ---------------------------------------------------------------------------
const SessionCommon = z.object({
  client_id: z.string().uuid(),
  datum: IsoDateSchema,
  startzeit: TimeSchema.nullable().optional(),
  dauer_min: z.number().int().min(1).max(600),
  srpe: z.number().int().min(1).max(10),
  geplant: z.boolean(),
  plan_item_id: z.string().uuid().nullable().optional(),
  befinden_vorher: z.number().int().min(1).max(5).nullable().optional(),
  beschwerden: z.string().max(500).nullable().optional(),
  beschwerden_stelle: z.string().max(100).nullable().optional(),
  notiz: z.string().max(1000).nullable().optional(),
});

export const TennisSessionSchema = SessionCommon.extend({
  art: z.literal("tennis"),
  unterart: TennisUnterartSchema,
  schwerpunkte: z.array(z.string().max(60)).max(10),
  programm: z.string().max(500).nullable().optional(),
});

export const RunGa1SessionSchema = SessionCommon.extend({
  art: z.literal("lauf_ga1"),
  unterart: z.null().optional(),
  distanz_km: z.number().min(0.1).max(100),
  hf_avg: z.number().int().min(40).max(230).nullable().optional(),
  hf_max: z.number().int().min(40).max(230).nullable().optional(),
  strecke_id: z.string().uuid().nullable().optional(),
});

export const IntervalRepSchema = z.object({
  nr: z.number().int().min(1).max(12),
  dauer_sek: z.number().int().min(30).max(1800).nullable().optional(),
  distanz_m: z.number().int().min(50).max(5000).nullable().optional(),
  hf_avg: z.number().int().min(40).max(230).nullable().optional(),
  hf_max: z.number().int().min(40).max(230).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
});
export type IntervalRep = z.infer<typeof IntervalRepSchema>;

export const Run4x4SessionSchema = SessionCommon.extend({
  art: z.literal("lauf_4x4"),
  unterart: z.null().optional(),
  struktur: z.object({
    einlaufen_min: z.number().int().min(0).max(30),
    wiederholungen: z.number().int().min(1).max(12),
    belastung_min: z.number().int().min(1).max(15),
    pause_min: z.number().int().min(0).max(10),
    auslaufen_min: z.number().int().min(0).max(30),
  }),
  intervalle: z.array(IntervalRepSchema).min(1).max(12),
});

export const StrengthSetSchema = z.object({
  exercise_id: z.string().uuid(),
  satz_nr: z.number().int().min(1).max(20),
  wdh: z.number().int().min(1).max(100),
  gewicht_kg: z.number().min(0).max(500),
  rir: z.number().int().min(0).max(10).nullable().optional(),
});
export type StrengthSet = z.infer<typeof StrengthSetSchema>;

export const StrengthSessionSchema = SessionCommon.extend({
  art: z.literal("kraft"),
  unterart: z.null().optional(),
  saetze: z.array(StrengthSetSchema).min(1).max(100),
});

export const SessionInputSchema = z.discriminatedUnion("art", [
  TennisSessionSchema,
  RunGa1SessionSchema,
  Run4x4SessionSchema,
  StrengthSessionSchema,
]);
export type SessionInput = z.infer<typeof SessionInputSchema>;

export const DailyCheckSchema = z.object({
  datum: IsoDateSchema,
  schlaf: z.number().int().min(1).max(5).nullable(),
  energie: z.number().int().min(1).max(5).nullable(),
  muskelkater: z.number().int().min(1).max(5).nullable(),
});
export type DailyCheck = z.infer<typeof DailyCheckSchema>;

// ---------------------------------------------------------------------------
// Wochenplan — Inhalt je Art
// ---------------------------------------------------------------------------
const PaceSchema = z.string().regex(/^\d{1,2}:\d{2}$/, "Pace als m:ss");

export const InhaltGa1Schema = z.object({
  ziel_pace_von: PaceSchema.optional(),
  ziel_pace_bis: PaceSchema.optional(),
  hf_obergrenze: z.number().int().min(80).max(230).optional(),
  distanz_km: z.number().min(1).max(50).optional(),
});
export const Inhalt4x4Schema = z.object({
  einlaufen_min: z.number().int().min(0).max(30),
  wiederholungen: z.number().int().min(1).max(8),
  belastung_min: z.number().int().min(1).max(10),
  pause_min: z.number().int().min(0).max(10),
  hf_ziel_von: z.number().int().min(80).max(230).optional(),
  hf_ziel_bis: z.number().int().min(80).max(230).optional(),
  auslaufen_min: z.number().int().min(0).max(30),
});
export const InhaltKraftSchema = z.object({
  uebungen: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        saetze: z.number().int().min(1).max(10),
        wdh: z.number().int().min(1).max(50),
        gewicht_kg: z.number().min(0).max(500).optional(),
      }),
    )
    .min(1)
    .max(15),
});
export const InhaltTennisSchema = z.object({
  schwerpunkt: z.array(z.string().min(1).max(80)).max(6).optional(),
  programm: z.string().max(500).optional(),
});

/** Ein Planelement (Vorschlag oder aktiver Plan). `inhalt` wird per superRefine artspezifisch geprüft. */
export const PlanItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    datum: IsoDateSchema,
    tageszeit: TageszeitSchema,
    art: ArtSchema,
    unterart: z.string().max(30).nullable().optional(),
    dauer_min: z.number().int().min(10).max(300),
    intensitaet: IntensitaetSchema,
    inhalt: z.record(z.string(), z.unknown()).default({}),
    hinweis: z.string().max(300).nullable().optional(),
    erledigt: z.boolean().optional(),
  })
  .superRefine((item, ctx) => {
    const schema =
      item.art === "lauf_ga1"
        ? InhaltGa1Schema
        : item.art === "lauf_4x4"
          ? Inhalt4x4Schema
          : item.art === "kraft"
            ? InhaltKraftSchema
            : InhaltTennisSchema;
    const r = schema.safeParse(item.inhalt);
    if (!r.success) {
      ctx.addIssue({ code: "custom", path: ["inhalt"], message: `Inhalt passt nicht zur Art ${item.art}: ${r.error.issues[0]?.message ?? ""}` });
    }
    if (item.art === "tennis" && item.unterart && !TENNIS_UNTERART.includes(item.unterart as TennisUnterart)) {
      ctx.addIssue({ code: "custom", path: ["unterart"], message: "Unbekannte Tennis-Unterart" });
    }
  });
export type PlanItem = z.infer<typeof PlanItemSchema>;

/** Antwort von Claude (strikt, mit Wertebereichen). */
export const PlanResponseSchema = z.object({
  woche_start: IsoDateSchema,
  begruendung: z.string().min(1).max(600),
  einheiten: z.array(PlanItemSchema).min(1).max(14),
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

/**
 * Schema für Structured Outputs (JSON-Schema-kompatibel: keine Regex-/min-/max-Constraints,
 * flaches `inhalt`-Objekt). Die strikte Prüfung erfolgt danach mit PlanResponseSchema.
 */
export const PlanResponseAiSchema = z.object({
  woche_start: z.string().describe("Montag der Zielwoche, YYYY-MM-DD"),
  begruendung: z.string().describe("Max. 3 Sätze: Fokus der Woche und warum"),
  einheiten: z.array(
    z.object({
      datum: z.string().describe("YYYY-MM-DD"),
      tageszeit: TageszeitSchema,
      art: ArtSchema,
      unterart: z.string().nullable().describe("bei tennis: training|ballmaschine|sparring|match, sonst null"),
      dauer_min: z.number().int(),
      intensitaet: IntensitaetSchema,
      hinweis: z.string().nullable().describe("optional, 1 Satz"),
      inhalt: z.object({
        // lauf_ga1
        ziel_pace_von: z.string().nullable().describe("m:ss, nur lauf_ga1"),
        ziel_pace_bis: z.string().nullable().describe("m:ss, nur lauf_ga1"),
        hf_obergrenze: z.number().int().nullable().describe("nur lauf_ga1, nur wenn hf_max bekannt"),
        // lauf_4x4
        einlaufen_min: z.number().int().nullable(),
        wiederholungen: z.number().int().nullable(),
        belastung_min: z.number().int().nullable(),
        pause_min: z.number().int().nullable(),
        hf_ziel_von: z.number().int().nullable(),
        hf_ziel_bis: z.number().int().nullable(),
        auslaufen_min: z.number().int().nullable(),
        // kraft
        uebungen: z
          .array(
            z.object({
              name: z.string(),
              saetze: z.number().int(),
              wdh: z.number().int(),
              gewicht_kg: z.number().nullable(),
            }),
          )
          .nullable()
          .describe("nur kraft"),
        // tennis
        schwerpunkt: z.array(z.string()).nullable().describe("nur tennis"),
      }),
    }),
  ),
});
export type PlanResponseAi = z.infer<typeof PlanResponseAiSchema>;

/** Entfernt null-Felder aus dem flachen KI-Inhalt und liefert das artspezifische Objekt. */
export function normalizeAiResponse(ai: PlanResponseAi): unknown {
  return {
    woche_start: ai.woche_start,
    begruendung: ai.begruendung,
    einheiten: ai.einheiten.map((e) => {
      const inhalt: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(e.inhalt)) {
        if (v === null || v === undefined) continue;
        if (k === "uebungen" && Array.isArray(v)) {
          inhalt[k] = (v as { name: string; saetze: number; wdh: number; gewicht_kg: number | null }[]).map((u) => {
            const o: Record<string, unknown> = { name: u.name, saetze: u.saetze, wdh: u.wdh };
            if (u.gewicht_kg !== null && u.gewicht_kg !== undefined) o.gewicht_kg = u.gewicht_kg;
            return o;
          });
        } else inhalt[k] = v;
      }
      return {
        datum: e.datum,
        tageszeit: e.tageszeit,
        art: e.art,
        unterart: e.art === "tennis" ? (e.unterart ?? "training") : null,
        dauer_min: e.dauer_min,
        intensitaet: e.intensitaet,
        inhalt,
        hinweis: e.hinweis ?? null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Leitplanken-Ergebnis
// ---------------------------------------------------------------------------
export const WarnungSchema = z.object({
  code: z.string(),
  text: z.string(),
  datum: IsoDateSchema.nullable().optional(),
  schwere: z.enum(["info", "warnung", "fehler"]),
  korrigiert: z.boolean(),
});
export type Warnung = z.infer<typeof WarnungSchema>;

// ---------------------------------------------------------------------------
// Edge-Function-Vertrag
// ---------------------------------------------------------------------------
export const PlanRequestSchema = z.object({
  woche_start: IsoDateSchema.optional(),
  modus: z.enum(["claude", "vorwoche"]).default("claude"),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/** Hilfsfunktionen für Pace und HF-Zonen (gemeinsam). */
export function paceToSeconds(p: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(p);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
export function secondsToPace(s: number | null | undefined): string {
  if (!s || !isFinite(s) || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
export function hfZone(hfMax: number | null | undefined, von: number, bis: number): { von: number; bis: number } | null {
  if (!hfMax) return null;
  return { von: Math.round((hfMax * von) / 100), bis: Math.round((hfMax * bis) / 100) };
}
