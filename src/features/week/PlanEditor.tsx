// Bearbeiten eines Plans (Vorschlag oder aktiv): Einheiten verschieben, ändern, löschen, ergänzen.
// Leitplanken laufen live (korrigieren=false) und zeigen Warnungen an.
import { useMemo, useState } from "react";
import { ART, ART_LABEL, INTENSITAET, TAGESZEIT, TENNIS_SCHWERPUNKTE, TENNIS_UNTERART, UNTERART_LABEL, type Art, type PlanItem, type Warnung } from "../../shared/schemas";
import { checkPlan, planLast, type RuleContext } from "../../shared/rules";
import { formatDatum, weekDates } from "../../shared/dates";
import { artLabel, inhaltKurz } from "../../shared/format";
import { Banner, Button, Card, Chips, Field, Input, NumberInput, Select, cx } from "../../shared/ui";

export function WarnungenListe({ warnungen }: { warnungen: Warnung[] }) {
  if (!warnungen.length) return null;
  return (
    <ul className="space-y-1">
      {warnungen.map((w, i) => (
        <li key={i}>
          <Banner tone={w.schwere === "info" ? "info" : w.schwere === "fehler" ? "error" : "warn"}>
            {w.korrigiert ? "✔ " : ""}
            {w.text}
          </Banner>
        </li>
      ))}
    </ul>
  );
}

export default function PlanEditor({
  wocheStart,
  items,
  onChange,
  ctx,
}: {
  wocheStart: string;
  items: PlanItem[];
  onChange: (items: PlanItem[]) => void;
  ctx: RuleContext | null;
}) {
  const [edit, setEdit] = useState<number | null>(null);
  const tage = weekDates(wocheStart);
  const live = useMemo(() => (ctx ? checkPlan(items, ctx, { korrigieren: false }) : null), [items, ctx]);

  function neu() {
    const it: PlanItem = { datum: tage[0], tageszeit: "abends", art: "lauf_ga1", unterart: null, dauer_min: 45, intensitaet: "locker", inhalt: {}, hinweis: null };
    onChange([...items, it]);
    setEdit(items.length);
  }

  return (
    <div className="space-y-3">
      {live && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Geschätzte Wochenlast: <b>{planLast(items)}</b>
          {live.lastObergrenze !== null && (
            <>
              {" "}
              / Obergrenze <b>{live.lastObergrenze}</b>
              {live.entlastungswoche ? " (Entlastungswoche)" : ""}
            </>
          )}
        </div>
      )}
      {live && <WarnungenListe warnungen={live.warnungen.filter((w) => w.code !== "kraft_ziel")} />}

      {tage.map((d) => {
        const tagesItems = items.map((it, idx) => ({ it, idx })).filter((x) => x.it.datum === d);
        return (
          <div key={d}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-semibold">{formatDatum(d)}</span>
              {tagesItems.length === 0 && <span className="text-xs text-slate-500">Ruhetag</span>}
            </div>
            <div className="space-y-2">
              {tagesItems.map(({ it, idx }) =>
                edit === idx ? (
                  <ItemForm
                    key={idx}
                    item={it}
                    tage={tage}
                    onSave={(n) => {
                      onChange(items.map((x, i) => (i === idx ? n : x)));
                      setEdit(null);
                    }}
                    onDelete={() => {
                      onChange(items.filter((_, i) => i !== idx));
                      setEdit(null);
                    }}
                    onCancel={() => setEdit(null)}
                  />
                ) : (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEdit(idx)}
                    className={cx("tap w-full rounded-xl border px-3 py-2 text-left", it.erledigt ? "border-lime-500/50 opacity-70" : "border-slate-200 dark:border-slate-800")}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{artLabel(it.art, it.unterart)}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {it.tageszeit} · {it.dauer_min}′ · {it.intensitaet}
                      </span>
                    </div>
                    {inhaltKurz(it)
                      .slice(0, 2)
                      .map((l, i) => (
                        <div key={i} className="text-xs text-slate-500 dark:text-slate-400">
                          {l}
                        </div>
                      ))}
                  </button>
                ),
              )}
            </div>
          </div>
        );
      })}
      <Button variant="secondary" className="w-full" onClick={neu}>
        + Einheit hinzufügen
      </Button>
    </div>
  );
}

function ItemForm({ item, tage, onSave, onDelete, onCancel }: { item: PlanItem; tage: string[]; onSave: (i: PlanItem) => void; onDelete: () => void; onCancel: () => void }) {
  const [it, setIt] = useState<PlanItem>({ ...item, inhalt: { ...item.inhalt } });
  const up = (p: Partial<PlanItem>) => setIt((s) => ({ ...s, ...p }));
  const inh = it.inhalt as Record<string, unknown>;
  const setInh = (p: Record<string, unknown>) => setIt((s) => ({ ...s, inhalt: { ...s.inhalt, ...p } }));
  const uebungen = (inh.uebungen as { name: string; saetze: number; wdh: number; gewicht_kg?: number }[] | undefined) ?? [];

  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tag">
          <Select value={it.datum} onChange={(e) => up({ datum: e.target.value })}>
            {tage.map((d) => (
              <option key={d} value={d}>
                {formatDatum(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tageszeit">
          <Select value={it.tageszeit} onChange={(e) => up({ tageszeit: e.target.value as PlanItem["tageszeit"] })}>
            {TAGESZEIT.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Art">
          <Select
            value={it.art}
            onChange={(e) => {
              const art = e.target.value as Art;
              up({
                art,
                unterart: art === "tennis" ? "training" : null,
                inhalt: art === "lauf_4x4" ? { einlaufen_min: 10, wiederholungen: 4, belastung_min: 4, pause_min: 3, auslaufen_min: 5 } : {},
                intensitaet: art === "lauf_4x4" ? "hart" : it.intensitaet,
              });
            }}
          >
            {ART.map((a) => (
              <option key={a} value={a}>
                {ART_LABEL[a]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dauer (min)">
          <NumberInput value={it.dauer_min} onChange={(v) => up({ dauer_min: v ?? 0 })} />
        </Field>
      </div>
      {it.art === "tennis" && (
        <Field label="Unterart" className="mt-2">
          <Chips options={TENNIS_UNTERART} value={(it.unterart as PlanItem["unterart"]) ?? "training"} onChange={(v) => up({ unterart: (v as string) ?? "training" })} labels={UNTERART_LABEL} />
        </Field>
      )}
      <Field label="Intensität" className="mt-2">
        <Chips options={INTENSITAET} value={it.intensitaet} onChange={(v) => v && up({ intensitaet: v as PlanItem["intensitaet"] })} />
      </Field>

      {it.art === "tennis" && (
        <Field label="Schwerpunkt" className="mt-2">
          <Chips options={TENNIS_SCHWERPUNKTE} multi value={(inh.schwerpunkt as string[]) ?? []} onChange={(v) => setInh({ schwerpunkt: v })} />
        </Field>
      )}
      {it.art === "lauf_ga1" && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field label="Pace von">
            <Input value={(inh.ziel_pace_von as string) ?? ""} placeholder="6:15" onChange={(e) => setInh({ ziel_pace_von: e.target.value || undefined })} />
          </Field>
          <Field label="Pace bis">
            <Input value={(inh.ziel_pace_bis as string) ?? ""} placeholder="6:45" onChange={(e) => setInh({ ziel_pace_bis: e.target.value || undefined })} />
          </Field>
          <Field label="HF ≤">
            <NumberInput value={(inh.hf_obergrenze as number) ?? null} onChange={(v) => setInh({ hf_obergrenze: v ?? undefined })} />
          </Field>
        </div>
      )}
      {it.art === "lauf_4x4" && (
        <div className="mt-2 grid grid-cols-5 gap-1">
          {(["einlaufen_min", "wiederholungen", "belastung_min", "pause_min", "auslaufen_min"] as const).map((k) => (
            <Field key={k} label={k.replace("_min", "").slice(0, 5)}>
              <NumberInput value={(inh[k] as number) ?? null} onChange={(v) => setInh({ [k]: v ?? 0 })} />
            </Field>
          ))}
        </div>
      )}
      {it.art === "kraft" && (
        <div className="mt-2 space-y-1">
          {uebungen.map((u, i) => (
            <div key={i} className="grid grid-cols-[1fr_3rem_3rem_3.5rem_2rem] items-center gap-1">
              <Input value={u.name} onChange={(e) => setInh({ uebungen: uebungen.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <NumberInput value={u.saetze} onChange={(v) => setInh({ uebungen: uebungen.map((x, j) => (j === i ? { ...x, saetze: v ?? 1 } : x)) })} />
              <NumberInput value={u.wdh} onChange={(v) => setInh({ uebungen: uebungen.map((x, j) => (j === i ? { ...x, wdh: v ?? 1 } : x)) })} />
              <NumberInput value={u.gewicht_kg ?? null} step={0.5} onChange={(v) => setInh({ uebungen: uebungen.map((x, j) => (j === i ? { ...x, gewicht_kg: v ?? undefined } : x)) })} />
              <Button variant="ghost" className="min-h-10 px-1" onClick={() => setInh({ uebungen: uebungen.filter((_, j) => j !== i) })}>
                ✕
              </Button>
            </div>
          ))}
          <Button variant="secondary" className="min-h-10 w-full text-sm" onClick={() => setInh({ uebungen: [...uebungen, { name: "", saetze: 3, wdh: 8 }] })}>
            + Übung
          </Button>
        </div>
      )}
      <Field label="Hinweis" className="mt-2">
        <Input value={it.hinweis ?? ""} onChange={(e) => up({ hinweis: e.target.value || null })} />
      </Field>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => onSave(it)}>
          Übernehmen
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Löschen
        </Button>
      </div>
    </Card>
  );
}
