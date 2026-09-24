import { ART_LABEL, UNTERART_LABEL, type Art, type PlanItem, type TennisUnterart } from "./schemas";
import { secondsToPace } from "./schemas";

export function artLabel(art: Art, unterart?: string | null): string {
  if (art === "tennis" && unterart && unterart in UNTERART_LABEL) return `Tennis · ${UNTERART_LABEL[unterart as TennisUnterart]}`;
  return ART_LABEL[art];
}

export const TAGESZEIT_LABEL: Record<string, string> = { morgens: "morgens", mittags: "mittags", abends: "abends" };
export const INTENSITAET_LABEL: Record<string, string> = { locker: "locker", mittel: "mittel", hart: "hart" };

/** Kurzbeschreibung des Planinhalts für Karten. */
export function inhaltKurz(item: Pick<PlanItem, "art" | "inhalt">): string[] {
  const i = item.inhalt as Record<string, unknown>;
  const out: string[] = [];
  if (item.art === "lauf_ga1") {
    if (i.ziel_pace_von || i.ziel_pace_bis) out.push(`Pace ${i.ziel_pace_von ?? "?"}–${i.ziel_pace_bis ?? "?"} min/km`);
    if (i.hf_obergrenze) out.push(`HF ≤ ${i.hf_obergrenze}`);
    if (i.distanz_km) out.push(`${i.distanz_km} km`);
  } else if (item.art === "lauf_4x4") {
    out.push(`${i.einlaufen_min ?? 10}′ einlaufen · ${i.wiederholungen ?? 4} × ${i.belastung_min ?? 4}′ / ${i.pause_min ?? 3}′ Pause · ${i.auslaufen_min ?? 5}′ auslaufen`);
    if (i.hf_ziel_von && i.hf_ziel_bis) out.push(`Ziel-HF ${i.hf_ziel_von}–${i.hf_ziel_bis}`);
  } else if (item.art === "kraft") {
    const u = i.uebungen as { name: string; saetze: number; wdh: number; gewicht_kg?: number }[] | undefined;
    for (const x of u ?? []) out.push(`${x.name}: ${x.saetze} × ${x.wdh}${x.gewicht_kg != null ? ` @ ${x.gewicht_kg} kg` : ""}`);
  } else {
    const s = i.schwerpunkt as string[] | undefined;
    if (s?.length) out.push(`Schwerpunkt: ${s.join(", ")}`);
    if (i.programm) out.push(String(i.programm));
  }
  return out;
}

export function pace(sek: number | null | undefined): string {
  return secondsToPace(sek);
}

export function km(v: number | null | undefined): string {
  return v == null ? "–" : `${Number(v).toFixed(1).replace(".", ",")} km`;
}
