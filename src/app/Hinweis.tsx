import { Button, H1 } from "../shared/ui";

const KEY = "trn.hinweis.v1";

export const HINWEIS_TEXT =
  "Trainingsvorschläge ohne Gewähr, ersetzen keine ärztliche oder trainerische Beratung. Bei Schmerzen oder Beschwerden Training abbrechen.";

export function hinweisBestaetigt(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Einmaliger Hinweis beim ersten Start (kein Medizinprodukt). */
export default function Hinweis({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
      <H1>Bevor es losgeht</H1>
      <p className="mt-4 text-lg leading-relaxed">{HINWEIS_TEXT}</p>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Die App erzeugt Wochenvorschläge mit Claude. Nichts wird ohne deine Bestätigung in den aktiven Plan übernommen. Deine Trainingsdaten sind nur für dich
        sichtbar.
      </p>
      <Button
        className="mt-8 w-full"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* ignorieren */
          }
          onAccept();
        }}
      >
        Verstanden
      </Button>
    </div>
  );
}
