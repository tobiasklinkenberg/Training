// Kleine, konsistente UI-Bausteine — mobile-first, große Touch-Ziele.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "accent" | "warn" | "muted" }) {
  const tones = {
    default: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    accent: "border-lime-300 bg-lime-50 dark:border-lime-700/60 dark:bg-lime-950/40",
    warn: "border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40",
    muted: "border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60",
  };
  return <div className={cx("rounded-2xl border p-4", tones[tone], className)}>{children}</div>;
}

export function Button({
  variant = "primary",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-lime-500 text-slate-950 font-semibold disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500",
    secondary: "border border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50",
    ghost: "text-sky-700 dark:text-sky-300 disabled:opacity-50",
    danger: "border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 disabled:opacity-50",
  };
  return <button type="button" {...p} className={cx("tap rounded-xl px-4 text-base", v[variant], className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "tap w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, "min-h-20 py-2", p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, p.className)} />;
}

/** Zahleneingabe: leer = null. inputMode für Handy-Tastatur. */
export function NumberInput({
  value,
  onChange,
  step = 1,
  ...p
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null | undefined; onChange: (v: number | null) => void; step?: number }) {
  return (
    <input
      {...p}
      type="number"
      step={step}
      inputMode={step < 1 ? "decimal" : "numeric"}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        onChange(v === "" ? null : Number(v));
      }}
      className={cx(inputCls, p.className)}
    />
  );
}

/** Tap-Skala 1..n (z. B. RPE 1–10, Befinden 1–5). */
export function Scale({
  value,
  onChange,
  max,
  min = 1,
  labels,
  className,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  max: number;
  min?: number;
  labels?: [string, string];
  className?: string;
}) {
  const n = max - min + 1;
  return (
    <div className={className}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, i) => min + i).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={cx(
              "tap rounded-lg border text-base font-semibold",
              value === v
                ? "border-lime-500 bg-lime-500 text-slate-950"
                : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            )}
            aria-pressed={value === v}
          >
            {v}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Mehrfach-/Einfachauswahl als Chips. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  multi = false,
  labels,
}: {
  options: readonly T[];
  value: T[] | T | null;
  onChange: (v: T[] | T | null) => void;
  multi?: boolean;
  labels?: Partial<Record<T, string>>;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.has(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (multi) {
                const next = new Set(selected);
                if (on) next.delete(o);
                else next.add(o);
                onChange([...next] as T[]);
              } else onChange(on ? null : o);
            }}
            className={cx(
              "tap rounded-full border px-4 text-sm",
              on ? "border-lime-500 bg-lime-500 text-slate-950 font-semibold" : "border-slate-300 dark:border-slate-700",
            )}
          >
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const t = {
    info: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    error: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
    ok: "bg-lime-100 text-lime-900 dark:bg-lime-900/40 dark:text-lime-200",
  };
  return <div className={cx("rounded-xl px-3 py-2 text-sm", t[tone])}>{children}</div>;
}

export function Spinner({ text = "Lädt …" }: { text?: string }) {
  return <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>;
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold">{children}</h1>;
}
export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-lg font-semibold", className)}>{children}</h2>;
}
