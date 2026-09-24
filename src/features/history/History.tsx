import { useState } from "react";
import { ART, ART_LABEL, type Art } from "../../shared/schemas";
import { useDeleteSession, useSessions } from "../../shared/queries";
import { formatDatum } from "../../shared/dates";
import { artLabel, km, pace } from "../../shared/format";
import { Button, Card, Chips, H1, Spinner } from "../../shared/ui";
import Charts from "./Charts";
import type { SessionRow } from "../../shared/types";

export default function History() {
  const [filter, setFilter] = useState<Art | null>(null);
  const [tab, setTab] = useState<"liste" | "diagramme">("liste");
  const sessions = useSessions(undefined, undefined, 300);
  const del = useDeleteSession();

  const rows = (sessions.data ?? []).filter((s) => !filter || s.art === filter);

  return (
    <div className="space-y-4">
      <H1>Verlauf</H1>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === "liste" ? "primary" : "secondary"} onClick={() => setTab("liste")}>
          Einheiten
        </Button>
        <Button variant={tab === "diagramme" ? "primary" : "secondary"} onClick={() => setTab("diagramme")}>
          Diagramme
        </Button>
      </div>

      {tab === "diagramme" ? (
        <Charts />
      ) : (
        <>
          <Chips options={ART} value={filter} onChange={(v) => setFilter(v as Art | null)} labels={ART_LABEL} />
          {sessions.isLoading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Card tone="muted">Noch keine Einheiten erfasst.</Card>
          ) : (
            <ul className="space-y-2">
              {rows.map((s) => (
                <li key={s.id}>
                  <SessionCard s={s} onDelete={() => confirm("Einheit wirklich löschen?") && del.mutate(s.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({ s, onDelete }: { s: SessionRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const detail: string[] = [];
  if (s.art === "lauf_ga1" && s.run_detail) {
    detail.push(`${km(s.run_detail.distanz_km)} · ${pace(s.run_detail.pace_sek_pro_km)} min/km${s.run_detail.hf_avg ? ` · Ø-HF ${s.run_detail.hf_avg}` : ""}`);
  }
  if (s.art === "lauf_4x4" && s.interval_rep?.length) {
    const reps = [...s.interval_rep].sort((a, b) => a.nr - b.nr);
    detail.push(`${reps.length} Intervalle`);
    for (const r of reps) {
      const p = r.distanz_m && r.dauer_sek ? pace(Math.round(r.dauer_sek / (r.distanz_m / 1000))) : "–";
      detail.push(`#${r.nr}: ${p} min/km${r.hf_avg ? ` · HF ${r.hf_avg}` : ""}${r.rpe ? ` · RPE ${r.rpe}` : ""}`);
    }
  }
  if (s.art === "tennis" && s.tennis_detail) {
    if (s.tennis_detail.schwerpunkte.length) detail.push(s.tennis_detail.schwerpunkte.join(", "));
    if (s.tennis_detail.programm) detail.push(s.tennis_detail.programm);
  }
  if (s.art === "kraft" && s.strength_set?.length) {
    const byEx = new Map<string, string[]>();
    for (const st of [...s.strength_set].sort((a, b) => a.satz_nr - b.satz_nr)) {
      const n = st.exercise?.name ?? "Übung";
      byEx.set(n, [...(byEx.get(n) ?? []), `${st.wdh}×${st.gewicht_kg}`]);
    }
    for (const [n, sets] of byEx) detail.push(`${n}: ${sets.join(" · ")}`);
  }
  return (
    <Card>
      <button type="button" className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex justify-between">
          <span className="font-semibold">{artLabel(s.art, s.unterart)}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">{formatDatum(s.datum)}</span>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {s.dauer_min} min · RPE {s.srpe} · Last {s.last}
          {s.geplant ? " · geplant" : ""}
          {s.beschwerden ? ` · ⚠ ${s.beschwerden}${s.beschwerden_stelle ? ` (${s.beschwerden_stelle})` : ""}` : ""}
        </div>
        {detail[0] && <div className="text-sm text-slate-500 dark:text-slate-400">{detail[0]}</div>}
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-sm">
          {detail.slice(1).map((d, i) => (
            <div key={i}>{d}</div>
          ))}
          {s.notiz && <div className="italic">{s.notiz}</div>}
          <Button variant="danger" className="mt-2 min-h-10 text-sm" onClick={onDelete}>
            Löschen
          </Button>
        </div>
      )}
    </Card>
  );
}
