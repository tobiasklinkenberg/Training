# Trainingssteuerung — Arbeitsregeln für Claude Code

Die fachliche Spezifikation steht in `Trainingsapp.md` (Quelle der Wahrheit). Diese Datei
beschreibt, wie der Code organisiert ist und was beim Weiterentwickeln zu beachten ist.

## Grundprinzipien (nicht verhandelbar)

1. KI schlägt vor, der Nutzer entscheidet — Claude schreibt nur `plan_week(status='vorschlag')`.
2. Claude antwortet ausschließlich als JSON (Structured Output) → zod-Validierung → Leitplanken
   im Code (`src/shared/rules.ts`). Ungültig = verwerfen + ein Retry, nie „best effort".
3. API-Key nur als Supabase Secret (`ANTHROPIC_API_KEY`), nie im Frontend/Repo.
4. Trainingsdaten nur im Schema `training` mit RLS `user_id = auth.uid()`; `public` bleibt unberührt.
5. Kein Medizinprodukt: Hinweis beim ersten Start (`src/app/Hinweis.tsx`).

## Struktur

```
src/app/            Router, Layout (Tab-Bar, Offline-Banner), Login, Hinweis
src/features/       today | log (Erfassung) | week (Plan/Vorschlag) | history | settings
src/shared/         schemas.ts (zod), rules.ts (Leitplanken), dates.ts, queries.ts (TanStack),
                    supabase.ts, types.ts, ui.tsx, format.ts
src/offline/        IndexedDB-Queue (idb) + Sync (save_session ist idempotent über client_id)
supabase/migrations Schema training (idempotent), Exposed-Schema, RPCs
supabase/functions/trn-plan
                    index.ts (Ablauf), context.ts (Kontext), rules.ts (re-export), prompt.md
                    _shared/ + prompt.generated.ts werden durch `npm run sync-shared` erzeugt
```

## Regeln beim Ändern

- `src/shared/{schemas,rules,dates}.ts` sind die einzige Quelle — nach Änderung
  `npm run sync-shared` ausführen und die Edge Function neu deployen.
- Jede Leitplanke hat einen Vitest-Test in `src/shared/rules.test.ts`; neue Regel = neuer Test.
- Prompt-Änderungen: `prompt.md` bearbeiten UND die Version in der ersten Zeile anheben
  (`<!-- version: x.y.z -->`); sie wird im Plan gespeichert (`prompt_version`).
- Migrationen idempotent schreiben (IF NOT EXISTS, OR REPLACE, DROP POLICY IF EXISTS) und im
  Repo ablegen; Anwendung über Supabase-MCP `apply_migration` oder CLI.
- Modell: Secret `CLAUDE_MODEL` (Default `claude-sonnet-5`). Kein Model-Hardcoding im Frontend.
- Keine Secrets im Bundle: `npm run check-secrets` läuft im CI nach dem Build.

## Befehle

```bash
npm run dev          # lokal (Port aus .claude/launch.json)
npm test             # Leitplanken + Schemas
npm run build        # Typecheck + Vite-Build
npm run sync-shared  # shared → Edge Function, prompt.md → prompt.generated.ts
npm run check-secrets
```
