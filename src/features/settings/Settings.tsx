import { useEffect, useState } from "react";
import { supabase } from "../../shared/supabase";
import { keys, useAvailability, useConstraints, useExercises, useSettings, useStrecken, useTableMutation, useUpdateSettings } from "../../shared/queries";
import { SLOT_ART, TAGESZEIT, type SlotArt } from "../../shared/schemas";
import { WOCHENTAGE_LANG, formatDatum, todayIso } from "../../shared/dates";
import { Banner, Button, Card, Chips, Field, H1, H2, Input, NumberInput, Select, cx } from "../../shared/ui";
import { HINWEIS_TEXT } from "../../app/Hinweis";
import type { AvailabilityRow, SettingsRow } from "../../shared/types";

const SLOT_LABEL: Record<SlotArt, string> = { tennis: "Tennis", ballmaschine: "Ballmaschine", lauf_ga1: "Lauf GA1", lauf_4x4: "Lauf 4×4", kraft: "Kraft" };

export default function SettingsScreen() {
  return (
    <div className="space-y-4">
      <H1>Einstellungen</H1>
      <Profil />
      <Zeitfenster />
      <Ausnahmen />
      <Uebungen />
      <Strecken />
      <Export />
      <Card tone="muted">
        <p className="text-xs text-slate-500 dark:text-slate-400">{HINWEIS_TEXT}</p>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => supabase.auth.signOut()}>
          Abmelden
        </Button>
      </Card>
    </div>
  );
}

function Profil() {
  const q = useSettings();
  const m = useUpdateSettings();
  const [f, setF] = useState<{
    hf_max: number | null;
    hf_ruhe: number | null;
    ziel: string;
    ziel_typ: SettingsRow["ziel_typ"];
    kraft_pro_woche_ziel: number;
    intervall_pro_woche_max: number;
    entlastungswoche_aktiv: boolean;
  } | null>(null);
  useEffect(() => {
    if (q.data && !f)
      setF({
        hf_max: q.data.hf_max,
        hf_ruhe: q.data.hf_ruhe,
        ziel: q.data.ziel,
        ziel_typ: q.data.ziel_typ,
        kraft_pro_woche_ziel: q.data.kraft_pro_woche_ziel,
        intervall_pro_woche_max: q.data.intervall_pro_woche_max,
        entlastungswoche_aktiv: q.data.entlastungswoche_aktiv,
      });
  }, [q.data, f]);
  if (!f) return null;
  return (
    <Card>
      <H2>Profil und Ziel</H2>
      {!f.hf_max && <Banner tone="warn">Ohne HFmax arbeitet der Vorschlag nur mit RPE/Pace. Bitte gemessenen Wert eintragen (Formelwert nur als Notlösung).</Banner>}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Field label="HFmax" hint="gemessen bevorzugt">
          <NumberInput value={f.hf_max} onChange={(v) => setF({ ...f, hf_max: v })} />
        </Field>
        <Field label="Ruhe-HF">
          <NumberInput value={f.hf_ruhe} onChange={(v) => setF({ ...f, hf_ruhe: v })} />
        </Field>
      </div>
      <Field label="Zieltyp" className="mt-3">
        <Select value={f.ziel_typ} onChange={(e) => setF({ ...f, ziel_typ: e.target.value as SettingsRow["ziel_typ"] })}>
          <option value="spielfitness">allgemeine Spielfitness</option>
          <option value="ausdauer">Ausdauer</option>
          <option value="kraft">Kraft</option>
          <option value="wettkampf">Wettkampf / Medenspiele</option>
          <option value="sonstiges">Sonstiges</option>
        </Select>
      </Field>
      <Field label="Ziel (Freitext)" className="mt-3">
        <Input value={f.ziel} onChange={(e) => setF({ ...f, ziel: e.target.value })} />
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Kraft / Woche (Ziel)">
          <NumberInput value={f.kraft_pro_woche_ziel} onChange={(v) => setF({ ...f, kraft_pro_woche_ziel: v ?? 0 })} />
        </Field>
        <Field label="4×4 / Woche (max.)">
          <Select value={f.intervall_pro_woche_max} onChange={(e) => setF({ ...f, intervall_pro_woche_max: Number(e.target.value) })}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </Select>
        </Field>
      </div>
      <label className="tap mt-3 flex items-center gap-3">
        <input type="checkbox" className="size-5" checked={f.entlastungswoche_aktiv} onChange={(e) => setF({ ...f, entlastungswoche_aktiv: e.target.checked })} />
        <span>Jede 4. Woche Entlastungswoche (−30 % Last)</span>
      </label>
      <Button className="mt-3 w-full" disabled={m.isPending} onClick={() => m.mutate(f)}>
        {m.isPending ? "Speichern …" : m.isSuccess ? "Gespeichert ✓" : "Speichern"}
      </Button>
      {m.error && <Banner tone="error">{m.error.message}</Banner>}
    </Card>
  );
}

function Zeitfenster() {
  const q = useAvailability();
  const m = useTableMutation("availability", [keys.availability]);
  const [neu, setNeu] = useState<{ wochentag: number; tageszeit: string; typ: "fix_tennis" | "moeglich"; erlaubte_arten: SlotArt[]; dauer_min: number }>({
    wochentag: 1,
    tageszeit: "abends",
    typ: "moeglich",
    erlaubte_arten: ["lauf_ga1"],
    dauer_min: 60,
  });
  const rows = q.data ?? [];
  return (
    <Card>
      <H2>Zeitfenster</H2>
      <p className="text-xs text-slate-500 dark:text-slate-400">Feste Termine (Tennis) werden nie überplant; „möglich"-Fenster darf der Vorschlag nutzen.</p>
      <div className="mt-2 space-y-2">
        {WOCHENTAGE_LANG.map((name, i) => {
          const wd = i + 1;
          const list = rows.filter((r) => r.wochentag === wd);
          return (
            <div key={wd}>
              <div className="text-sm font-semibold">{name}</div>
              {list.length === 0 && <div className="text-xs text-slate-500">—</div>}
              {list.map((r) => (
                <ZeitfensterRow key={r.id} r={r} onSave={(patch) => m.mutate({ update: { id: r.id, patch } })} onDelete={() => m.mutate({ delete: r.id })} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-2 dark:border-slate-700">
        <div className="mb-1 text-sm font-semibold">Neues Zeitfenster</div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={neu.wochentag} onChange={(e) => setNeu({ ...neu, wochentag: Number(e.target.value) })}>
            {WOCHENTAGE_LANG.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </Select>
          <Select value={neu.tageszeit} onChange={(e) => setNeu({ ...neu, tageszeit: e.target.value })}>
            {TAGESZEIT.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select value={neu.typ} onChange={(e) => setNeu({ ...neu, typ: e.target.value as "fix_tennis" | "moeglich", erlaubte_arten: e.target.value === "fix_tennis" ? ["tennis"] : neu.erlaubte_arten })}>
            <option value="moeglich">möglich</option>
            <option value="fix_tennis">fester Tennistermin</option>
          </Select>
          <NumberInput value={neu.dauer_min} onChange={(v) => setNeu({ ...neu, dauer_min: v ?? 60 })} placeholder="Dauer" />
        </div>
        <div className="mt-2">
          <Chips options={SLOT_ART} multi value={neu.erlaubte_arten} onChange={(v) => setNeu({ ...neu, erlaubte_arten: (v as SlotArt[]) ?? [] })} labels={SLOT_LABEL} />
        </div>
        <Button variant="secondary" className="mt-2 w-full" disabled={neu.erlaubte_arten.length === 0} onClick={() => m.mutate({ insert: neu })}>
          Hinzufügen
        </Button>
      </div>
    </Card>
  );
}

function ZeitfensterRow({ r, onSave, onDelete }: { r: AvailabilityRow; onSave: (p: Record<string, unknown>) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [arten, setArten] = useState<SlotArt[]>(r.erlaubte_arten as SlotArt[]);
  const [dauer, setDauer] = useState<number | null>(r.dauer_min);
  return (
    <div className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-800">
      <button type="button" className="tap flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <span>
          <span className={cx("mr-2 rounded px-1.5 text-xs", r.typ === "fix_tennis" ? "bg-lime-500 text-slate-950" : "bg-slate-200 dark:bg-slate-700")}>{r.typ === "fix_tennis" ? "fest" : "möglich"}</span>
          {r.tageszeit} · {r.erlaubte_arten.map((a) => SLOT_LABEL[a as SlotArt] ?? a).join(", ")} · {r.dauer_min} min
        </span>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <Chips options={SLOT_ART} multi value={arten} onChange={(v) => setArten((v as SlotArt[]) ?? [])} labels={SLOT_LABEL} />
          <div className="flex gap-2">
            <NumberInput value={dauer} onChange={setDauer} />
            <Button variant="secondary" onClick={() => onSave({ erlaubte_arten: arten, dauer_min: dauer ?? 60 })}>
              Speichern
            </Button>
            <Button variant="danger" onClick={onDelete}>
              Löschen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Ausnahmen() {
  const q = useConstraints();
  const m = useTableMutation("week_constraint", [keys.constraints]);
  const [neu, setNeu] = useState({ datum: todayIso(), typ: "nicht_verfuegbar", notiz: "" });
  const rows = (q.data ?? []).filter((c) => c.datum >= todayIso());
  return (
    <Card>
      <H2>Ausnahmen / Urlaub</H2>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.length === 0 && <li className="text-slate-500">Keine kommenden Ausnahmen.</li>}
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between">
            <span>
              {formatDatum(c.datum)} · {c.typ === "nicht_verfuegbar" ? "nicht verfügbar" : "eingeschränkt"}
              {c.notiz ? ` · ${c.notiz}` : ""}
            </span>
            <Button variant="ghost" className="min-h-8 px-2" onClick={() => m.mutate({ delete: c.id })}>
              ✕
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Input type="date" value={neu.datum} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} />
        <Select value={neu.typ} onChange={(e) => setNeu({ ...neu, typ: e.target.value })}>
          <option value="nicht_verfuegbar">nicht verfügbar</option>
          <option value="eingeschraenkt">eingeschränkt (nur locker)</option>
        </Select>
        <Input className="col-span-2" placeholder="Notiz (z. B. Urlaub)" value={neu.notiz} onChange={(e) => setNeu({ ...neu, notiz: e.target.value })} />
      </div>
      <Button variant="secondary" className="mt-2 w-full" onClick={() => m.mutate({ insert: { datum: neu.datum, typ: neu.typ, notiz: neu.notiz || null } })}>
        Hinzufügen
      </Button>
    </Card>
  );
}

function Uebungen() {
  const q = useExercises();
  const m = useTableMutation("exercise", [keys.exercises]);
  const [name, setName] = useState("");
  return (
    <Card>
      <H2>Übungskatalog (Kraft)</H2>
      <ul className="mt-2 space-y-1 text-sm">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="flex items-center justify-between">
            <label className="tap flex items-center gap-2">
              <input type="checkbox" className="size-5" checked={e.aktiv} onChange={(ev) => m.mutate({ update: { id: e.id, patch: { aktiv: ev.target.checked } } })} />
              <span className={cx(!e.aktiv && "text-slate-400 line-through")}>{e.name}</span>
            </label>
            <span className="text-xs text-slate-500">{e.kategorie}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Neue Übung" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="secondary"
          disabled={!name.trim()}
          onClick={() => {
            m.mutate({ insert: { name: name.trim(), kategorie: "sonstiges", sortierung: 200 } });
            setName("");
          }}
        >
          +
        </Button>
      </div>
    </Card>
  );
}

function Strecken() {
  const q = useStrecken();
  const m = useTableMutation("strecke", [keys.strecken]);
  const [name, setName] = useState("");
  const [km, setKm] = useState<number | null>(null);
  return (
    <Card>
      <H2>Laufstrecken</H2>
      <ul className="mt-2 space-y-1 text-sm">
        {(q.data ?? []).length === 0 && <li className="text-slate-500">Noch keine Strecken.</li>}
        {(q.data ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between">
            <span>
              {s.name}
              {s.distanz_km ? ` · ${s.distanz_km} km` : ""}
            </span>
            <Button variant="ghost" className="min-h-8 px-2" onClick={() => m.mutate({ delete: s.id })}>
              ✕
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-[1fr_5rem_3rem] gap-2">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <NumberInput placeholder="km" step={0.1} value={km} onChange={setKm} />
        <Button
          variant="secondary"
          disabled={!name.trim()}
          onClick={() => {
            m.mutate({ insert: { name: name.trim(), distanz_km: km } });
            setName("");
            setKm(null);
          }}
        >
          +
        </Button>
      </div>
    </Card>
  );
}

function Export() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function exportCsv() {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.from("v_session_export").select("*").order("datum").csv();
      if (error) throw new Error(error.message);
      const blob = new Blob(["﻿" + data], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `training-export-${todayIso()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <H2>Export</H2>
      <Button variant="secondary" className="mt-2 w-full" disabled={busy} onClick={exportCsv}>
        Alle Einheiten als CSV
      </Button>
      {err && <Banner tone="error">{err}</Banner>}
    </Card>
  );
}
