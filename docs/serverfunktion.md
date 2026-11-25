# Serverfunktion `verarbeiten` – später einrichten

Stand 24.11.2026: Der Quelltext liegt in `supabase/functions/verarbeiten/`, ist getestet,
aber **nicht ausgerollt**. Als KI-Dienst ist **Claude über Amazon Bedrock mit
EU-Inferenzprofil** angebunden (Entscheidung: `docs/ki-dienst-vergleich.md`). Es gibt noch
kein AWS-Konto, kein Supabase-Projekt, keine Schlüssel und keinen Zugangscode. Diese
Anleitung beschreibt, was der Nutzer selbst tut. Nichts davon ist bisher geschehen.

> **Vor echten Diktaten:** Der Datenschutz der Klinik (Datenschutzbeauftragte, ggf.
> IT-Sicherheit) muss zustimmen. Ein privates AWS-Konto des Arztes reicht dafür
> voraussichtlich nicht; der Vertrag sollte auf die Klinik laufen oder von ihr genehmigt
> sein. **Bis dahin nur erfundene Texte** – auch beim Ausprobieren der fertigen App.

Was sich in der Dokumentation nicht belegen ließ, ist unten mit **„beim Einrichten
prüfen"** markiert.

## Aufbau

- `index.ts`: dünner Deno-Einstieg (`Deno.serve`), liest die Umgebungsvariablen. Eine
  Fehleinstellung (Region, Modell) wird beim Start mit Meldung abgelehnt; die Funktion
  antwortet dann auf jede Anfrage mit „nicht eingerichtet" (503).
- `kern/bearbeiten.ts`: Herkunft (CORS), Zugangscode, Menge, Eingang; Aufruf des Anbieters;
  Protokoll nur mit Zeit, Dauer und Statuscode. Fehler des Anbieters gehen nur als fester
  Code hinaus (z. B. `abgeschnitten`, `ueberlastet`), nie mit Text.
- `kern/zugang.ts`, `kern/mengen.ts`: Zugangscodes (nur Hashes) und Mengenbegrenzung.
- `ki/anbieter.ts`: Schnittstelle zum KI-Dienst mit „nicht eingerichtet" (Standard),
  Attrappe (`KI_ANBIETER=attrappe`) und Bedrock (`KI_ANBIETER=bedrock`).
- `ki/bedrock/`: Bedrock-Anbieter, nur `fetch` und WebCrypto (läuft in Deno und Node):
  - `konfiguration.ts` – feste Schranken: Quellregion nur `eu-central-1`, `eu-west-1`,
    `eu-west-3`, `eu-north-1`, `eu-south-1`, `eu-south-2` (Standard Frankfurt; London und
    Zürich werden abgelehnt), Modell nur `eu.anthropic.claude-…`-Profile (Standard
    `eu.anthropic.claude-haiku-5-5`; `global.`, `us.`, Kennungen ohne Profil, Fable und
    Mythos werden abgelehnt).
  - `anbieter.ts` – Aufruf `POST https://bedrock-runtime.<region>.amazonaws.com/model/<profil>/invoke`
    mit dem Anthropic-Messages-Format (`anthropic_version: "bedrock-2023-05-31"`),
    Systemanweisung, als Nutzertext nur der maskierte Text, `max_tokens` (Standard 8192),
    strukturierte Ausgabe über `output_config.format` (JSON-Schema aus dem Vertrag),
    Zeitlimit 120 s. Läuft die Funktion laut `SB_REGION` nicht in einer EU-Region, wird
    nichts gesendet.
  - `sigv4.ts` – Anmeldung mit AWS Signature Version 4 (geprüft gegen die AWS-Testsuite).
  - `pruefen.ts` – nur lesende Prüfungen für `npm run pruefe:bedrock`.
- `ki/systemanweisung.ts`: feste Systemanweisung (deutsch).
- `ki/beispiele/`: Platz für spätere, anonymisierte Stilbeispiele.
- `../_shared/vertrag.ts`: Eingang `{ art, text }` und Antwort (`KiErgebnis`) mit zod;
  wird auch von der App benutzt. Die strikte Prüfung der Antwort macht weiterhin das Gerät.

## Umgebungsvariablen der Funktion (Geheimnisse, nie im Repository)

| Name                                         | Inhalt                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `APP_HERKUNFT`                               | Adresse der App, z. B. `https://<benutzer>.github.io` (nur Herkunft, ohne Pfad). Einzige erlaubte Herkunft. |
| `ZUGANGSCODE_HASHES`                         | SHA-256-Hashes (hex) der erlaubten Zugangscodes, durch Komma getrennt. Nie die Codes selbst.                |
| `KI_ANBIETER`                                | `bedrock`. Leer = nicht eingerichtet. `attrappe` nur zum Ausprobieren.                                      |
| `BEDROCK_REGION`                             | Quellregion, Standard `eu-central-1`. Nur EU-Mitgliedstaaten (siehe oben).                                  |
| `BEDROCK_MODELL`                             | Standard `eu.anthropic.claude-haiku-5-5`; nach dem Testsatz ggf. `eu.anthropic.claude-sonnet-5-5`.          |
| `BEDROCK_EFFORT`                             | Optional `low`, `medium` oder `high` (ohne Angabe: Voreinstellung des Modells, bei Haiku 5.5 `medium`).     |
| `BEDROCK_MAX_TOKENS`, `BEDROCK_ZEITLIMIT_MS` | Optional; Standard 8192 bzw. 120000. Höchstens 16000 Token.                                                 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Zugangsschlüssel des eigens angelegten IAM-Benutzers mit kleinstmöglichen Rechten (Schritt 2).              |
| `MAX_ANFRAGEN`, `FENSTER_MINUTEN`            | Mengenbegrenzung pro Zugangscode (Standard 30 je 10 Minuten).                                               |

`SB_REGION` setzt Supabase selbst (Region, in der die Funktion gerade läuft). Ein
Bedrock-API-Schlüssel (`AWS_BEARER_TOKEN_BEDROCK`) wird ebenfalls verstanden, ist aber
nur zum Ausprobieren gedacht: AWS empfiehlt langfristige API-Schlüssel nur zur Erkundung,
kurzfristige laufen nach höchstens 12 Stunden ab.

## Schritt für Schritt

### 1. AWS-Konto, Claude in `eu-central-1` freischalten

Zweck: Ohne Konto und Freischaltung gibt es keinen Zugang zum Modell.

1. AWS-Konto anlegen (nach Zustimmung der Klinik voraussichtlich auf die Klinik).
2. In der Bedrock-Konsole die Region **Europe (Frankfurt) `eu-central-1`** wählen und den
   Zugang zu **Claude Haiku 5.5** und **Claude Sonnet 5.5** anfordern bzw. die
   Anthropic-Bedingungen annehmen. Der Weg (Konsole „Model access" oder Abonnement über
   AWS Marketplace beim ersten Aufruf) ist **beim Einrichten prüfen**.
3. Die Konsole immer in `eu-central-1` benutzen. Kein Aufruf aus London oder Zürich, keine
   `global.`-Profile.

### 2. Zugang mit kleinstmöglichen Rechten

Zweck: Der Schlüssel in der Serverfunktion darf nur genau dieses EU-Profil aufrufen.

1. In IAM einen eigenen Benutzer anlegen (z. B. `visiten-verarbeiten`), ohne Konsolenzugang.
2. Folgende Richtlinie anhängen (`<KONTO-ID>` ersetzen; für Sonnet die Einträge mit
   `claude-sonnet-5-5` ergänzen). Sie erlaubt den Aufruf nur über das EU-Profil aus
   Frankfurt und nur der Modelle in dessen EU-Zielregionen und sperrt globale Profile:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NurDasEuProfilAusFrankfurt",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:eu-central-1:<KONTO-ID>:inference-profile/eu.anthropic.claude-haiku-5-5"
    },
    {
      "Sid": "ModellNurUeberDiesesProfilInEuZielen",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": [
        "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-haiku-5-5",
        "arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-haiku-5-5",
        "arn:aws:bedrock:eu-south-1::foundation-model/anthropic.claude-haiku-5-5",
        "arn:aws:bedrock:eu-south-2::foundation-model/anthropic.claude-haiku-5-5",
        "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-haiku-5-5",
        "arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-haiku-5-5"
      ],
      "Condition": {
        "StringLike": {
          "bedrock:InferenceProfileArn": "arn:aws:bedrock:eu-central-1:<KONTO-ID>:inference-profile/eu.anthropic.claude-haiku-5-5"
        }
      }
    },
    {
      "Sid": "GlobaleProfileSperren",
      "Effect": "Deny",
      "Action": "bedrock:InvokeModel*",
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:RequestedRegion": "unspecified" } }
    }
  ]
}
```

3. Für diesen Benutzer einen Zugangsschlüssel (Access Key) erzeugen. Er kommt nur in die
   Geheimnisse der Funktion (Schritt 5) und – zum Testen – in die lokale Datei
   `.env.bedrock.local` (von git ausgeschlossen). Nie in eine Datei im Repository.
4. Für `npm run pruefe:bedrock` braucht ein **eigener** Prüf-Zugang zusätzlich nur lesende
   Rechte: `bedrock:GetInferenceProfile`, `bedrock:GetAccountDataRetention`,
   `bedrock:GetModelInvocationLoggingConfiguration`. Diese Rechte bekommt der Benutzer
   der Serverfunktion nicht.

Ob die Modell-ARNs ohne Kontonummer (`::foundation-model/…`) und die Bedingung genau so
greifen, ist **beim Einrichten prüfen** (AWS-Vorlage: „Prerequisites for inference
profiles"). Fehlt ein Recht, lehnt Bedrock mit 403 ab – es wird nichts still umgeleitet.

### 3. Aufbewahrung `none`, Protokollierung aus – und gegenprüfen

Zweck: Bedrock soll Anfragen und Antworten nicht speichern.

1. Den Aufbewahrungsmodus für das Konto in `eu-central-1` auf `none` setzen. Laut AWS gibt
   es dafür zur Einführung keine Oberfläche, nur API bzw. SDK, z. B. mit einem
   kurzfristigen Bedrock-API-Schlüssel eines Administrators:

   ```
   curl -X PUT https://bedrock.eu-central-1.amazonaws.com/data-retention \
     -H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK" \
     -H "Content-Type: application/json" \
     -d '{ "mode": "none" }'
   ```

   Die Einstellung gilt je Region; Projekte können sie überschreiben – keine Projekte mit
   anderem Modus anlegen. Optional eine Richtlinie, die jeden anderen Modus verbietet
   (AWS-Beispiel mit `bedrock:DataRetentionMode`).

2. **Model invocation logging** in den Bedrock-Einstellungen **nicht** einschalten (ist
   optional und standardmäßig aus).
3. Gegenprüfen (nur lesend):

   ```
   npm run pruefe:bedrock
   ```

   Das Programm fragt aus der Quellregion die Zielregionen des Profils
   (`GetInferenceProfile`), den Aufbewahrungsmodus (`GET /data-retention`) und die
   Protokollierung (`GET /logging/modelinvocations`) ab und meldet deutlich, wenn ein Ziel
   außerhalb der EU liegt, der Modus nicht `none` ist oder die Protokollierung an ist.
   Das genaue Antwortformat von `GET /data-retention` auf `bedrock` ist **beim Einrichten
   prüfen** (das Programm liest `mode`).

4. Von Hand: Ob Haiku 5.5 den Modus `none` zulässt (`allowed_modes`), zeigt die
   Steuerungsebene laut AWS nicht an. Mit Modus `none` lehnt Bedrock Modelle, die
   Aufbewahrung verlangen, mit `ValidationException` ab statt zu speichern – ein
   erfolgreicher Lauf in Schritt 4 belegt es also.

### 4. Testsatz mit erfundenen Diktaten (Haiku, dann Sonnet)

Zweck: Entscheiden, ob Haiku reicht, bevor die App angebunden wird.

1. `werkzeuge/bedrock.env.beispiel` nach `.env.bedrock.local` kopieren und ausfüllen
   (Region, Modell, Zugangsschlüssel aus Schritt 2).
2. `npm run test:ki` – sendet ausschließlich die 20 maskierten, erfundenen Diktate aus
   `tests/ki/faelle/` mit genau dieser Systemanweisung an genau diesen Anbieter und gibt
   eine Tabelle und eine Summenzeile aus.
3. In `.env.bedrock.local` `BEDROCK_MODELL=eu.anthropic.claude-sonnet-5-5` setzen (Richtlinie
   aus Schritt 2 dafür ergänzen) und erneut laufen lassen; optional mit `BEDROCK_EFFORT=low`.
   Die Summenzeilen sind direkt vergleichbar. Sonnet nur nehmen, wenn Haiku erkennbar
   schlechter abschneidet.
4. Der erste Aufruf mit dem Schema kann bis ca. 90 s dauern (AWS kompiliert die Grammatik
   einmal und hält sie 24 Stunden vor).

### 5. Supabase-Projekt in der EU, Geheimnisse, Ausrollen, EU-Ausführung, Zugangscode

Zweck: Die Funktion soll nur in der EU laufen und nur die App bedienen.

1. Supabase-Projekt in **Frankfurt (`eu-central-1`)** anlegen; Supabase-CLI installieren
   und anmelden.
2. Zugangscode erzeugen (Abschnitt unten) und den **Hash** notieren.
3. Geheimnisse setzen – am besten aus einer lokalen, nicht eingecheckten Datei:
   `supabase secrets set --env-file <datei>` mit `KI_ANBIETER=bedrock`, `BEDROCK_REGION`,
   `BEDROCK_MODELL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `APP_HERKUNFT`
   (Adresse der App), `ZUGANGSCODE_HASHES`. Die Datei danach löschen.
4. Ausrollen: `supabase functions deploy verarbeiten --no-verify-jwt` (die App benutzt
   kein Supabase-Konto, sie meldet sich mit dem eigenen Zugangscode an). Ob
   `--no-verify-jwt` dafür der richtige Weg ist, **beim Einrichten prüfen**.
5. EU-Ausführung sicherstellen: Supabase führt Edge Functions standardmäßig in der
   Region aus, die dem Aufrufer am nächsten ist, und erlaubt eine feste Region über die
   Kopfzeile `x-region` oder den Abfrageparameter `forceFunctionRegion`. Die App benutzt
   den Abfrageparameter (keine zusätzliche CORS-Kopfzeile nötig):
   `https://<projekt>.supabase.co/functions/v1/verarbeiten?forceFunctionRegion=eu-central-1`.
   Zusätzlich prüft der Code bei jeder Anfrage `SB_REGION` und sendet nichts an Bedrock,
   wenn die Funktion nicht in einer EU-Region läuft. Kontrolle: Kopfzeile
   `x-sb-edge-region` der Antwort bzw. Eintrag in den Funktionsprotokollen. Dass
   `SB_REGION` in der ausgerollten Funktion gesetzt ist, **beim Einrichten prüfen** (sonst
   antwortet die Funktion mit 502 `ausfuehrung-ausserhalb-eu`).
6. Protokolle: Die Funktion schreibt nur Zeit, Dauer und Statuscode. Was die Plattform
   (Supabase) selbst protokolliert, **beim Einrichten prüfen**; Rumpfinhalte dürfen dort
   nicht landen.

### 6. App bauen, Zugangscode eintragen

Zweck: Die App kennt die Adresse der Funktion; den Code kennt nur das iPhone.

1. `VITE_VERARBEITEN_URL="https://<projekt>.supabase.co/functions/v1/verarbeiten?forceFunctionRegion=eu-central-1" npm run build`
   und den Ordner `dist` ausliefern (GitHub Pages).
2. Auf dem iPhone: Einstellungen → Zugang → Zugangscode eintragen (wird verschlüsselt
   gespeichert, nie wieder angezeigt).
3. Mit einer **erfundenen** Eingabe prüfen: Verarbeiten, „So wurde der Text gesendet"
   ansehen, Entwurf prüfen.

## Zugangscode erzeugen

1. Einen langen Zufallscode erzeugen, z. B.:
   `node -e "console.log(crypto.randomBytes(24).toString('base64url'))"`
2. Den Hash bilden:
   `node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" <CODE>`
3. Den Hash in `ZUGANGSCODE_HASHES` eintragen; den Code selbst nur im iPhone unter
   Einstellungen → Zugang eingeben.

## Was erst mit Konto geprüft werden kann

- Freischaltung der Modelle und Annahme der Anthropic-Bedingungen in `eu-central-1`.
- Dass die IAM-Richtlinie genau ausreicht (und nicht mehr erlaubt).
- Antwortformat von `GET /data-retention` auf der Steuerungsebene; `allowed_modes` von
  Haiku 5.5 und Sonnet 5.5 bei Modus `none`.
- Zielregionen per `GetInferenceProfile` (die Modellkarte nennt sechs EU-Ziele, die API
  liefert laut Referenz höchstens fünf Einträge – Abweichung beobachten).
- Echte Antworten: strukturierte Ausgabe, Denkblöcke, Abbruchgründe, Laufzeiten,
  Ergebnis des Testsatzes.
- Supabase: `SB_REGION`, `forceFunctionRegion`, JWT-Prüfung, Plattform-Protokolle.

## Bekannte Grenzen

- Die Mengenbegrenzung liegt im Arbeitsspeicher und gilt nur pro laufender Instanz.
- Typprüfung und Tests laufen ohne Deno-Installation über Vitest/tsc; der Deno-Einstieg
  (`index.ts`) ist nur gegen eine kleine Typbeschreibung geprüft, nicht in Deno ausgeführt.
- (Überholt: Die App liest inzwischen den festen Fehlercode und zeigt dafür einen kurzen
  deutschen Satz; im Gerät gilt zusätzlich ein Zeitlimit von 150 s.)
- Erlaubt sind EU-Profile `eu.anthropic.claude-(haiku|sonnet|opus)-…`, auch mit Anhang aus
  Datum und Version (z. B. `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, Modellkarte
  „Claude Haiku 4.5"). Ob ältere Modelle das Anfrageformat (strukturierte Ausgabe, `effort`)
  genauso annehmen, ist **beim Einrichten prüfen**; empfohlen bleiben Haiku 5.5/Sonnet 5.5.
- Die Profile für Haiku 5.5 und Sonnet 5.5 sind laut AWS „inference profiles with limited
  model selection"; neue Modellversionen kommen dort eventuell nicht an.
