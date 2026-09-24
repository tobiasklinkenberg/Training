import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ART_LABEL,
  SessionInputSchema,
  TENNIS_SCHWERPUNKTE,
  TENNIS_UNTERART,
  UNTERART_LABEL,
  hfZone,
  paceToSeconds,
  secondsToPace,
  type Art,
  type IntervalRep,
  type SessionInput,
  type StrengthSet,
  type TennisUnterart,
} from "../../shared/schemas";
import { todayIso } from "../../shared/dates";
import { useExercises, useLastStrength, useSettings, useStrecken } from "../../shared/queries";
import { saveSession } from "../../offline/sync";
import { Banner, Button, Card, Chips, Field, H1, H2, Input, NumberInput, Scale, Select, Textarea, cx } from "../../shared/ui";
import type { PlanItemRow } from "../../shared/types";

// „Letzte Werte" je Art (localStorage) — für die < 30-Sekunden-Erfassung.
const LAST_KEY = (art: Art) => `trn.last.${art}`;
function loadLast<T>(art: Art): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY(art)) ?? "{}") as Partial<T>;
  } catch {
    return {};
  }
}
function storeLast(art: Art, v: unknown) {
  try {
    localStorage.setItem(LAST_KEY(art), JSON.stringify(v));
  } catch {
    /* ignorieren */
  }
}

const KOERPERSTELLEN = ["", "Knie", "Hüfte", "Rücken", "Schulter", "Ellenbogen", "Handgelenk", "Wade", "Achillessehne", "Fuß", "Oberschenkel", "Sonstiges"];

interface Common {
  datum: string;
  startzeit: string;
  dauer_min: number | null;
  srpe: number | null;
  befinden_vorher: number | null;
  beschwerden: string;
  beschwerden_stelle: string;
  notiz: string;
}

export default function SessionForm({ art, planItem }: { art: Art; planItem?: PlanItemRow }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const settings = useSettings();
  const last = useMemo(() => loadLast<Record<string, unknown>>(art), [art]);
  const inhalt = (planItem?.inhalt ?? {}) as Record<string, unknown>;

  const [c, setC] = useState<Common>({
    datum: planItem?.datum ?? todayIso(),
    startzeit: "",
    dauer_min: planItem?.dauer_min ?? (last.dauer_min as number | undefined) ?? (art === "tennis" ? 90 : art === "kraft" ? 50 : 45),
    srpe: null,
    befinden_vorher: null,
    beschwerden: "",
    beschwerden_stelle: "",
    notiz: "",
  });
  const up = (p: Partial<Common>) => setC((s) => ({ ...s, ...p }));

  // Tennis
  const [unterart, setUnterart] = useState<TennisUnterart>((planItem?.unterart as TennisUnterart) ?? (last.unterart as TennisUnterart) ?? "training");
  const [schwerpunkte, setSchwerpunkte] = useState<string[]>((inhalt.schwerpunkt as string[]) ?? (last.schwerpunkte as string[]) ?? []);
  const [programm, setProgramm] = useState<string>((inhalt.programm as string) ?? "");

  // GA1
  const strecken = useStrecken();
  const [distanz, setDistanz] = useState<number | null>((inhalt.distanz_km as number) ?? (last.distanz_km as number) ?? null);
  const [hfAvg, setHfAvg] = useState<number | null>(null);
  const [hfMax, setHfMax] = useState<number | null>(null);
  const [streckeId, setStreckeId] = useState<string>((last.strecke_id as string) ?? "");

  // 4×4
  const [struktur, setStruktur] = useState({
    einlaufen_min: (inhalt.einlaufen_min as number) ?? 10,
    wiederholungen: (inhalt.wiederholungen as number) ?? 4,
    belastung_min: (inhalt.belastung_min as number) ?? 4,
    pause_min: (inhalt.pause_min as number) ?? 3,
    auslaufen_min: (inhalt.auslaufen_min as number) ?? 5,
  });
  const [reps, setReps] = useState<(IntervalRep & { pace: string })[]>(() =>
    Array.from({ length: (inhalt.wiederholungen as number) ?? 4 }, (_, i) => ({ nr: i + 1, pace: "", dauer_sek: null, distanz_m: null, hf_avg: null, hf_max: null, rpe: null })),
  );

  // Kraft
  const exercises = useExercises();
  const lastStrength = useLastStrength();
  const [saetze, setSaetze] = useState<Record<string, StrengthSet[]>>({});
  const [reihenfolge, setReihenfolge] = useState<string[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kraft: aus Plan vorbelegen (Übungsnamen → Katalog)
  useMemo(() => {
    if (art !== "kraft" || !exercises.data || reihenfolge.length > 0) return;
    const geplant = (inhalt.uebungen as { name: string; saetze: number; wdh: number; gewicht_kg?: number }[] | undefined) ?? [];
    const init: Record<string, StrengthSet[]> = {};
    const order: string[] = [];
    for (const u of geplant) {
      const ex = exercises.data.find((e) => e.name.toLowerCase() === u.name.toLowerCase());
      if (!ex) continue;
      order.push(ex.id);
      init[ex.id] = Array.from({ length: u.saetze }, (_, i) => ({ exercise_id: ex.id, satz_nr: i + 1, wdh: u.wdh, gewicht_kg: u.gewicht_kg ?? 0, rir: null }));
    }
    if (order.length) {
      setReihenfolge(order);
      setSaetze(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, exercises.data]);

  function addExercise(id: string) {
    if (reihenfolge.includes(id)) return;
    const prev = lastStrength.data?.[id]?.saetze;
    const init: StrengthSet[] = prev?.length
      ? prev.map((s) => ({ exercise_id: id, satz_nr: s.satz_nr, wdh: s.wdh, gewicht_kg: Number(s.gewicht_kg), rir: null }))
      : [1, 2, 3].map((n) => ({ exercise_id: id, satz_nr: n, wdh: 8, gewicht_kg: 0, rir: null }));
    setReihenfolge((r) => [...r, id]);
    setSaetze((s) => ({ ...s, [id]: init }));
  }
  function setSet(id: string, idx: number, patch: Partial<StrengthSet>) {
    setSaetze((s) => ({ ...s, [id]: s[id].map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  }

  const paceSek = distanz && c.dauer_min ? Math.round((c.dauer_min * 60) / distanz) : null;
  const hfmax = settings.data?.hf_max ?? null;
  const zone = hfZone(hfmax, 85, 95);
  const pauseZone = hfZone(hfmax, 60, 70);

  function build(): SessionInput | null {
    const base = {
      client_id: crypto.randomUUID(),
      datum: c.datum,
      startzeit: c.startzeit || null,
      dauer_min: c.dauer_min ?? 0,
      srpe: c.srpe ?? 0,
      geplant: Boolean(planItem),
      plan_item_id: planItem?.id ?? null,
      befinden_vorher: c.befinden_vorher,
      beschwerden: c.beschwerden || null,
      beschwerden_stelle: c.beschwerden_stelle || null,
      notiz: c.notiz || null,
    };
    if (art === "tennis") return { ...base, art, unterart, schwerpunkte, programm: unterart === "ballmaschine" ? programm || null : null };
    if (art === "lauf_ga1") return { ...base, art, unterart: null, distanz_km: distanz ?? 0, hf_avg: hfAvg, hf_max: hfMax, strecke_id: streckeId || null };
    if (art === "lauf_4x4")
      return {
        ...base,
        art,
        unterart: null,
        struktur,
        intervalle: reps.slice(0, struktur.wiederholungen).map((r) => ({
          nr: r.nr,
          dauer_sek: r.dauer_sek ?? struktur.belastung_min * 60,
          distanz_m: r.distanz_m ?? (r.pace ? Math.round(((struktur.belastung_min * 60) / (paceToSeconds(r.pace) ?? 1)) * 1000) : null),
          hf_avg: r.hf_avg,
          hf_max: r.hf_max,
          rpe: r.rpe,
        })),
      };
    const all = reihenfolge.flatMap((id) => saetze[id] ?? []);
    return { ...base, art, unterart: null, saetze: all };
  }

  async function submit() {
    setErr(null);
    const input = build();
    const parsed = SessionInputSchema.safeParse(input);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      const feld = String(i.path[0] ?? "");
      const labels: Record<string, string> = { dauer_min: "Dauer", srpe: "Session-RPE", distanz_km: "Distanz", saetze: "Sätze", intervalle: "Intervalle" };
      setErr(`${labels[feld] ?? feld}: ${i.message}`);
      return;
    }
    setBusy(true);
    try {
      const status = await saveSession(parsed.data);
      const d = parsed.data;
      storeLast(art, {
        dauer_min: d.dauer_min,
        unterart: d.art === "tennis" ? d.unterart : undefined,
        schwerpunkte: d.art === "tennis" ? d.schwerpunkte : undefined,
        distanz_km: d.art === "lauf_ga1" ? d.distanz_km : undefined,
        strecke_id: d.art === "lauf_ga1" ? d.strecke_id : undefined,
      });
      qc.invalidateQueries();
      nav("/", { state: { toast: status === "gepuffert" ? "Offline gespeichert — wird synchronisiert." : "Einheit gespeichert." } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>{ART_LABEL[art]}</H1>
        <Button variant="ghost" onClick={() => nav(-1)}>
          Abbrechen
        </Button>
      </div>
      {planItem && <Banner tone="info">Vorbelegt aus dem Plan ({planItem.dauer_min} min, {planItem.intensitaet}).</Banner>}

      {/* Artspezifisch */}
      {art === "tennis" && (
        <Card>
          <Field label="Unterart">
            <Chips options={TENNIS_UNTERART} value={unterart} onChange={(v) => v && setUnterart(v as TennisUnterart)} labels={UNTERART_LABEL} />
          </Field>
          <Field label="Schwerpunkt (mehrfach)" className="mt-3">
            <Chips options={TENNIS_SCHWERPUNKTE} value={schwerpunkte} multi onChange={(v) => setSchwerpunkte((v as string[]) ?? [])} />
          </Field>
          {unterart === "ballmaschine" && (
            <Field label="Übungsprogramm" className="mt-3">
              <Textarea value={programm} onChange={(e) => setProgramm(e.target.value)} placeholder="z. B. 3×20 Rückhand longline, 3×20 Vorhand cross …" />
            </Field>
          )}
        </Card>
      )}

      {art === "lauf_ga1" && (
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distanz (km)">
              <NumberInput value={distanz} onChange={setDistanz} step={0.1} placeholder="z. B. 7,5" />
            </Field>
            <Field label="Pace">
              <div className="tap flex items-center text-lg font-semibold">{secondsToPace(paceSek)} min/km</div>
            </Field>
            <Field label="Ø-HF (optional)">
              <NumberInput value={hfAvg} onChange={setHfAvg} />
            </Field>
            <Field label="max. HF (optional)">
              <NumberInput value={hfMax} onChange={setHfMax} />
            </Field>
          </div>
          {strecken.data && strecken.data.length > 0 && (
            <Field label="Strecke" className="mt-3">
              <Select
                value={streckeId}
                onChange={(e) => {
                  setStreckeId(e.target.value);
                  const s = strecken.data?.find((x) => x.id === e.target.value);
                  if (s?.distanz_km) setDistanz(Number(s.distanz_km));
                }}
              >
                <option value="">— keine —</option>
                {strecken.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.distanz_km ? ` (${s.distanz_km} km)` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </Card>
      )}

      {art === "lauf_4x4" && (
        <Card>
          <H2>Struktur</H2>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {(
              [
                ["einlaufen_min", "Einl."],
                ["wiederholungen", "Wdh."],
                ["belastung_min", "Bel."],
                ["pause_min", "Pause"],
                ["auslaufen_min", "Ausl."],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l}>
                <NumberInput
                  value={struktur[k]}
                  onChange={(v) => {
                    const n = v ?? 0;
                    setStruktur((s) => ({ ...s, [k]: n }));
                    if (k === "wiederholungen")
                      setReps((r) => Array.from({ length: Math.max(1, n) }, (_, i) => r[i] ?? { nr: i + 1, pace: "", dauer_sek: null, distanz_m: null, hf_avg: null, hf_max: null, rpe: null }));
                  }}
                />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {zone ? `Ziel intensiv: ${zone.von}–${zone.bis} (85–95 % HFmax) · Pause: ${pauseZone!.von}–${pauseZone!.bis}` : "HFmax in den Einstellungen eintragen, um Zielbereiche zu sehen."}
          </p>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>#</span>
              <span>Pace</span>
              <span>Ø-HF</span>
              <span>max HF</span>
              <span>RPE</span>
            </div>
            {reps.slice(0, struktur.wiederholungen).map((r, i) => (
              <div key={r.nr} className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] items-center gap-1">
                <span className="text-sm font-semibold">{r.nr}</span>
                <Input value={r.pace} placeholder="5:30" inputMode="numeric" onChange={(e) => setReps((x) => x.map((y, j) => (j === i ? { ...y, pace: e.target.value } : y)))} />
                <NumberInput value={r.hf_avg} onChange={(v) => setReps((x) => x.map((y, j) => (j === i ? { ...y, hf_avg: v } : y)))} />
                <NumberInput value={r.hf_max} onChange={(v) => setReps((x) => x.map((y, j) => (j === i ? { ...y, hf_max: v } : y)))} />
                <NumberInput value={r.rpe} onChange={(v) => setReps((x) => x.map((y, j) => (j === i ? { ...y, rpe: v } : y)))} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {art === "kraft" && (
        <Card>
          <H2>Übungen</H2>
          {reihenfolge.map((id) => {
            const ex = exercises.data?.find((e) => e.id === id);
            const prev = lastStrength.data?.[id];
            return (
              <div key={id} className="mt-3 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ex?.name}</span>
                  <Button variant="ghost" className="min-h-8 px-2 text-sm" onClick={() => setReihenfolge((r) => r.filter((x) => x !== id))}>
                    entfernen
                  </Button>
                </div>
                {prev && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Letztes Mal ({prev.datum}): {prev.saetze.map((s) => `${s.wdh}×${s.gewicht_kg}`).join(" · ")}
                  </p>
                )}
                <div className="mt-1 grid grid-cols-[2rem_1fr_1fr_1fr] gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>#</span>
                  <span>Wdh</span>
                  <span>kg</span>
                  <span>RIR</span>
                </div>
                {(saetze[id] ?? []).map((s, i) => (
                  <div key={i} className="mt-1 grid grid-cols-[2rem_1fr_1fr_1fr] items-center gap-1">
                    <span className="text-sm">{s.satz_nr}</span>
                    <NumberInput value={s.wdh} onChange={(v) => setSet(id, i, { wdh: v ?? 0 })} />
                    <NumberInput value={s.gewicht_kg} step={0.5} onChange={(v) => setSet(id, i, { gewicht_kg: v ?? 0 })} />
                    <NumberInput value={s.rir} onChange={(v) => setSet(id, i, { rir: v })} />
                  </div>
                ))}
                <Button
                  variant="secondary"
                  className="mt-2 min-h-10 w-full text-sm"
                  onClick={() =>
                    setSaetze((x) => {
                      const l = x[id][x[id].length - 1];
                      return { ...x, [id]: [...x[id], { ...l, satz_nr: l.satz_nr + 1 }] };
                    })
                  }
                >
                  + Satz
                </Button>
              </div>
            );
          })}
          <Field label="Übung hinzufügen" className="mt-3">
            <Select value="" onChange={(e) => e.target.value && addExercise(e.target.value)}>
              <option value="">— wählen —</option>
              {exercises.data
                ?.filter((e) => e.aktiv && !reihenfolge.includes(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </Select>
          </Field>
        </Card>
      )}

      {/* Gemeinsame Felder */}
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            <Input type="date" value={c.datum} onChange={(e) => up({ datum: e.target.value })} />
          </Field>
          <Field label="Startzeit (optional)">
            <Input type="time" value={c.startzeit} onChange={(e) => up({ startzeit: e.target.value })} />
          </Field>
          <Field label="Dauer (min)">
            <NumberInput value={c.dauer_min} onChange={(v) => up({ dauer_min: v })} />
          </Field>
        </div>
        <Field label="Session-RPE (1 = sehr leicht, 10 = maximal)" className="mt-3">
          <Scale max={10} value={c.srpe} onChange={(v) => up({ srpe: v })} />
        </Field>
        <Field label="Befinden vorher (optional)" className="mt-3">
          <Scale max={5} value={c.befinden_vorher} onChange={(v) => up({ befinden_vorher: v })} labels={["schlecht", "top"]} />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Beschwerden (optional)">
            <Input value={c.beschwerden} onChange={(e) => up({ beschwerden: e.target.value })} placeholder="z. B. Ziehen" />
          </Field>
          <Field label="Körperstelle">
            <Select value={c.beschwerden_stelle} onChange={(e) => up({ beschwerden_stelle: e.target.value })}>
              {KOERPERSTELLEN.map((k) => (
                <option key={k} value={k}>
                  {k || "—"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notiz" className="mt-3">
          <Textarea value={c.notiz} onChange={(e) => up({ notiz: e.target.value })} />
        </Field>
      </Card>

      {err && <Banner tone="error">{err}</Banner>}
      <Button className={cx("w-full text-lg")} disabled={busy} onClick={submit}>
        {busy ? "Speichern …" : "Speichern"}
      </Button>
    </div>
  );
}
