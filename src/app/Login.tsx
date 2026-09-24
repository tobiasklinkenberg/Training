import { useState, type FormEvent } from "react";
import { supabase } from "../shared/supabase";
import { Banner, Button, Field, H1, Input } from "../shared/ui";

/** Login über die bestehende Supabase-Auth (gleiche Zugangsdaten wie Platzbelegung). */
export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message);
  }

  async function reset() {
    if (!email.trim()) return setErr("Bitte E-Mail eingeben.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setErr(error.message);
    else setInfo("E-Mail zum Zurücksetzen wurde gesendet.");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
      <H1>Trainingssteuerung</H1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Anmeldung mit dem Konto der Platzbelegung.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="E-Mail">
          <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Passwort">
          <Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        {err && <Banner tone="error">{err}</Banner>}
        {info && <Banner tone="ok">{info}</Banner>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Anmelden …" : "Anmelden"}
        </Button>
        <Button variant="ghost" onClick={reset} className="w-full">
          Passwort vergessen
        </Button>
      </form>
    </div>
  );
}
