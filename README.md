# Trainingssteuerung

Mobile Web-App (PWA) zur Steuerung des eigenen Trainings: Tennis, Laufen (GA1, norwegisches 4×4)
und Kraft direkt nach der Einheit am Handy erfassen; einmal pro Woche erzeugt Claude einen
**Vorschlag für die Folgewoche**, der übernommen, angepasst oder verworfen werden kann.

Spezifikation: [`Trainingsapp.md`](Trainingsapp.md) · Arbeitsregeln: [`CLAUDE.md`](CLAUDE.md)

## Stack

- Vite + React 19 + TypeScript, Tailwind 4 (Dark Theme, mobile-first), TanStack Query, zod 4,
  Recharts, vite-plugin-pwa, `idb` (Offline-Puffer)
- Supabase (Projekt `Platzbelegung`, Schema **`training`**, RLS je Nutzer, gemeinsame Auth)
- Edge Function `trn-plan` (Deno) → Anthropic Messages API mit Structured Outputs
- Hosting: GitHub Pages via GitHub Actions

## Einrichtung

### 1. Supabase (bereits angewendet)

Migrationen in `supabase/migrations/` (idempotent):

| Datei | Inhalt |
|---|---|
| `20260924100000_training_schema.sql` | Schema, Tabellen, RLS, Views, `ensure_defaults()` |
| `20260924100100_expose_training_schema.sql` | `pgrst.db_schemas` um `training` erweitert |
| `20260924100200_rpc.sql` | `save_session`, `activate_plan`, `replace_plan_items` |

Im Dashboard prüfen: *Project Settings → API → Exposed schemas* sollte `training` enthalten
(die Migration setzt es in der DB; das Dashboard zeigt es ggf. erst nach erneutem Speichern).

### 2. Secrets der Edge Function

Dashboard → *Edge Functions → Secrets* (oder `supabase secrets set …`):

| Secret | Wert |
|---|---|
| `ANTHROPIC_API_KEY` | API-Key aus der Anthropic Console |
| `CLAUDE_MODEL` | optional, Default `claude-sonnet-5` |

`SUPABASE_URL` und `SUPABASE_ANON_KEY` werden automatisch bereitgestellt.

### 3. Edge Function deployen

```bash
npm run sync-shared
supabase functions deploy trn-plan --project-ref apafthvuilapqcohjych
```

(Alternativ per Supabase-MCP `deploy_edge_function` — so wurde die erste Version deployt.)

### 4. Frontend lokal

```bash
cp .env.example .env   # URL + Anon/Publishable Key eintragen
npm install
npm run dev
```

### 5. GitHub Pages

1. Repository auf GitHub anlegen, `main` pushen.
2. *Settings → Secrets and variables → Actions*: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. *Settings → Pages*: Source „GitHub Actions".
4. Jeder Push auf `main`: Tests → Build (Basis-Pfad `/<repo>/`) → Secret-Scan → Deploy.
5. In Supabase unter *Authentication → URL Configuration* die Pages-URL als Redirect-URL
   ergänzen (für „Passwort vergessen").

## Ablauf Wochenvorschlag

1. „Woche" → **Vorschlag für nächste Woche (Claude)**.
2. `trn-plan` lädt mit dem JWT des Nutzers (RLS): Einstellungen, Zeitfenster, Ausnahmen,
   Einheiten der letzten 4 Wochen, laufender Plan (Erfüllungsgrad), Trends aus den Views,
   Tagesbefinden, Beschwerden; berechnet Kennzahlen (Wochenlast, Ø 3 Wochen, Entlastungswoche).
3. Claude antwortet als JSON (Structured Output, Schema aus `PlanResponseAiSchema`) →
   strikte zod-Prüfung (`PlanResponseSchema`) → ein Retry bei ungültiger Antwort.
4. Leitplanken (`src/shared/rules.ts`, identisch im Frontend) korrigieren/markieren:
   feste Tennistermine, max. 4×4, kein 4×4 vor Tennis, keine harten Folgetage, Ruhetag,
   Kraft-Abstand, Wochenlast +10 %, Entlastungswoche, Zeitfenster/Ausnahmen, Beschwerden.
5. Speicherung als `plan_week(status='vorschlag')` + `ai_log` (Tokens, Dauer, Modell, Prompt-Version).
6. Nutzer bearbeitet (Live-Warnungen) und **übernimmt** → `activate_plan` (max. ein aktiver Plan je Woche).

Fallback bei API-Ausfall/ungültiger Antwort: „Vorwoche übernehmen" (aktiver Plan +7 Tage).
Rate Limit: 5 Vorschläge je Nutzer und Tag.

## Offline

Erfassungen und Tagesbefinden werden bei fehlendem Netz in IndexedDB gepuffert (Banner oben)
und beim nächsten Online-Gang über `training.save_session` (idempotent über `client_id`) gesendet.

## Tests

```bash
npm test   # Leitplanken (je Regel ein Test) + Schema-Normalisierung
```

RLS-Test: siehe `supabase/tests/rls.sql` (zweiter Nutzer sieht 0 Zeilen).

## Offene Punkte (siehe Spezifikation)

- HFmax gemessen eintragen (Einstellungen) — ohne HFmax arbeitet der Vorschlag mit RPE/Pace.
- 4×4 pro Woche: Default 1, in den Einstellungen auf 2 umstellbar.
- Uhr/Plattform für späteren Import (Phase 2: GPX/FIT/Strava).
- Phase 2: Intervall-Timer, automatischer Sonntagsvorschlag (`pg_cron`).
