import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRunTrend, useStrengthProgress, useWeekLoad, useX4Trend } from "../../shared/queries";
import { formatDatum } from "../../shared/dates";
import { secondsToPace } from "../../shared/schemas";
import { Card, H2, Select, Spinner } from "../../shared/ui";

const LIME = "#a3e635";
const SKY = "#38bdf8";
const GRID = "#334155";

function Leer({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">{text}</p>;
}

export default function Charts() {
  const load = useWeekLoad();
  const run = useRunTrend();
  const x4 = useX4Trend();
  const kraft = useStrengthProgress();
  const [uebung, setUebung] = useState<string>("");

  const loadData = useMemo(
    () =>
      [...(load.data ?? [])]
        .sort((a, b) => a.woche_start.localeCompare(b.woche_start))
        .slice(-8)
        .map((w) => ({ woche: formatDatum(w.woche_start, false).slice(0, 5), last: Number(w.last_gesamt), einheiten: w.einheiten })),
    [load.data],
  );
  const runData = useMemo(
    () => (run.data ?? []).map((r) => ({ datum: formatDatum(r.datum, false).slice(0, 5), pace: r.pace_sek_pro_km, hf: r.hf_avg })),
    [run.data],
  );
  const x4Data = useMemo(
    () => (x4.data ?? []).map((r) => ({ datum: formatDatum(r.datum, false).slice(0, 5), pace: r.pace_avg_sek_pro_km, hf: r.hf_avg })),
    [x4.data],
  );
  const uebungen = useMemo(() => [...new Set((kraft.data ?? []).map((k) => k.uebung))].sort(), [kraft.data]);
  const sel = uebung || uebungen[0] || "";
  const kraftData = useMemo(
    () => (kraft.data ?? []).filter((k) => k.uebung === sel).map((k) => ({ datum: formatDatum(k.datum, false).slice(0, 5), e1rm: Number(k.e1rm_epley), max: Number(k.max_gewicht_kg) })),
    [kraft.data, sel],
  );

  if (load.isLoading || run.isLoading || x4.isLoading || kraft.isLoading) return <Spinner />;

  const tooltipStyle = { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" } };

  return (
    <div className="space-y-4">
      <Card>
        <H2>Wochenlast (8 Wochen)</H2>
        {loadData.length === 0 ? (
          <Leer text="Noch keine Daten." />
        ) : (
          <div className="mt-2 h-48">
            <ResponsiveContainer>
              <BarChart data={loadData}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="woche" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="last" name="Last" fill={LIME} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <H2>GA1: Pace und Ø-HF</H2>
        {runData.length === 0 ? (
          <Leer text="Noch keine GA1-Läufe." />
        ) : (
          <div className="mt-2 h-56">
            <ResponsiveContainer>
              <LineChart data={runData}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pace" reversed tickFormatter={(v: number) => secondsToPace(v)} tick={{ fontSize: 11 }} width={40} />
                <YAxis yAxisId="hf" orientation="right" tick={{ fontSize: 11 }} width={36} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === "Pace" ? [secondsToPace(Number(v)), n] : [String(v), n])} />
                <Line yAxisId="pace" dataKey="pace" name="Pace" stroke={LIME} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="hf" dataKey="hf" name="Ø-HF" stroke={SKY} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Effizienz = schnellere Pace bei gleicher HF (Pace-Achse invertiert: oben = schneller).</p>
      </Card>

      <Card>
        <H2>4×4: Ø-Intervall-Pace</H2>
        {x4Data.length === 0 ? (
          <Leer text="Noch keine 4×4-Einheiten." />
        ) : (
          <div className="mt-2 h-48">
            <ResponsiveContainer>
              <LineChart data={x4Data}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pace" reversed tickFormatter={(v: number) => secondsToPace(v)} tick={{ fontSize: 11 }} width={40} />
                <YAxis yAxisId="hf" orientation="right" tick={{ fontSize: 11 }} width={36} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === "Pace" ? [secondsToPace(Number(v)), n] : [String(v), n])} />
                <Line yAxisId="pace" dataKey="pace" name="Pace" stroke={LIME} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="hf" dataKey="hf" name="Ø-HF" stroke={SKY} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <H2>Kraft: geschätztes 1RM</H2>
          {uebungen.length > 0 && (
            <Select value={sel} onChange={(e) => setUebung(e.target.value)} className="max-w-[55%]">
              {uebungen.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          )}
        </div>
        {kraftData.length === 0 ? (
          <Leer text="Noch keine Krafteinheiten." />
        ) : (
          <div className="mt-2 h-48">
            <ResponsiveContainer>
              <LineChart data={kraftData}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip {...tooltipStyle} />
                <Line dataKey="e1rm" name="e1RM (Epley)" stroke={LIME} dot={{ r: 3 }} />
                <Line dataKey="max" name="bestes Satzgewicht" stroke={SKY} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
