import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useActivePlansRange, useDailyCheck, useSessions, keys } from "../../shared/queries";
import { formatDatum, todayIso, weekStart } from "../../shared/dates";
import { artLabel, inhaltKurz, INTENSITAET_LABEL, TAGESZEIT_LABEL } from "../../shared/format";
import { Button, Card, H1, H2, Scale, Spinner, cx } from "../../shared/ui";
import { saveDailyCheck } from "../../offline/sync";
import type { PlanItemRow } from "../../shared/types";

export default function Today() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const heute = todayIso();
  const ws = weekStart(heute);
  const plans = useActivePlansRange(ws, ws);
  const sessions = useSessions(heute, heute);
  const check = useDailyCheck(heute);

  const plan = plans.data?.[0];
  const items = (plan?.plan_item ?? []).filter((i) => i.datum === heute).sort((a, b) => a.tageszeit.localeCompare(b.tageszeit));
  const naechste = (plan?.plan_item ?? []).filter((i) => i.datum > heute && !i.erledigt).sort((a, b) => a.datum.localeCompare(b.datum))[0];

  async function setCheck(patch: Partial<{ schlaf: number | null; energie: number | null; muskelkater: number | null }>) {
    const cur = check.data ?? { schlaf: null, energie: null, muskelkater: null };
    const next = { datum: heute, schlaf: cur.schlaf, energie: cur.energie, muskelkater: cur.muskelkater, ...patch };
    qc.setQueryData(keys.dailyCheck(heute), { ...next, user_id: "" });
    await saveDailyCheck(next);
    qc.invalidateQueries({ queryKey: keys.dailyCheck(heute) });
  }

  return (
    <div className="space-y-4">
      <div>
        <H1>Heute</H1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatDatum(heute)}</p>
      </div>

      {plans.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card tone="muted">
          <p className="text-slate-600 dark:text-slate-300">{plan ? "Heute ist nichts geplant — Ruhetag oder freie Einheit." : "Für diese Woche gibt es keinen aktiven Plan."}</p>
          {!plan && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => nav("/woche")}>
              Zur Wochenplanung
            </Button>
          )}
          {naechste && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nächste geplante Einheit: {formatDatum(naechste.datum)} {artLabel(naechste.art, naechste.unterart)}
            </p>
          )}
        </Card>
      ) : (
        items.map((it) => <PlanCard key={it.id} item={it} onLog={() => nav(`/erfassen/${it.art}`, { state: { planItem: it } })} />)
      )}

      <Button variant="secondary" className="w-full" onClick={() => nav("/erfassen")}>
        Ungeplante Einheit erfassen
      </Button>

      {sessions.data && sessions.data.length > 0 && (
        <Card>
          <H2>Heute erfasst</H2>
          <ul className="mt-2 space-y-1 text-sm">
            {sessions.data.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{artLabel(s.art, s.unterart)}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {s.dauer_min} min · RPE {s.srpe}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <H2>Tagesbefinden</H2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Ein Tap je Skala — fließt in den Wochenvorschlag ein.</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-sm">Schlaf</div>
            <Scale max={5} value={check.data?.schlaf} onChange={(v) => setCheck({ schlaf: v })} labels={["schlecht", "sehr gut"]} />
          </div>
          <div>
            <div className="mb-1 text-sm">Energie</div>
            <Scale max={5} value={check.data?.energie} onChange={(v) => setCheck({ energie: v })} labels={["leer", "voll"]} />
          </div>
          <div>
            <div className="mb-1 text-sm">Muskelkater</div>
            <Scale max={5} value={check.data?.muskelkater} onChange={(v) => setCheck({ muskelkater: v })} labels={["keiner", "stark"]} />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function PlanCard({ item, onLog, compact = false }: { item: PlanItemRow; onLog?: () => void; compact?: boolean }) {
  const lines = inhaltKurz(item);
  return (
    <Card tone={item.erledigt ? "muted" : "accent"}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={cx("text-lg font-semibold", item.erledigt && "line-through opacity-60")}>{artLabel(item.art, item.unterart)}</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {TAGESZEIT_LABEL[item.tageszeit]} · {item.dauer_min} min · {INTENSITAET_LABEL[item.intensitaet]}
          </div>
        </div>
        {item.erledigt && <span className="rounded-full bg-lime-500 px-2 py-0.5 text-xs font-semibold text-slate-950">erledigt</span>}
      </div>
      {!compact && lines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {!compact && item.hinweis && <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">{item.hinweis}</p>}
      {onLog && !item.erledigt && (
        <Button className="mt-3 w-full" onClick={onLog}>
          Erledigt &amp; erfassen
        </Button>
      )}
    </Card>
  );
}
