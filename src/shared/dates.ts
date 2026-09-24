// Datumshelfer auf Basis von ISO-Strings (YYYY-MM-DD), zeitzonenfrei (UTC-Rechnung).
// Wird von Frontend UND Edge Function verwendet (Kopie via scripts/sync-shared.mjs).

export type IsoDate = string;

export function parseIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function todayIso(): IsoDate {
  const n = new Date();
  return toIso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** 1 = Montag … 7 = Sonntag */
export function isoWeekday(iso: IsoDate): number {
  const wd = parseIso(iso).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Erster Tag der Woche, in der `iso` liegt (wochenstart 1 = Montag). */
export function weekStart(iso: IsoDate, wochenstart = 1): IsoDate {
  const wd = isoWeekday(iso);
  const diff = (wd - wochenstart + 7) % 7;
  return addDays(iso, -diff);
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

export function weekDates(start: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const WOCHENTAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function formatDatum(iso: IsoDate, mitWochentag = true): string {
  const [y, m, d] = iso.split("-");
  const wt = mitWochentag ? `${WOCHENTAGE_KURZ[isoWeekday(iso) - 1]} ` : "";
  return `${wt}${d}.${m}.${y.slice(2)}`;
}
