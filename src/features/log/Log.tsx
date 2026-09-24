import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ART, ART_LABEL, type Art } from "../../shared/schemas";
import { H1, cx } from "../../shared/ui";
import SessionForm from "./SessionForm";
import type { PlanItemRow } from "../../shared/types";

const ICON: Record<Art, string> = { tennis: "🎾", lauf_ga1: "🏃", lauf_4x4: "⏱", kraft: "🏋️" };
const SUB: Record<Art, string> = {
  tennis: "Training · Ballmaschine · Sparring · Match",
  lauf_ga1: "Lockerer Dauerlauf",
  lauf_4x4: "Norwegisches Intervall",
  kraft: "Fitnessstudio",
};

export default function Log() {
  const { art } = useParams<{ art?: Art }>();
  const nav = useNavigate();
  const state = useLocation().state as { planItem?: PlanItemRow } | null;

  if (art && (ART as readonly string[]).includes(art)) {
    return <SessionForm art={art} planItem={state?.planItem} />;
  }

  return (
    <div className="space-y-4">
      <H1>Erfassen</H1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Art wählen — letzte Werte sind vorbelegt.</p>
      <div className="grid grid-cols-2 gap-3">
        {ART.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => nav(`/erfassen/${a}`)}
            className={cx(
              "tap flex min-h-32 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900",
            )}
          >
            <span className="text-4xl" aria-hidden="true">
              {ICON[a]}
            </span>
            <span className="mt-2 text-lg font-semibold">{ART_LABEL[a]}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{SUB[a]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
