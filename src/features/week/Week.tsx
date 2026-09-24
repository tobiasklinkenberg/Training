import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePlansForWeek, useSessions, useWeekLoad } from "../../shared/queries";
import { addDays, formatDatum, todayIso, weekDates, weekStart } from "../../shared/dates";
import { checkPlan, planLast } from "../../shared/rules";
import type { PlanItem, Warnung } from "../../shared/schemas";
import { artLabel } from "../../shared/format";
import { Banner, Button, Card, H1, H2, Spinner, cx } from "../../shared/ui";
import { PlanCard } from "../today/Today";
import PlanEditor, { WarnungenListe } from "./PlanEditor";
import { useRuleContext } from "./useRuleContext";
import {
  PlanError,
  aktiverPlan,
  erledigtSetzen,
  manuellenPlanAnlegen,
  planAktivieren,
  planItemsSpeichern,
  planVerwerfen,
  planWarnungenSpeichern,
  rowToItem,
  vorschlag as vorschlagVon,
  vorschlagAnfordern,
} from "./api";

export default function Week() {
  const { start } = useParams<{ start?: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const heute = todayIso();
  const wsHeute = weekStart(heute);
  const ws = start ? weekStart(start) : wsHeute;
  const naechste = addDays(ws, 7);

  const plans = usePlansForWeek(ws);
  const sessions = useSessions(ws, addDays(ws, 6));
  const load = useWeekLoad();
  const ctx = useRuleContext(ws);

  const aktiv = aktiverPlan(plans.data);
  const vorschlag = vorschlagVon(plans.data);

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [editItems, setEditItems] = useState<PlanItem[] | null>(null);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);

  // Vorschlag automatisch in den Editor laden
  useEffect(() => {
    if (vorschlag && editPlanId !== vorschlag.id) {
      setEditPlanId(vorschlag.id);
      setEditItems((vorschlag.plan_item ?? []).map(rowToItem));
    }
    if (!vorschlag && editPlanId && editPlanId !== aktiv?.id) {
      setEditPlanId(null);
      setEditItems(null);
    }
  }, [vorschlag, aktiv?.id, editPlanId]);

  const refresh = () => qc.invalidateQueries();

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      if (e instanceof PlanError) {
        setErr(e.message);
        setFallback(e.fallbackVerfuegbar);
      } else setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const anfordern = (woche: string, modus: "claude" | "vorwoche" = "claude") =>
    run(modus === "claude" ? "Claude erstellt den Vorschlag …" : "Vorwoche wird kopiert …", async () => {
      setFallback(false);
      await vorschlagAnfordern(woche, modus);
      if (woche !== ws) nav(`/woche/${woche}`);
    });

  const manuell = () =>
    run("Plan wird angelegt …", async () => {
      const items = ctx ? checkPlan([], ctx).items : [];
      await manuellenPlanAnlegen(ws, items);
    });

  const uebernehmen = () =>
    run("Übernehmen …", async () => {
      if (!editPlanId || !editItems) return;
      let warnungen: Warnung[] = [];
      if (ctx) warnungen = checkPlan(editItems, ctx, { korrigieren: false }).warnungen;
      await planItemsSpeichern(editPlanId, editItems);
      await planWarnungenSpeichern(editPlanId, warnungen);
      await planAktivieren(editPlanId);
      setEditItems(null);
      setEditPlanId(null);
    });

  const speichern = () =>
    run("Speichern …", async () => {
      if (!editPlanId || !editItems) return;
      await planItemsSpeichern(editPlanId, editItems);
      if (ctx) await planWarnungenSpeichern(editPlanId, checkPlan(editItems, ctx, { korrigieren: false }).warnungen);
      if (editPlanId === aktiv?.id) {
        setEditItems(null);
        setEditPlanId(null);
      }
    });

  const verwerfen = () =>
    run("Verwerfen …", async () => {
      if (vorschlag) await planVerwerfen(vorschlag.id);
      setEditItems(null);
      setEditPlanId(null);
    });

  // Wochenlast: erfasst (Ist) vs. Vorwoche vs. geplant
  const istLast = Number(load.data?.find((w) => w.woche_start === ws)?.last_gesamt ?? 0);
  const vorwocheLast = Number(load.data?.find((w) => w.woche_start === addDays(ws, -7))?.last_gesamt ?? 0);
  const planLastWert = aktiv ? planLast(aktiv.plan_item ?? []) : 0;

  const tage = weekDates(ws);
  const bearbeitetAktiv = editPlanId !== null && editPlanId === aktiv?.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => nav(`/woche/${addDays(ws, -7)}`)} aria-label="Vorherige Woche">
          ‹
        </Button>
        <div className="text-center">
          <H1>Woche</H1>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {formatDatum(ws, false)} – {formatDatum(addDays(ws, 6), false)}
            {ws === wsHeute ? " · aktuell" : ""}
          </div>
        </div>
        <Button variant="ghost" onClick={() => nav(`/woche/${naechste}`)} aria-label="Nächste Woche">
          ›
        </Button>
      </div>

      <Card tone="muted">
        <div className="grid grid-cols-3 text-center text-sm">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Vorwoche</div>
            <div className="text-lg font-semibold">{vorwocheLast || "–"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Erfasst</div>
            <div className="text-lg font-semibold">
              {istLast || "–"}
              {vorwocheLast > 0 && istLast > 0 && (
                <span className={cx("ml-1 text-xs", istLast > vorwocheLast * 1.1 ? "text-amber-600" : "text-slate-500")}>
                  {istLast >= vorwocheLast ? "+" : ""}
                  {Math.round(((istLast - vorwocheLast) / vorwocheLast) * 100)} %
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Geplant</div>
            <div className="text-lg font-semibold">{planLastWert || "–"}</div>
          </div>
        </div>
        <div className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">Foster-Last = Minuten × Session-RPE</div>
      </Card>

      {busy && <Banner tone="info">{busy}</Banner>}
      {err && (
        <Banner tone="error">
          {err}
          {fallback && (
            <Button variant="secondary" className="mt-2 w-full" onClick={() => anfordern(ws, "vorwoche")}>
              Stattdessen Vorwoche übernehmen
            </Button>
          )}
        </Banner>
      )}

      {/* Vorschlag */}
      {vorschlag && editItems && (
        <Card tone="accent">
          <H2>
            Vorschlag {vorschlag.quelle === "claude" ? "von Claude" : vorschlag.quelle === "vorwoche" ? "(Vorwoche kopiert)" : "(manuell)"}
          </H2>
          {vorschlag.begruendung && <p className="mt-1 text-sm">{vorschlag.begruendung}</p>}
          {vorschlag.modell && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {vorschlag.modell} · Prompt {vorschlag.prompt_version}
            </p>
          )}
          {vorschlag.warnungen?.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Leitplanken-Prüfung</div>
              <WarnungenListe warnungen={vorschlag.warnungen} />
            </div>
          )}
          {aktiv && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Aktueller aktiver Plan: {(aktiv.plan_item ?? []).length} Einheiten, Last {planLast(aktiv.plan_item ?? [])} — wird beim Übernehmen ersetzt.
            </p>
          )}
          <div className="mt-3">
            <PlanEditor wocheStart={ws} items={editItems} onChange={setEditItems} ctx={ctx} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={!!busy} onClick={uebernehmen}>
              Übernehmen
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={speichern}>
              Zwischenspeichern
            </Button>
            <Button variant="danger" disabled={!!busy} onClick={verwerfen}>
              Verwerfen
            </Button>
          </div>
        </Card>
      )}

      {/* Aktiver Plan */}
      {plans.isLoading ? (
        <Spinner />
      ) : aktiv ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <H2>Aktiver Plan</H2>
            {!bearbeitetAktiv && !vorschlag && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditPlanId(aktiv.id);
                  setEditItems((aktiv.plan_item ?? []).map(rowToItem));
                }}
              >
                Bearbeiten
              </Button>
            )}
          </div>
          {aktiv.warnungen?.length > 0 && !bearbeitetAktiv && <WarnungenListe warnungen={aktiv.warnungen.filter((w) => w.schwere !== "info")} />}
          {bearbeitetAktiv && editItems ? (
            <>
              <PlanEditor wocheStart={ws} items={editItems} onChange={setEditItems} ctx={ctx} />
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!!busy} onClick={speichern}>
                  Speichern
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditItems(null);
                    setEditPlanId(null);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </>
          ) : (
            tage.map((d) => {
              const items = (aktiv.plan_item ?? []).filter((i) => i.datum === d).sort((a, b) => a.tageszeit.localeCompare(b.tageszeit));
              const erfasst = (sessions.data ?? []).filter((s) => s.datum === d);
              return (
                <div key={d}>
                  <div className={cx("mb-1 text-sm font-semibold", d === heute && "text-lime-600 dark:text-lime-400")}>
                    {formatDatum(d)}
                    {d === heute ? " · heute" : ""}
                  </div>
                  {items.length === 0 && erfasst.length === 0 && <div className="text-xs text-slate-500 dark:text-slate-400">Ruhetag</div>}
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          aria-label={it.erledigt ? "als offen markieren" : "als erledigt markieren"}
                          onClick={() => run("", () => erledigtSetzen(it.id, !it.erledigt))}
                          className={cx("tap w-12 shrink-0 rounded-xl border text-xl", it.erledigt ? "border-lime-500 bg-lime-500 text-slate-950" : "border-slate-300 dark:border-slate-700")}
                        >
                          {it.erledigt ? "✓" : ""}
                        </button>
                        <div className="flex-1">
                          <PlanCard item={it} compact onLog={d <= heute && !it.erledigt ? () => nav(`/erfassen/${it.art}`, { state: { planItem: it } }) : undefined} />
                        </div>
                      </div>
                    ))}
                    {erfasst
                      .filter((s) => !s.plan_item_id)
                      .map((s) => (
                        <div key={s.id} className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                          ungeplant erfasst: {artLabel(s.art, s.unterart)} · {s.dauer_min} min · RPE {s.srpe}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        !vorschlag && (
          <Card tone="muted">
            <p className="text-slate-600 dark:text-slate-300">Für diese Woche gibt es keinen aktiven Plan.</p>
          </Card>
        )
      )}

      {/* Aktionen */}
      {!vorschlag && (
        <div className="space-y-2">
          {ws === wsHeute ? (
            <Button className="w-full" disabled={!!busy} onClick={() => anfordern(naechste)}>
              Vorschlag für nächste Woche (Claude)
            </Button>
          ) : (
            ws > wsHeute && (
              <Button className="w-full" disabled={!!busy} onClick={() => anfordern(ws)}>
                Vorschlag für diese Woche (Claude)
              </Button>
            )
          )}
          {ws >= wsHeute && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={!!busy} onClick={manuell}>
                Manuell planen
              </Button>
              <Button variant="secondary" className="flex-1" disabled={!!busy} onClick={() => anfordern(ws, "vorwoche")}>
                Vorwoche kopieren
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
