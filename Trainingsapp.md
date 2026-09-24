# Trainingssteuerung — Spezifikation für Claude Code

## Projektziel

Eine mobile Web-App (PWA) zur Steuerung des eigenen Trainings. Ich erfasse
Einheiten und Ergebnisse (Tennis, Laufen, Kraft) direkt nach dem Training am
Handy. Einmal pro Woche erzeugt Claude auf Basis der erfassten Daten, der
festen Termine und der Verfügbarkeit einen **Vorschlag für die Folgewoche**,
den ich übernehmen, anpassen oder verwerfen kann.

Nutzer: zunächst nur ich (Single-User), Architektur aber mandantenfähig über
`user_id` + RLS, damit sie später erweiterbar bleibt.

**Wiederverwendung:** Frontend-Stack und PWA-Aufbau wie beim
Nachtdienst-Assistenten, Datenbank/Auth/Edge Functions im bestehenden
Supabase-Projekt der Platzbelegung.

---

## Nicht verhandelbare Grundprinzipien

1. **KI schlägt vor, der Nutzer entscheidet.** Claude erzeugt nur Vorschläge.
   Nichts wird ohne Bestätigung in den aktiven Wochenplan übernommen.
2. **Strukturierte KI-Ausgabe.** Claude antwortet ausschließlich mit JSON
   nach festem Schema. Die Antwort wird serverseitig validiert (zod). Ungültige
   Antworten werden verworfen und einmal neu angefragt — nie „best effort"
   angezeigt.
3. **Harte Leitplanken vor und nach der KI.** Belastungsregeln (siehe unten)
   werden deterministisch im Code geprüft. Verstößt ein Vorschlag dagegen, wird
   er korrigiert oder mit Warnhinweis markiert. Die KI ist nicht die einzige
   Sicherung.
4. **API-Key nie im Frontend.** Der Claude-Aufruf läuft ausschließlich über
   eine Supabase Edge Function; der Key liegt als Supabase Secret.
5. **Schnelle Erfassung.** Eine Einheit muss in < 30 Sekunden erfasst sein
   (große Touch-Ziele, sinnvolle Defaults, letzte Werte vorbelegt).
6. **Kein Medizinprodukt.** Einmaliger Hinweis beim ersten Start: „Trainings-
   vorschläge ohne Gewähr, ersetzen keine ärztliche oder trainerische
   Beratung. Bei Schmerzen oder Beschwerden Training abbrechen."
7. **Minimale laufende Kosten.** Hosting und DB im Free Tier; einzige
   variable Kosten sind die Claude-API-Aufrufe (ca. 1 Aufruf pro Woche,
   Centbereich).

---

## Bestehende Infrastruktur (wiederverwenden)

### Supabase-Projekt `Platzbelegung`

- Project Ref: `apafthvuilapqcohjych`, Region `eu-central-1`, Postgres 17
- Vorhandene Tabellen in `public` (u. a. `profiles`, `bookings`, `artikel`,
  `kassenbuchung`, `mannschaft`, `punktspiel` …) — **nicht anfassen**
- Vorhandene Edge Functions: `app`, `Ablehnen` — **nicht anfassen**
- Supabase Auth wird mitgenutzt (gleicher Login wie Platzbelegung)

**Vor dem ersten Schritt:** Mit dem Supabase-MCP das Schema von
`public.profiles` und die Auth-Konfiguration lesen und die Trainings-Tabellen
daran ausrichten (FK auf `auth.users(id)`).

### Trennung der Trainingsdaten

- Eigenes Schema **`training`** — keine Tabellen in `public` anlegen.
- Schema in den Projekteinstellungen unter „Exposed schemas" freigeben und
  Grants für `authenticated` setzen (Migration dokumentieren).
- **RLS auf jeder Tabelle:** `user_id = auth.uid()` für select/insert/update/
  delete. Die übrigen Club-Nutzer sehen keinerlei Trainingsdaten.
- Edge Functions mit Präfix `trn-`.

### Frontend-Hosting

- Wie Nachtdienst-Assistent: statisches Hosting über **GitHub Pages**,
  Build + Deploy per GitHub Actions bei Push auf `main`.
- Supabase URL + Anon Key als Build-Variablen (GitHub Secrets), nicht im Repo.

---

## Technologie-Stack

- **Frontend:** Vite + React + TypeScript
- **Styling:** Tailwind, mobile-first, große Touch-Ziele, Dark Theme Default
- **Daten:** `@supabase/supabase-js`, TanStack Query für Caching
- **Validierung:** zod (Frontend-Formulare und Edge Function teilen Schemas
  über `src/shared/schemas.ts`)
- **Diagramme:** Recharts (Pace-Verlauf, Wochenbelastung)
- **PWA:** manifest.json + Service Worker (vite-plugin-pwa),
  „Zum Startbildschirm hinzufügen"
- **Offline:** Erfassungen werden bei fehlendem Netz in IndexedDB gepuffert
  und beim nächsten Online-Gang synchronisiert (Tennishalle/Wald = schlechtes
  Netz). Pufferstatus sichtbar anzeigen.
- **KI:** Supabase Edge Function `trn-plan` (Deno) ruft die Anthropic
  Messages API auf. Modell über Secret `CLAUDE_MODEL` konfigurierbar
  (Default: `claude-sonnet-5`), Key über Secret `ANTHROPIC_API_KEY`.

---

## Fachliche Ausgangslage (Startkonfiguration)

Diese Werte als editierbare Einstellungen anlegen, nicht hart codieren.

- **Tennis:** Training dienstags und donnerstags, je 1–2 h (feste Termine).
  An den übrigen Tagen möglich: früher Vormittag 1 h Ballmaschine (Slinger
  mit Oszillator). Sparring nicht planbar, wird spontan eingestreut → als
  ungeplante Einheit erfassbar.
- **Laufen:** abends lockere Dauerläufe möglich.
- **Ziel:** allgemeine Spielfitness (keine Medenspiel-Periodisierung).
  Ziel als Einstellung mit Freitext + Auswahl, damit später änderbar.

---

## Trainingsarten und Erfassungsfelder

Gemeinsame Felder jeder Einheit (`session`):
Datum, Startzeit (optional), Dauer (min), Art, geplant/ungeplant,
Session-RPE (1–10), Befinden vorher (1–5), Beschwerden (Freitext + Körperstelle
optional), Notiz.

### Tennis
- Unterart: `training` | `ballmaschine` | `sparring` | `match`
- Schwerpunkt (Mehrfachauswahl): Grundschläge, Aufschlag, Return, Volley,
  Beinarbeit, Spielformen
- Bei Ballmaschine optional: Übungsprogramm (Freitext)

### Laufen — Grundlagenausdauer (GA1)
- Distanz (km), Dauer → Pace wird berechnet (min/km)
- Ø-Herzfrequenz, max. Herzfrequenz (optional)
- Strecke (Auswahl aus gespeicherten Strecken, optional)

### Laufen — Intervall: Norwegisches 4×4
- Standardstruktur (vorbelegt, editierbar): 10 min Einlaufen,
  4 × 4 min intensiv (Ziel 85–95 % HFmax), dazwischen 3 min aktive Pause
  (ca. 60–70 % HFmax), 5–10 min Auslaufen
- Pro Intervall erfassbar: Pace oder Distanz, Ø-HF, max. HF, RPE
- Anzeige: Zielbereich HF aus HFmax (Einstellung) berechnet

### Kraft (Fitnessstudio)
- Übungskatalog (editierbar, Startbestand: Kniebeuge, Kreuzheben rumänisch,
  Bankdrücken, Rudern, Schulterdrücken, Klimmzug/Latzug, Ausfallschritt,
  Wadenheben, Pallof Press, Rotationsübung am Kabel, Plank)
- Pro Übung: Sätze × Wiederholungen × Gewicht, RPE/RIR optional
- „Letztes Mal"-Werte werden beim Erfassen angezeigt und vorbelegt

### Tagesbefinden (optional, ein Tap)
Schlafqualität (1–5), Energie (1–5), Muskelkater (1–5). Fließt in den
Vorschlag ein.

---

## Datenmodell (Schema `training`)

```sql
-- Einstellungen je Nutzer
training.settings (
  user_id uuid pk references auth.users,
  hf_max int, hf_ruhe int,
  ziel text,                       -- z. B. 'allgemeine Spielfitness'
  wochenstart smallint default 1,  -- 1 = Montag
  kraft_pro_woche_ziel smallint default 2,
  intervall_pro_woche_max smallint default 1,
  updated_at timestamptz
)

-- Feste und mögliche Zeitfenster
training.availability (
  id uuid pk, user_id uuid,
  wochentag smallint,              -- 1..7
  tageszeit text,                  -- 'morgens' | 'mittags' | 'abends'
  typ text,                        -- 'fix_tennis' | 'moeglich'
  erlaubte_arten text[],           -- z. B. {'ballmaschine'} oder {'lauf_ga1','kraft'}
  dauer_min int
)

-- Ausnahmen für eine konkrete Woche (Urlaub, Termine)
training.week_constraint (
  id uuid pk, user_id uuid, datum date,
  typ text,                        -- 'nicht_verfuegbar' | 'eingeschraenkt'
  notiz text
)

-- Durchgeführte Einheiten
training.session (
  id uuid pk, user_id uuid,
  datum date, startzeit time,
  art text,                        -- 'tennis' | 'lauf_ga1' | 'lauf_4x4' | 'kraft'
  unterart text,                   -- bei Tennis: training/ballmaschine/sparring/match
  dauer_min int, srpe smallint,    -- Session-RPE 1..10
  last numeric generated always as (dauer_min * srpe) stored,  -- Foster-Last
  befinden_vorher smallint,
  beschwerden text, notiz text,
  plan_item_id uuid null references training.plan_item,
  created_at timestamptz
)

training.run_detail (
  session_id uuid pk references training.session on delete cascade,
  distanz_km numeric, pace_sek_pro_km int,
  hf_avg int, hf_max int, strecke_id uuid null
)

training.interval_rep (
  id uuid pk, session_id uuid references training.session on delete cascade,
  nr smallint, dauer_sek int, distanz_m int,
  hf_avg int, hf_max int, rpe smallint
)

training.tennis_detail (
  session_id uuid pk references training.session on delete cascade,
  schwerpunkte text[], programm text
)

training.exercise (
  id uuid pk, user_id uuid, name text, kategorie text, aktiv bool
)

training.strength_set (
  id uuid pk, session_id uuid references training.session on delete cascade,
  exercise_id uuid references training.exercise,
  satz_nr smallint, wdh smallint, gewicht_kg numeric, rir smallint
)

training.daily_check (
  user_id uuid, datum date, schlaf smallint, energie smallint,
  muskelkater smallint, primary key (user_id, datum)
)

-- Wochenpläne
training.plan_week (
  id uuid pk, user_id uuid, woche_start date,
  status text,                     -- 'vorschlag' | 'aktiv' | 'verworfen'
  quelle text,                     -- 'claude' | 'manuell'
  begruendung text,                -- Kurzbegründung von Claude
  warnungen jsonb,                 -- Ergebnis der Leitplanken-Prüfung
  modell text, prompt_version text,
  created_at timestamptz,
  unique (user_id, woche_start, status) -- max. ein aktiver Plan je Woche
)

training.plan_item (
  id uuid pk, plan_week_id uuid references training.plan_week on delete cascade,
  datum date, tageszeit text, art text, unterart text,
  dauer_min int, intensitaet text, -- 'locker' | 'mittel' | 'hart'
  inhalt jsonb,                    -- z. B. Intervallstruktur, Übungsliste mit Zielgewichten
  hinweis text,
  erledigt bool default false
)
```

Views für Auswertungen und den KI-Kontext:
- `training.v_week_load` — Summe Foster-Last, Anzahl Einheiten je Art, je Woche
- `training.v_run_trend` — GA1-Pace und Ø-HF je Lauf (Effizienz: Pace bei HF)
- `training.v_4x4_trend` — je 4×4-Einheit: Ø-Pace/Ø-HF der Intervalle
- `training.v_strength_progress` — je Übung: bestes Satzgewicht × Wdh, geschätztes 1RM (Epley)

Alle Views mit `security_invoker = true`, damit RLS greift.

---

## Wochenvorschlag mit Claude

### Ablauf

1. Nutzer tippt in der Wochenansicht auf „Vorschlag für nächste Woche"
   (optional später: automatisch sonntags 18:00 per `pg_cron` → Push/Badge).
2. Frontend ruft Edge Function `trn-plan` mit JWT auf.
3. Edge Function lädt serverseitig (mit dem JWT des Nutzers, RLS aktiv):
   - Einstellungen, Verfügbarkeiten, Ausnahmen der Zielwoche
   - Einheiten der letzten 4 Wochen (aggregiert + die letzten 10 Einheiten im Detail)
   - Plan der laufenden Woche inkl. Erfüllungsgrad (geplant vs. erledigt)
   - Trends aus den Views (Pace, 4×4, Kraftwerte)
   - Tagesbefinden der letzten 7 Tage, offene Beschwerden
4. Deterministische Vorprüfung berechnet Kennzahlen und gibt sie Claude mit
   (Wochenlast, Veränderung zur Vorwoche, Anteil harter Einheiten).
5. Claude-Aufruf mit System-Prompt + Kontext (JSON) → Antwort als JSON.
6. zod-Validierung → Leitplanken-Prüfung → Speicherung als
   `plan_week(status='vorschlag')`.
7. Nutzer sieht Vorschlag inkl. Begründung und Warnungen; kann einzelne
   Einheiten verschieben/löschen/ändern und dann „Übernehmen" → `aktiv`.

### Leitplanken (im Code, nicht nur im Prompt)

- Feste Tennistermine (Di/Do) werden nie überplant oder entfernt.
- Max. `intervall_pro_woche_max` 4×4-Einheiten (Default 1, später 2 wählbar).
- Kein 4×4 am Tag vor oder am selben Tag wie Tennistraining/Match.
- Keine zwei harten Einheiten an aufeinanderfolgenden Tagen.
- Mindestens 1 kompletter Ruhetag pro Woche.
- Kraft: ≥ 48 h zwischen zwei Krafteinheiten; Kraft nicht direkt vor Tennis
  am selben Morgen.
- Wochenlast (Foster) steigt max. 10 % ggü. Durchschnitt der letzten 3 Wochen
  (erste Wochen ohne Historie: konservativ starten).
- Jede 4. Woche Entlastungswoche (ca. −30 % Last), sofern nicht manuell
  deaktiviert.
- Einheiten nur in freigegebenen Zeitfenstern (`availability`) und nicht an
  `week_constraint`-Tagen.
- Beschwerden in den letzten 3 Tagen → keine harte Einheit, Hinweis erzeugen.

Verstöße werden automatisch korrigiert, wenn eindeutig möglich (z. B. Einheit
auf nächsten freien Slot schieben), sonst als Warnung am Plan gespeichert.

### Antwortschema (Claude → Edge Function)

```jsonc
{
  "woche_start": "2026-09-28",
  "begruendung": "Max. 3 Sätze: Fokus der Woche und warum.",
  "einheiten": [
    {
      "datum": "2026-09-29",
      "tageszeit": "abends",
      "art": "tennis",                   // tennis | lauf_ga1 | lauf_4x4 | kraft
      "unterart": "training",
      "dauer_min": 90,
      "intensitaet": "mittel",           // locker | mittel | hart
      "inhalt": {},                      // artspezifisch, siehe unten
      "hinweis": "optional, 1 Satz"
    }
  ]
}
```

`inhalt` je Art:
- `lauf_ga1`: `{ "ziel_pace_von": "6:15", "ziel_pace_bis": "6:45", "hf_obergrenze": 145 }`
- `lauf_4x4`: `{ "einlaufen_min": 10, "wiederholungen": 4, "belastung_min": 4, "pause_min": 3, "hf_ziel_von": 157, "hf_ziel_bis": 175, "auslaufen_min": 5 }`
- `kraft`: `{ "uebungen": [ { "name": "Kniebeuge", "saetze": 3, "wdh": 8, "gewicht_kg": 60 } ] }`
- `tennis`/`ballmaschine`: `{ "schwerpunkt": ["Rückhand longline", "Beinarbeit"] }`

HF-Werte werden aus `hf_max` der Einstellungen berechnet; fehlt `hf_max`,
arbeitet der Vorschlag nur mit RPE/Pace und die App fordert zur Eingabe auf.

### System-Prompt (Datei `supabase/functions/trn-plan/prompt.md`, versioniert)

Kernpunkte, die der Prompt enthalten muss:
- Rolle: Trainingsplaner für einen Freizeit-Tennisspieler mit Ziel
  allgemeine Spielfitness; Laufen und Kraft sind Ergänzung zum Tennis.
- Nur die im Kontext genannten Zeitfenster und Arten verwenden.
- Leitplanken (wörtlich wie oben) einhalten.
- Progression aus den Daten ableiten (Pace-Trend, 4×4-Werte, letzte
  Kraftgewichte); bei fehlenden Daten konservativ bleiben, nichts erfinden.
- Kraftgewichte nur auf Basis erfasster Werte steigern (max. +2,5 kg bzw.
  +1 Wdh ggü. letzter erfolgreicher Einheit).
- Ausgabe ausschließlich als JSON nach Schema, keine Markdown-Fences, kein
  Text davor oder danach.
- `prompt_version` im Plan speichern, damit Änderungen am Prompt
  nachvollziehbar bleiben.

### Robustheit

- Timeout 60 s, ein Retry bei ungültigem JSON (mit Fehlermeldung im Retry-Prompt).
- Fallback bei API-Ausfall: „Vorwoche übernehmen" als manueller Vorschlag
  (Kopie des aktiven Plans, Datumsverschiebung um 7 Tage).
- Rate Limit in der Edge Function: max. 5 Vorschläge pro Nutzer und Tag.
- Request/Response (ohne Key) in `training.ai_log` für Nachvollziehbarkeit
  speichern (Tokens, Dauer, Modell, Prompt-Version).

---

## Screens

1. **Heute** — geplante Einheit(en) des Tages als Karte mit Inhalt
   (z. B. 4×4-Struktur, Übungsliste mit Zielgewichten). Button „Erledigt &
   erfassen" öffnet die Erfassung vorbelegt aus dem Plan. Button „Ungeplante
   Einheit" (z. B. spontanes Sparring). Tagesbefinden als 3 Tap-Skalen.
2. **Erfassen** — Auswahl der Art (4 große Kacheln), dann artspezifisches
   Formular. Beim 4×4 ein **Intervall-Timer** (optional, Phase 2) mit
   akustischem Signal und Erfassung pro Wiederholung.
3. **Woche** — aktiver Plan Mo–So, Erfüllungsstatus, Wochenlast vs. Vorwoche.
   Button „Vorschlag nächste Woche", danach Vergleichsansicht Vorschlag,
   Einheiten per Drag/Antippen verschieben, „Übernehmen".
4. **Verlauf** — Liste aller Einheiten (filterbar), Diagramme: GA1-Pace und
   HF über Zeit, 4×4-Intervall-Pace, Kraftprogression je Übung, Wochenlast
   (Balken, 8 Wochen).
5. **Einstellungen** — HFmax/Ruhe-HF, Ziel, Zeitfenster, Übungskatalog,
   Strecken, Ausnahmen/Urlaub, Export (CSV aller Einheiten).

---

## Projektstruktur

```
/
├── CLAUDE.md
├── src/
│   ├── app/            # Routing, Layout, PWA-Registrierung
│   ├── features/
│   │   ├── today/
│   │   ├── log/        # Erfassungsformulare je Art
│   │   ├── week/       # Plan & Vorschlag
│   │   ├── history/    # Verlauf & Charts
│   │   └── settings/
│   ├── shared/
│   │   ├── schemas.ts  # zod-Schemas (auch von Edge Function importiert)
│   │   ├── rules.ts    # Leitplanken (identisch im Frontend für Live-Hinweise)
│   │   └── supabase.ts
│   └── offline/        # IndexedDB-Queue + Sync
├── supabase/
│   ├── migrations/     # nur Schema `training`
│   └── functions/
│       └── trn-plan/
│           ├── index.ts
│           ├── context.ts   # Datenaufbereitung
│           ├── rules.ts     # Leitplanken (Import aus shared)
│           └── prompt.md
└── .github/workflows/deploy.yml
```

---

## Umsetzungsreihenfolge

1. **Setup:** Repo, Vite/React/TS/Tailwind, PWA-Grundgerüst, Deploy auf
   GitHub Pages. Login über bestehende Supabase-Auth.
2. **Schema:** Migration Schema `training` inkl. RLS-Policies, Grants,
   Views; Seed für Übungskatalog und Startverfügbarkeit (Di/Do Tennis fix,
   übrige Tage morgens Ballmaschine möglich, abends Laufen möglich).
   Tests: Zugriff mit zweitem Testnutzer liefert 0 Zeilen.
3. **Erfassung:** alle vier Arten + Tagesbefinden, Offline-Queue.
4. **Wochenplan manuell:** Plan anlegen/bearbeiten, „Heute"-Ansicht,
   Erledigt-Verknüpfung.
5. **Leitplanken:** `rules.ts` mit Unit-Tests (Vitest) für jede Regel.
6. **Edge Function `trn-plan`:** Kontextaufbau, Claude-Aufruf, Validierung,
   Speicherung, Fallback. Test mit Fixture-Daten (4 Wochen Beispieldaten).
7. **Verlauf & Charts.**
8. **Phase 2:** 4×4-Intervall-Timer, automatischer Sonntagsvorschlag
   (pg_cron), Import von Läufen aus GPX/FIT-Dateien bzw. Strava.

---

## Definition of Done je Feature

- Mobile getestet (iPhone Safari + Android Chrome, 375 px Breite)
- RLS-Test mit zweitem Nutzer bestanden
- zod-Schemas für Ein- und Ausgabe vorhanden
- Keine Secrets im Repo oder im Bundle (`grep` auf `sk-ant` im Build im CI)
- Migration idempotent und im Repo

## Offene Punkte (vor Schritt 2 mit mir klären)

- HFmax: gemessen oder geschätzt? (Formelwert nur als Notlösung)
- 4×4 standardmäßig 1× oder 2× pro Woche?
- Laufen draußen mit Uhr — welche Uhr/Plattform (für späteren Import)?
- Trainingsdaten wirklich im Club-Projekt `Platzbelegung` oder in einem
  zweiten, eigenen Supabase-Projekt (Free Tier erlaubt zwei)? Default laut
  dieser Spezifikation: gleiches Projekt, eigenes Schema, strikte RLS.
