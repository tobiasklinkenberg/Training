# Stand der Umsetzung

## Phase 1 – Gerüst (22.11.2026)

### Was steht

- **Projekt:** Vite 8, React 19, TypeScript 6 (strict), Tailwind 4, Dexie 4, zod 4,
  Vitest 5, Playwright 1.65, ESLint 10, Prettier 3. `base: './'` und Hash-Routing
  (`#/station`) für statisches Hosting unter einem Unterpfad (GitHub Pages).
- **Thema und Navigation:** dunkles Thema, mobil zuerst, Safe-Area-Abstände,
  Navigation unten (Station, Abarbeiten, Übergabe, Einstellungen). Ziffernfeld und
  Rückfragen im unteren Bildschirmbereich.
- **Bildschirme:** Sperre (PIN anlegen beim ersten Start, danach Entsperren,
  „PIN vergessen?" mit Rückfrage → alles löschen), Station (leerer Zustand),
  Einstellungen (Hinweis zur Datenablage, Anzeige „Dauerhaft gespeichert",
  PIN ändern, Alles löschen). Abarbeiten, Übergabe senden, Eingabe, Prüfen und
  Patient waren Platzhalter („Noch nicht verfügbar"); seit Phase 2 ist nur noch
  „Übergabe senden" Platzhalter.
- **Service Worker:** `vite-plugin-pwa` (generateSW). Vorab-Cache nur für die
  statischen Dateien der App, kein Laufzeit-Cache. Manifest „Visiten-App" /
  „Visite", `display: standalone`, dunkle Farben, Platzhalter-Symbole.
  Offline-Start im Playwright-Test geprüft.
- **PIN und Schlüssel** (`src/krypto/krypto.ts`, `src/speicher/tresor.ts`):
  PBKDF2-HMAC-SHA-256, 600 000 Iterationen, 16 Byte Salz; Iterationszahl und Salz
  in der Meta-Tabelle, Iterationszahl wird beim Entsperren von dort gelesen.
  KEK umhüllt einen zufälligen AES-GCM-256-Datenschlüssel; PIN und PIN-Hash
  werden nicht gespeichert. Datenschlüssel nur im Arbeitsspeicher, nicht
  exportierbar. PIN ändern hüllt nur neu ein (neues Salz).
- **Sperre** (`src/sitzung/sperrUeberwachung.ts`): sofort bei
  `visibilitychange` → hidden (maßgeblich), zusätzlich bei `pagehide`. Frist
  2 Minuten ohne Bedienung: Zeitpunkt der letzten Bedienung wird gemerkt und
  beim Timer-Ablauf, bei Rückkehr (`visible`) und vor jedem Speicherzugriff
  gegen die Uhr geprüft. Beim Sperren wird der entsperrte Bereich der
  Oberfläche vollständig ausgehängt (kein entschlüsselter Zustand bleibt).
  Seit Phase 2 mit „Sichern vor dem Sperren" (siehe dort).
- **Zuletzt geöffneter Bildschirm** wird bei jedem Wechsel sofort in der
  Meta-Tabelle gespeichert und nach dem Entsperren wiederhergestellt.
- **Dauerhafter Speicher:** nach dem Anlegen der PIN `navigator.storage.persist()`,
  angezeigt wird der tatsächliche Zustand laut `persisted()`; fehlt die API:
  „Unbekannt".
- **Verschlüsselter Speicher** (`src/speicher/`): Tabellen `patienten`,
  `eingaben`, `visiteneintraege`, `aufgaben` (mit `wirkstoff?`),
  `verlaufsnotizen`, `meta`. Im Klartext nur IDs, Status und Zeitstempel; alle
  übrigen Felder gemeinsam als JSON → AES-GCM mit frischem 12-Byte-IV und AAD
  `visiten-app|<tabelle>|<id>`. Typisierte Zugriffsschicht `Zugriff` (lesen,
  alleLesen, schreiben, löschen, patientMitAllenDatenLoeschen), zod-Prüfung
  beim Schreiben und Entschlüsseln; gesperrt → `GesperrtFehler`.
- **Tests:** 40 Einheitstests (Vitest, fake-indexeddb, WebCrypto aus Node),
  1 Playwright-Hauptweg (PIN anlegen → entsperrt → neu laden → gesperrt →
  entsperren → gleiche Stelle, zusätzlich Start ohne Netz).
- `src/daten/medikamente.json` unverändert, nicht importiert, nicht im Build;
  in `.prettierignore`, ESLint-Ignore und `.gitattributes` (`-text`).

### Was fehlt (spätere Phasen)

Patienten, Eingabe, Aufgaben, Abarbeiten (Phase 2, inzwischen umgesetzt),
Pseudonymfilter (Phase 3), KI-Pipeline (Phase 4), Übergabe-Seite `/uebergabe`
(Phase 5), Härtung auf dem iPhone (Phase 6). Medikamenten-Information (Stufe 2).

### Annahmen

- TypeScript 6.0 statt 7.0: `typescript-eslint` 8.73 unterstützt nur `<6.1`.
- Eigener kleiner Hash-Router statt `react-router` (wenige feste Routen).
- Der gemerkte Bildschirm liegt unverschlüsselt in der Meta-Tabelle (nur Pfad,
  später höchstens IDs) und wird nur im entsperrten Zustand geschrieben.
- „Alles löschen" löscht die gesamte IndexedDB-Datenbank (inkl. Meta) und legt
  sie leer neu an; danach beginnt die App mit „PIN festlegen".
- Eingabe, Prüfen und Patient haben keinen Eintrag in der unteren Navigation
  (sie werden über ein Bett erreicht).
- Die npm-Skripte rufen die Werkzeuge direkt über `node node_modules/...` auf:
  Der Projektpfad enthält ein `&`, an dem die Windows-Startdateien in
  `node_modules/.bin` (und damit `npx`) scheitern.

### Bekannte Grenzen

- iOS kann beim Wechsel in den Hintergrund ein Vorschaubild erstellen, bevor die
  Sperre die Oberfläche geleert hat; auf dem Gerät noch zu prüfen (Phase 6).
- Laufende Timer werden im Hintergrund angehalten; abgesichert durch die
  Uhrzeitprüfung, aber die Sperre greift dann erst bei Rückkehr oder Zugriff.
- Platzhalter-Symbole (einfaches Kreuz), noch kein gestaltetes App-Symbol.
- Playwright läuft in Chromium mit Mobilformat, nicht in Safari/WebKit.

## Phase 2 – Kern ohne KI (22.11.2026)

### Was steht

- **Station:** Betten in natürlicher Reihenfolge („12-2" vor „12-10"), je Bett
  Kürzel und Zahl der fälligen offenen Aufgaben (gezählt über Klartextfelder
  `status`/`tag`, ohne Entschlüsseln). „Bett anlegen" als Blatt von unten; nach
  dem Speichern bleibt das Formular für das nächste Bett offen. Bett antippen →
  direkt Eingabe; kleiner Knopf „Patient" je Zeile.
- **Eingabe** (`/eingabe/<patientId>`, als Nachtrag `/eingabe/<patientId>/nachtrag`):
  großes Textfeld, sofort im Fokus, Umschalter Visite/Nachtrag, Anzeige
  „Gespeichert", Verweis „Zum Patienten", Hauptaktion „Weiter".
- **Aufgaben anlegen** (`/pruefen/<eingabeId>`): eingesprochener Text nur lesbar,
  Aufgaben dieser Eingabe (antippen → ändern/verwerfen), Anlegen über Text +
  drei Stufen-Knöpfe, „Fertig" setzt `verarbeitung = "fertig"`.
- **Abarbeiten** (`/abarbeiten`, `/abarbeiten/<patientId>`, Ende
  `/abarbeiten/ende`): Patient für Patient in Bettreihenfolge, drei Abschnitte
  mit festen Überschriften, Abhaken per Wisch und per Knopf, Erledigtes bleibt
  durchgestrichen sichtbar und lässt sich zurücknehmen, Aufgabe antippen →
  Text/Stufe ändern, „Verwerfen". Unten „Nächster Patient", „Zurück",
  „Nachtrag", „Aufgabe"; Anzeige „Patient 2 von 5"; am Ende „Alles erledigt".
- **Patient** (`/patient/<patientId>`): Bett und Kürzel ändern, Aufgaben aller
  Zustände (ändern, verwerfen, wieder aufnehmen, neue anlegen), Eingaben mit
  Datum, Art und Text (nur lesbar), „Entlassen" mit Rückfrage → Patient und alle
  zugehörigen Daten werden sofort gelöscht.
- **Übertrag in den Folgetag** (`src/fachlich/abarbeiten.ts`): `tag` wird nicht
  umgeschrieben; fällig ist jede offene Aufgabe mit `tag <= heute`. Reihenfolge
  Stufe 1, 2, 3; je Stufe zuerst übertragene (älteste zuerst, Vermerk „offen
  seit 21.11."), dann heutige in Anlegereihenfolge. „Heute" wird beim Entsperren
  und bei Rückkehr in den Vordergrund neu bestimmt.
- **Unterbrechungssicherheit:** Die Eingabe entsteht beim ersten Zeichen als
  Datensatz und wird bei jedem Eingabeereignis sofort verschlüsselt gespeichert
  (`src/speicher/entwurf.ts`: Schreibvorgänge hintereinander, neuester Stand
  gewinnt). Der Umschalter wird sofort gespeichert. Leer gebliebene Entwürfe
  werden beim Verlassen entfernt, leere offene Eingaben früherer Tage beim
  nächsten Öffnen. Eine offene Eingabe vom selben Tag wird fortgesetzt; nach
  „Fertig" ist der Rohtext unveränderlich (auch in der Zugriffsschicht geprüft).
- **Sichern vor dem Sperren** (`src/speicher/tresor.ts`): (a) Phase „sichert" wird
  synchron gemeldet, die Oberfläche schaltet per `flushSync` sofort auf die
  Sperre, neue Lese- und Schreibzugriffe scheitern; (b) bereits angemeldete
  Sicherungen laufen zu Ende; (c) dann wird der Schlüssel verworfen, spätestens
  nach 1 s. Gilt für `hidden`, `pagehide` und die 2-Minuten-Frist. Jeder
  Schreibvorgang über `Zugriff.schreiben` holt seine Berechtigung beim Start und
  gilt danach als ausstehende Sicherung (keine zweite Prüfung nach dem
  Verschlüsseln mehr); eine Berechtigung verfällt mit dem Verwerfen des Schlüssels.
- **Routen mit Kennung** werden sofort gemerkt; nach dem Entsperren wird geprüft
  (nur über Klartext-IDs), ob das Ziel noch existiert, sonst Station.
- **Tests (Stand Phase 2):** 66 Einheitstests (6 Dateien), 4 Playwright-Tests (Phase-1-Hauptweg,
  Kern-Hauptweg inkl. Neuladen und Wisch, Übertrag mit Playwright-Uhr, Entlassen
  mit Rohdatenprüfung in IndexedDB).

### Abweichung vom Datenmodell (CLAUDE.md Abschnitt 5)

- **`Aufgabe.eingabeId` ist optional** (vom Orchestrator entschieden). Aufgaben aus
  „Aufgaben anlegen" tragen die `eingabeId`; Aufgaben, die in „Abarbeiten" oder
  „Patient" von Hand entstehen, haben keine. `quelle` ist bei Handaufgaben leer.
  Keine Dexie-Version nötig (der Index `eingabeId` erfasst Datensätze ohne Feld
  einfach nicht).

### Annahmen

- Anlegereihenfolge ohne zusätzliches Feld: neue IDs sind zeitlich sortierbar
  (`src/speicher/ids.ts`, Zeit + Zähler + Zufall). Bestehende IDs bleiben gültig.
- „Erledigtes bleibt am selben Tag sichtbar": seit Phase 3 über `erledigtAm`
  gelöst (siehe dort); die frühere Grenze für übertragene Aufgaben entfällt.
- Die Reihe in „Abarbeiten" umfasst Patienten mit fälligen offenen Aufgaben plus
  den gezeigten Patienten und Patienten, deren Aufgaben in dieser Runde abgehakt
  wurden; so bleibt „Patient 2 von 5" während der Runde stabil.
- „Fertig" führt bei einem Nachtrag zurück zu `/abarbeiten/<patientId>` (der
  Nachtrag kommt aus „Abarbeiten"), bei einer Visite zur Station.
- Wird die Eingabe als Nachtrag geöffnet und gibt es schon eine offene Eingabe vom
  selben Tag, wird diese fortgesetzt und ihre Art auf „Nachtrag" gesetzt.
- Der Umschalter Visite/Nachtrag vor dem ersten Zeichen wird nur im Speicher der
  Oberfläche gehalten (es gibt noch keinen Datensatz); mit dem ersten Zeichen wird
  er mitgespeichert.
- Gezählt und abgearbeitet werden nur Aufgaben mit Status „offen" (Status
  „vorschlag" entsteht erst mit Phase 4).
- Im Bildschirm „Patient" führt das Antippen einer Eingabe zu „Aufgaben anlegen"
  dieser Eingabe (dort lässt sich auch eine ältere, nicht abgeschlossene Eingabe
  mit „Fertig" abschließen).

### Bekannte Grenzen

- iOS öffnet die Tastatur nur bei Fokus direkt aus einer Berührung; der Fokus
  wird nach dem Laden der Eingabe gesetzt, die Tastatur kann daher einen
  zusätzlichen Tipp ins Textfeld brauchen (auf dem Gerät zu prüfen, Phase 6).
- Ob iOS beim Wechsel in den Hintergrund ausstehende IndexedDB-Schreibvorgänge
  noch abschließt, ist nur auf dem Gerät prüfbar; die App sichert jedes
  Eingabeereignis sofort, sodass höchstens das letzte Zeichen gefährdet ist.
- Wird die Sperre aus einem React-Effekt heraus ausgelöst (Fristablauf genau bei
  einem Zugriff beim Laden), meldet React im Entwicklungsmodus, dass `flushSync`
  dort nicht synchron wirken kann; die Sperre erscheint dann im nächsten Durchlauf.
- (Überholt durch Phase 6: PIN-Fehlversuche sind begrenzt; angefangene Formulare
  überstehen die Sperre.)

## Phase 3 – Pseudonymfilter und `erledigtAm` (22.11.2026)

### Was steht

- **`Aufgabe.erledigtAm?`** (ISO-Zeitstempel, Klartext wie `tag`): wird beim
  Abhaken gesetzt und beim Zurücknehmen entfernt (`abhaken()` in
  `src/fachlich/abarbeiten.ts`). „Abarbeiten" zeigt Erledigtes durchgestrichen,
  wenn `erledigtAm` am heutigen Kalendertag liegt – unabhängig von `tag`, auch
  nach Verlassen, Sperren und Neuladen; am Folgetag ist es weg. Datensätze ohne
  `erledigtAm` verhalten sich wie in Phase 2. Kein Dexie-Versionssprung nötig
  (kein Index).
- **Pseudonymfilter** (`src/pseudonym/`): reine, deterministische Funktionen ohne
  Netz, Datenbank, Uhr oder Zufall (per Test über den Quelltext geprüft); das
  aktuelle Jahr kommt als Parameter.
  - `maskieren(text, patient, alleNamen, { aktuellesJahr }) → { text, ersetzungen, hinweise }`
  - `demaskieren(text, ersetzungen)`: exakter Rückweg für jeden Text (jede
    Schreibweise an ihrer Stelle, auch Entferntes und vorhandene `[[`).
  - `namenEinsetzen(kiText, ersetzungen) → { text, unbekannteMarken }` für neu
    formulierten Text (Phase 4).
  - Marken: `[[PATIENT]]`, `[[PERSON_n]]` (Reihenfolge des ersten Auftretens),
    `[[ENTFERNT_n]]` (gleicher Wortlaut = gleiche Marke).
  - Erkannt: voller Name in beiden Reihenfolgen (auch „Nachname Vorname",
    „Nachname,Vorname", einzelne Vornamen + Nachname), Nachname allein, mit
    Anrede (Herr, Herrn, Frau, auch mit Dr./Prof./med. dazwischen; Anrede wird
    mit ersetzt), Genitiv (Endung bleibt stehen), Umschrift ä/ae, ö/oe, ü/ue,
    ß/ss in beide Richtungen (auch zerlegtes Trema), Groß/Klein beliebig,
    Doppelnamen (ganz und je Teil), Adelsprädikate (mit und ohne Zusatz).
    Wortgrenzen über Unicode-Buchstaben (Umlaute, ß).
  - Unbekannte Namen hinter Herr/Herrn/Frau/Dr./Prof. (bis zu drei
    großgeschriebene Wörter, Namenszusätze dazwischen) → `[[PERSON_n]]` mit
    Hinweis; ihr Nachname wird danach im ganzen Text auch ohne Anrede ersetzt.
    Rollenwörter („Frau Doktor", „Herr Kollege", „Frau Oberärztin" …) gelten
    nicht als Namen.
  - Entfernt (mit Hinweis: Art, Wortlaut, Position): Datum mit Geburts-Kontext
    (geboren, geb., *, Geburtsdatum, Geburtstag, Jahrgang, Jg.; auch ohne Jahr
    oder nur Jahreszahl), vollständige Daten (TT.MM.JJ(JJ), mit Monatsname,
    JJJJ-MM-TT, TT/MM/JJ) mit Jahr ≤ aktuelles Jahr − 2, Ziffernfolgen ab 7
    Stellen, der Wert nach Fallnummer, Fall-Nr., Aufnahmenummer, Patientennummer,
    Pat.-Nr., Versichertennummer, PID.
- **Einstellungen:** „Namenstabelle" (Standard aus; an: Feld „Name" beim Bett
  anlegen und im Bildschirm „Patient", verschlüsselt gespeichert; aus: nach
  Rückfrage werden alle Namen gelöscht) und „Gesendeten Text anzeigen" (Standard
  an). Schalter in der Meta-Tabelle (`einstellungen`, nur Ja/Nein).
- **Aufgaben anlegen:** aufklappbarer Abschnitt „So würde der Text gesendet" mit
  dem maskierten Text und den Hinweisen; ausdrücklich „Noch wird nichts
  gesendet". Die Stationsliste zeigt weiterhin nur Bett und Kürzel.
- **Tests:** 103 Einheitstests (8 Dateien; davon 32 zum Filter inkl. 3 × 1000
  Zufallstexten mit festem Startwert), 5 Playwright-Tests (neu: Namenstabelle
  und gesendeter Text; `erledigtAm` über Neuladen und Folgetag im Übertrag-Test).

### Annahmen

- `optionen.aktuellesJahr` fehlt → jedes vollständige Datum wird entfernt (lieber
  zu viel als zu wenig).
- Zweistellige Jahre: 20JJ, sofern nicht nach dem aktuellen Jahr, sonst 19JJ.
- Gleicher Nachname bei mehreren bekannten Personen und nur der Nachname im Text:
  Zuordnung zum Patienten der Eingabe, sonst zur ersten Person der Liste; Hinweis
  „Name nicht eindeutig zugeordnet".
- Grundform für `namenEinsetzen`: „Herr/Frau Nachname" (Nachname wie
  gespeichert bzw. wie diktiert), wenn irgendwo im Diktat eine Anrede stand,
  sonst der Name wie zuerst diktiert. Nach „Dr."/„Prof." ohne Herr/Frau bleibt der
  Titel im Text stehen und gehört nicht zur Grundform.
- Bereits vorhandene „[[" im Diktat werden im maskierten Text zu „[ [" entschärft
  (sichtbar für den Empfänger), damit nur echte Marken als Marken gelten.
- `namenEinsetzen` liefert ein Objekt (`text`, `unbekannteMarken`), damit
  unbekannte Marken gemeldet werden können.
- Ziffern gelten an Namensgrenzen nicht als Wortzeichen („Muster2" → ersetzt).

### Bekannte Grenzen des Filters (was er nicht erkennt)

- **Namen ohne Anrede, die nicht in der Namenstabelle stehen** (z. B. „Schmidt
  kommt morgen", Vornamen allein, Spitznamen) werden nicht erkannt. Ohne
  eingeschaltete Namenstabelle schützt nur die Anrede-Erkennung.
- **Kleingeschriebene Namen nach einer Anrede** („frau schmidt") werden nicht als
  unbekannte Namen erkannt; bekannte Namen dagegen in jeder Schreibweise.
- **Falsch geschriebene oder falsch diktierte Namen** (Tippfehler, andere
  Umschrift als ä/ae usw., z. B. „Meyer" statt „Maier", „Muller" ohne e) werden
  nicht erkannt.
- **Zu viel maskiert:** Nachnamen, die gewöhnliche Wörter sind („Weiß", „Koch",
  „Bauer", „Heide" als Kern von „von der Heide"), werden überall ersetzt, auch
  als Verb oder Nomen. Nach einer Anrede werden bis zu drei großgeschriebene
  Wörter als Name genommen („Frau Meier Kalium …" → „Kalium" mit ersetzt); ein so
  erkannter Nachname wird danach im ganzen Text ersetzt. Die Vorschau „So würde
  der Text gesendet" zeigt das.
- **Anrede als Nomen:** „Frau" bzw. „Herr" vor einem großgeschriebenen Wort, das
  kein Name ist (z. B. „die Frau Aufnahme …"), führt zu einer Ersetzung.
- **Andere persönliche Angaben** werden nicht erkannt: Adressen, Orte,
  Versicherungsnummern ohne Stichwort, Berufe, seltene Diagnosen, Angehörige ohne
  Namen („die Tochter, Lehrerin in …"), Kürzel aus der Stationsliste. Telefonnummern
  werden seit Phase 6 erkannt (siehe dort); Nummern ohne Vorwahl und ohne Stichwort
  („Tel.", „Handy" …) mit weniger als 7 Ziffern weiterhin nicht.
- **„Pat." / „Patient(in)"** gilt bewusst nicht als Anrede (danach steht meist ein
  gewöhnliches Hauptwort). Ohne gespeicherten Namen werden Namen nur hinter Herr/Frau
  (auch Hr./Fr.) erkannt; Eingabe und Prüfansicht weisen darauf hin (Phase 6).
- **Datumsangaben** ohne Geburts-Stichwort mit aktuellem oder letztem Jahr
  bleiben stehen (gewollt, klinische Termine); ein Geburtsdatum ohne Stichwort
  aus diesen Jahren (Säuglinge) bleibt damit ebenfalls stehen. Ausgeschriebene
  Daten („dritter April sechsundvierzig") werden nicht erkannt.
- **Mehrdeutigkeit:** Haben zwei bekannte Personen denselben Nachnamen, kann ein
  allein stehender Nachname der falschen Person zugeordnet werden (maskiert wird
  er trotzdem; Hinweis erscheint).
- **Rückweg bei verändertem Text:** `demaskieren` ist nur für den unveränderten
  maskierten Text exakt; für neu formulierten Text ist `namenEinsetzen` gedacht.

### Bekannte Grenzen sonst

- „Namenstabelle aus" löscht Namen nur aus den Patientendatensätzen; Namen, die im
  eingesprochenen Text selbst stehen, bleiben (verschlüsselt) im Rohtext, der
  unverändert erhalten bleibt (Grundprinzip 4).

## Phase 4 – KI-Pipeline (22.11.2026, ohne echten Dienst)

### Was steht

- **Serverfunktion** `supabase/functions/verarbeiten/` (Supabase Edge Function, Deno),
  **nicht ausgerollt**; Einrichtung siehe `docs/serverfunktion.md`. Kern als reine,
  getestete Module: Eingang `{ art, text }` mit zod (Größe begrenzt, keine Zusatzfelder),
  Zugangscode in Kopfzeile `x-zugangscode` gegen SHA-256-Hashes aus
  `ZUGANGSCODE_HASHES` (zeitkonstanter Vergleich), CORS nur für `APP_HERKUNFT`,
  Mengenbegrenzung pro Code (Arbeitsspeicher), Protokoll nur `{ zeit, dauerMs, status }`.
  Anbieter-Schnittstelle `ki/anbieter.ts` mit „nicht eingerichtet" (Standard, 503) und
  Attrappe; Systemanweisung `ki/systemanweisung.ts`; `ki/beispiele/` angelegt.
- **Gemeinsamer Vertrag** `supabase/functions/_shared/vertrag.ts` (`eingangSchema`,
  `kiErgebnisSchema`, strikt) für App und Serverfunktion.
- **Pipeline im Gerät** (`src/ki/`): `maskieren` → Senden von ausschließlich
  `{ art, text }` (maskiert) mit Zugangscode-Kopfzeile, ohne Cookies/Referrer →
  zod-Prüfung (ungültig: einmal wiederholen, dann Fehler, Eingabe bleibt,
  `verarbeitung = "fehler"`) → Belegprüfung jeder `quelle` (maskierter Text bzw. Rohtext
  nach Wiedereinsetzen; Leerzeichen/Groß-Klein tolerant) → `namenEinsetzen` →
  Speichern in **einer** Transaktion: Visiteneintrag (`entwurf` = `text`), Aufgaben
  `vorschlag`, Verlaufsnotiz `freigegeben: false`, `eingabe.verarbeitung = "fertig"`.
  Erneutes Verarbeiten ersetzt nicht freigegebene Vorschläge (keine Doppelungen),
  Handaufgaben bleiben. Ohne Netz: `wartet-auf-netz`, beim nächsten Öffnen wird
  „Jetzt verarbeiten" angeboten (nichts wird automatisch gesendet).
- **Zugang:** Einstellungen → „Zugang"; Code verschlüsselt in der Meta-Tabelle
  (eigene AAD), nach dem Speichern nie wieder angezeigt. Adresse der Serverfunktion
  als Build-Einstellung `VITE_VERARBEITEN_URL`. Ohne Adresse oder ohne Zugang erklärt
  „Verarbeiten" das kurz und bietet „Ohne KI weiter" (bisheriger Weg).
- **Prüfansicht** (`/pruefen/<eingabeId>`, Titel jetzt „Prüfen"): Rohtext
  unverändert, gesendeter Text (`gesendeterText`) bzw. Vorschau, Hinweise des Filters,
  Entwurf des Visiteneintrags und Verlaufsnotiz (änderbar, sofort gespeichert),
  Rückfragen der KI, Vorschläge mit Stufe, Quelle, „Nicht belegt" (rot, nicht
  vorausgewählt), an-/abwählbar, Text/Stufe änderbar, Aufgabe von Hand. Unbekannte
  Platzhalter werden deutlich gemeldet. Hinweis: „Entwurf: von der KI aus dem Diktat
  geordnet und formuliert … Erst mit ‚Freigeben' gilt etwas."
- **Freigeben** (`src/ki/freigabe.ts`, eine Transaktion): `freigegebenAm`,
  `verlaufsnotiz.freigegeben = true`, ausgewählte Vorschläge → `offen` (`tag` = heute),
  abgewählte → `verworfen`. Davor erscheinen Vorschläge weder in der Zahl auf der
  Station noch in „Abarbeiten" noch im Bildschirm „Patient". Nachtrag führt nach der
  Freigabe zu „Abarbeiten" beim selben Patienten.
- **Patient:** freigegebene Visiteneinträge und Verlaufsnotizen mit Datum.
- **Entwicklungs-Attrappe:** nur `npm run dev` (Vite-Plugin `entwicklung/attrappe-plugin.ts`,
  `apply: 'serve'`) über den echten Serverkern mit der deterministischen Attrappe
  (Satzteile mit „umstellen/ansetzen/…", „sichten", „anmelden/kontrollieren" werden
  wortgleich zu Aufgaben; Entwurf = Eingangstext). Dauerhafter Vermerk „Testbetrieb
  ohne KI". Im Produktions-Build nicht enthalten (geprüft).
- **Testsatz** `tests/ki/faelle/` (20 erfundene Diktate) und Prüfprogramm
  `npm run test:ki` (Tabelle: Schema, belegt, Aufgaben, Stufen, Rückfrage, Marken).
  Ohne Anbieter: klare Meldung, Ende ohne Fehler. `KI_ANBIETER=attrappe npm run test:ki`
  führt die Auswertung an der Attrappe vor (17 von 20; erwartbar, sie ist dumm).
- **Tests:** Vitest (Pipeline, Freigabe, Zugang, Versand, Serverkern, Auswertung),
  Playwright neu: Diktat mit Namen → Verarbeiten (Antwort abgefangen) → gesendeter
  Rumpf ohne Namen → Prüfen → vor Freigabe „0 offen" → Freigeben → „2 offen" →
  Abarbeiten in Stufenreihenfolge; ohne Netz → „wartet auf Netz" → angeboten.

### Ergänzungen am Datenmodell (verschlüsselter Teil, optional)

- `Eingabe.gesendeterText?` – exakt der Text, der das Gerät verlassen hat (wird vor dem
  Senden gespeichert; bei Netzfehler ist unklar, ob er angekommen ist).
- `Visiteneintrag.rueckfragen?` – Rückfragen der KI.
- **Begründete zusätzliche Änderung:** `Aufgabe.ki?: { belegt, ausgewaehlt }` nur bei
  KI-Vorschlägen. Ohne dieses Feld ließen sich „nicht belegt" und die Auswahl in der
  Prüfansicht nicht unterbrechungssicher speichern, und erneutes Verarbeiten könnte
  KI-Vorschläge nicht von Handaufgaben unterscheiden.
- Meta-Eintrag `zugang` (verschlüsselt).

### Was ohne echten Dienst nicht geprüft werden konnte

- Ob ein echter Dienst die Systemanweisung einhält (nichts ergänzt, Stufen, Rückfragen,
  Marken unverändert, reines JSON). Der Testsatz ist dafür vorbereitet.
- Laufzeit in Deno/Supabase (Import von zod über `deno.json`, `Deno.serve`, Geheimnisse,
  CORS-Verhalten hinter der Supabase-Infrastruktur, Plattform-Protokolle).
- Antwortzeiten, Zeitüberschreitungen, große Diktate, Verhalten bei langsamem Netz.
- Echte CORS-Vorabanfragen gegen die Funktion (im Browser-Test sind sie abgefangen).

### Annahmen

- Ohne Zugang oder ohne Adresse wird nichts gesendet; „Verarbeiten" führt zu einer
  kurzen Erklärung und „Ohne KI weiter".
- Die Verarbeitung läuft in der Prüfansicht (angestoßen aus der Eingabe), damit die
  gemerkte Route nach einer Sperre auf die Prüfansicht zeigt. Nach Neuladen wird nicht
  automatisch erneut gesendet.
- Eingaben mit Status „fehler" oder „wartet-auf-netz" gelten als nicht abgeschlossen:
  Sie werden beim Öffnen der Eingabe fortgesetzt, ihr Text bleibt änderbar.
  Unveränderlich ist der Rohtext erst bei „fertig". Eine bereits „fertige" Eingabe
  (z. B. „Ohne KI weiter") wird bei Netzfehler nicht wieder geöffnet.
- Die Serverfunktion verlangt die passende Herkunft (`Origin`); Anfragen ohne Herkunft
  werden abgelehnt (strengere Auslegung).
- Die Serverfunktion reicht die Antwort des Dienstes durch; die strikte Prüfung macht
  das Gerät.
- Im Testbetrieb (`npm run dev`) gilt jeder nicht leere Zugangscode; im Repository liegt
  kein Code und kein Hash.
- Pro Antwort höchstens 60 Aufgaben und 30 Rückfragen (Schema).

### Bekannte Grenzen

- Mengenbegrenzung nur pro Instanz der Serverfunktion (Arbeitsspeicher).
- Bei einer Sperre genau während des Sendens wird die Antwort verworfen (nichts halb
  gespeichert); das Verarbeiten muss erneut angestoßen werden – der Text wurde dann
  ggf. zweimal gesendet.
- Der Fertig-Knopf heißt im freigegebenen Zustand „Zurück"; nachträgliche Änderungen
  an freigegebenen Einträgen sind in Phase 4 nicht vorgesehen.

## Anbindung Bedrock (24.11.2026, ohne Konto)

### Was steht

- **Anbieter `bedrock`** (`supabase/functions/verarbeiten/ki/bedrock/`), Auswahl mit
  `KI_ANBIETER=bedrock`; Standard bleibt „nicht eingerichtet". Nur `fetch` und WebCrypto,
  keine zusätzliche Abhängigkeit; derselbe Code läuft in Deno und unter Node.
- **Schnittstelle:** InvokeModel auf `bedrock-runtime` (`POST /model/<profil>/invoke`) mit
  dem Anthropic-Messages-Format (`anthropic_version: "bedrock-2023-05-31"`), feste
  Systemanweisung, als Nutzertext nur der maskierte Text, `max_tokens` 8192 (höchstens
  16000), strukturierte Ausgabe über `output_config.format` mit einem JSON-Schema nach
  `KiErgebnis` (jedes Objekt `additionalProperties: false`, keine Längengrenzen – die prüft
  das Gerät), optional `effort`, keine Sampling-Parameter, Zeitlimit 120 s.
- **Feste Schranken (getestet):** Quellregion nur EU-Mitgliedstaaten (`eu-central-1`
  Standard, `eu-west-1`, `eu-west-3`, `eu-north-1`, `eu-south-1`, `eu-south-2`; London und
  Zürich abgelehnt); Modell nur `eu.anthropic.claude-(haiku|sonnet|opus)-…`-Profile
  (Standard Haiku 5.5; `global.`, `us.`, nackte Kennungen, Fable, Mythos abgelehnt); läuft
  die Funktion laut `SB_REGION` nicht in der EU, wird nichts gesendet.
- **Anmeldung:** SigV4 mit IAM-Zugangsschlüssel (gegen zwei Vektoren der AWS-Testsuite
  geprüft) oder Bedrock-API-Schlüssel (Bearer, nur zum Ausprobieren).
- **Antworten:** `end_turn` → Text als JSON; `max_tokens`/`model_context_window_exceeded`
  → `abgeschnitten`, `refusal` → `abgelehnt`, leer → `leer`, kein JSON → `kein-json`,
  HTTP-Fehler → nur Statusklasse. AWS-Fehlertexte werden nicht gelesen, nicht
  weitergegeben, nicht protokolliert; die Serverfunktion antwortet mit 502 und festem Code.
- **Prüfwerkzeuge:** `npm run test:ki` (mit `KI_ANBIETER=bedrock`, Modell über
  `BEDROCK_MODELL`, Tabelle plus Summenzeile) und `npm run pruefe:bedrock` (nur lesend:
  Zielregionen, Aufbewahrungsmodus, Aufruf-Protokollierung). Zugangsdaten aus der Umgebung
  oder `.env.bedrock.local` (von git ausgeschlossen; Vorlage `werkzeuge/bedrock.env.beispiel`).
  Ohne Zugangsdaten: klare Meldung, Ende ohne Fehler, kein Netzverkehr.
- **Anleitung:** `docs/serverfunktion.md`, sechs Schritte mit Richtlinienvorlage.

### Was erst mit Konto prüfbar ist

Freischaltung der Modelle, Wirkung der IAM-Richtlinie, Antwortformat von
`GET /data-retention`, `allowed_modes` bei Modus `none`, tatsächliche Zielregionen per
`GetInferenceProfile`, echte Antworten (strukturierte Ausgabe, Denkblöcke, Laufzeit bei der
ersten Schema-Kompilierung), Ergebnis des Testsatzes für Haiku und Sonnet; bei Supabase
`SB_REGION`, `forceFunctionRegion`, JWT-Prüfung und Plattform-Protokolle.

### Annahmen

- InvokeModel statt Converse oder `bedrock-mantle`: AWS empfiehlt `bedrock-runtime`; dort
  hat das EU-Profil die Messages-Felder des Anthropic-Formats (inkl. `output_config`);
  `bedrock-mantle` bietet für Haiku/Sonnet 5.5 kein EU-Profil.
- SigV4 mit einem eigenen IAM-Benutzer als Weg für die Serverfunktion (kurzfristige
  API-Schlüssel laufen nach höchstens 12 Stunden ab, langfristige sind laut AWS nur zur
  Erkundung gedacht).
- Erlaubte Modelle per Muster statt fester Liste, damit spätere EU-Profile ohne Codeänderung
  nutzbar sind; Fable und Mythos passen nicht ins Muster.
- Fehleinstellung beim Start: Meldung im Funktionsprotokoll (ohne Geheimnisse), danach
  „nicht eingerichtet" statt eines Startabbruchs.
- Die App liest den festen Fehlercode der Serverfunktion noch nicht (zeigt „Status 502").
  → erledigt, siehe Abschnitt „Bettenplan", Fehlercodes.

## Bettenplan (24.11.2026)

### Was steht

- **Betten bleiben stehen:** „Entlassen" löscht nach Rückfrage den Patienten mit allen
  Daten und legt in derselben Transaktion einen leeren Platz mit derselben Bezeichnung an
  (neue Kennung, kein Kürzel, kein Name). Neu daneben „Bett entfernen" (Rückfrage, löscht
  Bett und Daten). Die Stationsliste zeigt weiter nur Bett und Kürzel.
- **Station einrichten** (Blatt auf der Station, neben „Bett anlegen"): Zimmer von–bis,
  je Zimmer die Bettenzahl über Knöpfe 1–4, dazu „Alle Zimmer". Bezeichnung
  `<Zimmer>-<Bett>` mit zweistelligem Zimmer („01-1"), natürlich sortiert. Vorhandene
  Betten (zahlenmäßig gleich, „1-1" = „01-1") werden nicht doppelt angelegt; gelöscht wird
  nie etwas. „Bett anlegen" von Hand bleibt.
- **Bettenplan einfügen** (`#/bettenplan`): großes Textfeld mit Hinweis („Text scannen"
  falls das iPhone es anbietet, Einfügen, Tippen), „Lesen", dann Bestätigungsliste je Bett
  mit Zustand, Wahl und änderbarem Namen, darunter „Nicht zugeordnet" mit Wortlaut.
  „Übernehmen (n)" führt nur Gewähltes in einer Transaktion aus; Entlassungen werden in der
  Rückfrage einzeln mit Bett und bisherigem Namen genannt. Ist die Namenstabelle aus,
  erklärt der Bildschirm das, die Rückfrage schaltet sie erst nach Zustimmung ein.
- **Leser** `src/bettenplan/leser.ts`: reine, deterministische Funktion (feste Muster),
  kein Netz, keine KI, kein Speicher. **Abgleich** `src/bettenplan/abgleich.ts`: über die
  letzten beiden Zahlengruppen der Bezeichnung; Zustände „unverändert", „neu" (vorausgewählt
  „Name setzen"), „anderer Name" (Vorauswahl „Nichts tun"; sonst „Neuer Patient" oder „Nur
  Namen ändern"), „im Plan nicht gefunden" (nur Hinweis), „Bett fehlt in der App" (Angebot
  „Bett anlegen", nicht vorausgewählt), zusätzlich „Bett mehrfach in der App" (zwei Betten
  der App mit derselben Nummer, z. B. „4-1" und „04-1": nur Hinweis).
- **Fehlercodes der Serverfunktion:** Die App liest aus Fehlerantworten nur `fehler`
  (Muster `^[a-z][a-z-]{0,39}$`) und zeigt dafür einen festen deutschen Satz
  (`src/ki/fehlermeldung.ts`), z. B. überlastet → „… später erneut versuchen",
  abgeschnitten → „… Diktat kürzen oder erneut versuchen", nicht eingerichtet. Unbekannter
  Code → allgemeiner Satz; ohne Code → Satz nach Statuscode (401, 403, 413, 429, 503), sonst
  allgemeiner Satz. Keine Statuszahl, kein Text des Dienstes.
- **Tests:** Vitest `tests/einheit/bettenplan-leser.test.ts` (17), `bettenplan.test.ts`
  (15), Fehlercodes in `pipeline.test.ts` (+3); Playwright `tests/e2e/bettenplan.spec.ts`
  (2), `kern.spec.ts` „Entlassen" angepasst (Bett bleibt, danach „Bett entfernen").

### Datenmodell

Unverändert. Ein Bett ist weiter ein `Patient`-Datensatz mit `bett`; ein leeres Bett ist
ein Datensatz ohne Kürzel, Namen und Daten. Namen aus dem Plan werden als
„Nachname, Vorname" im verschlüsselten Feld `name` gespeichert (so zerlegt sie der
Pseudonymfilter). `Zugriff.buchen` kann zusätzlich `patientenLoeschen` (Patient mit allen
Daten in derselben Transaktion löschen); `status: "entlassen"` bleibt ungenutzt.

### Annahmen

- „Station einrichten" nur auf der Station (nicht zusätzlich in den Einstellungen); höchstens
  40 Zimmer je Durchgang, 1–4 Betten je Zimmer, Zimmernummer 1–999.
- Ohne Wahl wird ein Zimmer nicht angelegt; ein erneut angetippter Knopf hebt die Wahl auf.
- „Neuer Patient" legt das Bett mit neuer Kennung und neuem Namen an, ohne das Kürzel des
  bisherigen Patienten.
- „Unverändert" vergleicht nur den Nachnamen (Groß/Klein, Umlaute, ß tolerant); ein
  anderer oder ergänzter Vorname wird dabei nicht übernommen.
- Leere Betten ohne Fund erscheinen nicht in der Liste; Betten, deren Bezeichnung keine
  zwei Zahlengruppen hat („7"), nehmen am Abgleich nicht teil.
- Nach „Übernehmen" geht es zur Station; der Text ist dann verworfen.
- Ein Patient im Plan ist ein Fund nur mit Komma zwischen Nach- und Vorname.

### Grenzen des Lesers (rät nicht, nimmt lieber zu wenig)

- Bettzeile = Bettnummer (eine Ziffer) + „Nachname, Vorname". Fehlt das Komma (OCR liest
  „." oder nichts), wird ein „l"/„I" statt „1" gelesen oder fehlt die Bettnummer, ist die
  Zeile „nicht zugeordnet". Abhilfe: „Text ändern" und korrigieren oder Bett von Hand.
- Eine Ziffer direkt hinter einem Abteilungskürzel (zwei oder mehr Großbuchstaben) oder in
  Klammern gilt als Kästchenzahl, nicht als Bettnummer.
- Ein Bett gehört zur letzten lesbaren Zimmerüberschrift davor. Steht vor einem Zimmer
  eine angefangene, unlesbare Überschrift („B1.1-O3"), wird bis zur nächsten lesbaren nichts
  zugeordnet. Fehlt eine Überschrift ganz und unauffällig, landen Betten im vorigen Zimmer;
  abgefangen wird das nur, wenn dadurch Bettnummern nicht mehr aufsteigen, die Bettenzahl
  der Überschrift überschritten wird oder eine Bettnummer doppelt vorkommt (dann wird
  keine der Zeilen zugeordnet).
- Vertauschte Bettzeilen innerhalb eines Zimmers (2 vor 1) werden deshalb ab der
  Unstimmigkeit nicht zugeordnet.
- Überschrift: Kennung mit Buchstaben oder „Zahl.Zahl", Bindestrich, genau zwei Ziffern;
  verschmolzene Belegung („B1.1-013-3") und hochgestellte Ziffern werden erkannt. Ein
  Datum wie „29.11-30.11" gilt nicht als Überschrift.
- Vorname: nur das erste Wort (mit Bindestrich-Teilen); zweite Vornamen fallen weg;
  abgeschnittene Vornamen bleiben abgeschnitten („Bar") und sind vor dem Übernehmen änderbar.
  Namen nur in Großbuchstaben („MUSTER") oder klein geschrieben („muster") werden nicht
  erkannt (Ausnahme: Namenszusätze wie „von der").
- „Nicht zugeordnet" zeigt jede Zeile, deren Rest wie ein Wort mit Kleinbuchstaben oder
  „Wort, Wort" aussieht – also auch Vermerke wie „Sono" oder eine Titelzeile. Das ist
  Absicht (lieber zu viel zeigen als einen Namen verschlucken); übernommen wird davon nie
  etwas.

### Bekannte Grenzen

- Der eingefügte Text lebt nur im Zustand des Bildschirms: Sperre, Neuladen, App-Wechsel
  mit Neustart oder Verlassen verwerfen ihn (nach dem Entsperren ist das Feld leer).
- Was die Zwischenablage oder die iOS-Texterkennung selbst mit dem Text macht (Verlauf,
  Synchronisation, gespeichertes Foto), liegt außerhalb der App; der Bildschirm weist nur
  darauf hin.
- Nach „Namenstabelle einschalten" und einem Fehler beim Speichern bleibt die Tabelle an;
  an den Betten ist dann nichts geändert.

### Nur am iPhone prüfbar

Ob „Text scannen" im Textfeld der installierten Web-App und in Safari angeboten wird; ob
die Erkennung Umlaute, Komma und Bindestrich zuverlässig liefert, Zeilen zeilenweise oder
spaltenweise ausgibt und welche Fehlzeichen bei Geschlechtssymbolen und Kästchen entstehen;
ob dabei ein Foto gespeichert wird; Verhalten der Zwischenablage (Synchronisation über
iCloud); Lesen und Übernehmen im Flugmodus (die App braucht dafür kein Netz). Die Muster
des Lesers sollten anhand eines echten Scans (nur lokal, nicht ins Repository) nachgeschärft
werden.

## Phase 5 – Übergabe-Seite mit Kopplung und Verschlüsselung (24.11.2026, ohne Projekt)

### Was steht

- **Protokoll** `src/uebergabe/protokoll/` (nur WebCrypto, Version 1): Sitzungscode,
  QR-Inhalt, ECDH P-256 → HKDF-SHA-256 → AES-GCM 256, getrennte Ableitung der
  vierstelligen Kontrollzahl, Festlegen und Aufdecken im Code-Weg, QR-Geheimnis im QR-Weg,
  gebundene Daten (Sitzung, Richtung, laufende Nummer), Teilung großer Übergaben,
  verschlüsselte Quittung, Abbruch mit Meldung. Beschreibung: `docs/uebergabe.md`.
- **Kanal** `src/uebergabe/kanal/`: Schnittstelle `Kanal` (beitreten, senden, empfangen,
  schließen); Supabase Realtime Broadcast über `@supabase/realtime-js` 2.119.0 (nur der
  Realtime-Client, bei Bedarf geladen, öffentlicher Kanal, Protokoll 1.0.0, eigener
  Arbeitsspeicher statt `sessionStorage`); lokale Entwicklungs-Vermittlung
  (`entwicklung/kanal-plugin.ts`, nur `npm run dev`). Einstellung `VITE_KANAL_URL`,
  `VITE_KANAL_SCHLUESSEL`; ohne: „nicht eingerichtet".
- **PC-Seite** `uebergabe/index.html` + `src/uebergabe/pc/`: eigener Einstieg im Build
  (eigenes Bündel, gemeinsamer Teil nur React, zod, Protokoll), helles ruhiges Layout, QR-Code
  (uqr 0.1.3) und Code, Kontrollzahl, Einträge nach Bett mit Art, Uhrzeit, Text, „Kopieren"
  und „kopiert"-Markierung, Restzeit, „Neue Sitzung". Keine Speicher-APIs; nach 5 Minuten
  ohne Aktivität (Uhrvergleich jede Sekunde) und bei `pagehide` wird alles verworfen.
  Kein Service Worker: Registrierung und Manifest werden aus der Seite entfernt, der Service
  Worker der App hält sie nicht vor und fängt sie nicht ab. Strenge CSP als Meta-Tag (nur im
  Build): `default-src 'none'`, Skripte/Stile/Bilder nur von der eigenen Adresse,
  `connect-src` nur Kanal-Adresse.
- **iPhone** „Übergabe" (`src/oberflaeche/bildschirme/UebergabeSenden.tsx`): freigegebene,
  noch nicht übertragene Einträge nach Bett, alle vorausgewählt, abwählbar, Umschalter „Auch
  bereits übertragene von heute"; „Code eintippen" und „QR-Code scannen" unten. Kamera nur
  nach Tipp (BarcodeDetector, sonst jsQR 1.4.0, bei Bedarf geladen), Stopp nach dem Erkennen,
  bei `visibilitychange` → hidden und beim Aushängen (Sperre, Verlassen); ohne Kamera oder
  ohne Erlaubnis Hinweis und Code-Weg. Code-Weg: Kontrollzahl, „Zahl stimmt" / „Zahl stimmt
  nicht"; gesendet wird erst danach. „Angekommen: n Einträge" erst nach der Quittung.
- **Vermerk:** `Visiteneintrag.uebertragenAm` (siehe unten) erst nach der Quittung, in einem
  Zug; „Patient" zeigt „übertragen …" bzw. „noch nicht übertragen".
- **Tests:** Vitest `uebergabe-protokoll.test.ts` (20), `uebergabe-seiten.test.ts` (9);
  Playwright `uebergabe.spec.ts` (3: Code-Weg mit zwei Browser-Kontexten über einen im Test
  gespielten Realtime-Dienst, Abbruch bei falscher Zahl, Prüfung des gebauten PC-Bündels).

### Datenmodell

`Visiteneintrag.uebertragenAm?: string` (ISO), optional, im **Klartext** wie die anderen
Zeitstempel. Sonst unverändert.

### Ohne Supabase-Projekt, iPhone und Klinik-PC ungeprüft

- Verbindung zum echten Realtime-Dienst (Beitritt zu öffentlichem Kanal mit publishable key,
  Einstellung „Allow public access", tatsächliches Verhalten von `realtime-js` 2.119.0 mit
  Protokoll 1.0.0, Wiederverbinden, Grenzen). Getestet ist nur gegen eine Nachbildung des
  dokumentierten Protokolls.
- QR-Scan mit echter Kamera (Erlaubnis in der installierten Web-App, BarcodeDetector in
  Safari, Lesbarkeit des QR-Codes vom Bildschirm des Klinik-PCs), Stopp bei Sperre.
- Klinik-PC: Browser, Zwischenablage (`navigator.clipboard` braucht HTTPS), CSP-Meta-Tag,
  Proxy/Firewall gegenüber `wss://…supabase.co`, Einfügen in die Kliniksoftware.

### Annahmen

- Zeitpunkt eines Eintrags = Zeitpunkt der Eingabe (Diktat), nicht der Freigabe.
- Gesendet wird automatisch, sobald die Kopplung steht (QR-Weg) bzw. nach „Zahl stimmt"
  auf iPhone **und** PC (Code-Weg, seit Phase 6); die Auswahl wird beim Tippen auf „Code
  eintippen"/„QR-Code scannen" festgehalten.
- Aktivität auf der PC-Seite = Maus, Tastatur, Kopplung, Empfang. Ein verborgener Tab wird
  nicht sofort verworfen (nur nach Frist oder `pagehide`).
- Laufende Nummern dürfen Lücken haben (verlorene Nachricht), aber nie zurückgehen; eine
  verlorene Quittung blockiert so das erneute Senden nicht.
- Eine unbeglaubigte Abbruch-Nachricht beendet die Sitzung (Störung möglich, kein
  Datenabfluss).
- Die Kontrollzahl wird im QR-Weg nur angezeigt, nicht abgefragt.

### Grenzen

- Der Kanal-Dienst sieht Metadaten (Zeitpunkte, Größen, IP-Adressen) und kann stören.
- Der freigegebene Text geht unverändert hinüber; steht darin ein Name, sieht ihn der PC.
- Timer auf dem PC laufen in einem verborgenen Tab ggf. verzögert; beim Sichtbarwerden wird
  die Frist sofort geprüft.
- Die statischen Dateien der PC-Seite liegen ohne eigenes Zwischenspeichern im Browser-Cache
  des PCs (normales HTTP-Caching); Inhalte der Übergabe nie.
- `npm audit` meldet 4 mittlere Funde in Build-Werkzeugen (glob/minimatch über
  vite-plugin-pwa), nicht im ausgelieferten Code; unverändert gelassen.

## Phase 6 – Härtung, Teil ohne Gerät (24.11.2026)

Grundlage: Briefing Phase 6 und Befunde einer unabhängigen Durchsicht. Jeder behobene
Befund ist mit einem Test nachgestellt (`tests/einheit/haertung.test.ts`, dazu
`uebergabe-protokoll.test.ts` „Befund 4", Playwright `einhand.spec.ts`).

### Was behoben ist

- **Freigabe während „Neu verarbeiten" (Befund 1):** Prüfansicht während der Verarbeitung
  ganz gesperrt; die Buchung der Pipeline prüft in derselben Transaktion (`Zugriff.buchen`
  mit `bedingung`, nur Rohdaten), dass die Eingabe unverändert und nichts freigegeben ist –
  Freigegebenes wird nie gelöscht oder ersetzt (Ergebnis „bereits freigegeben"). Freigeben
  wirkt nur auf die angezeigten Datensätze (Kennungen und angezeigte Texte werden mitgegeben,
  Fingerabdruck-Prüfung in der Transaktion).
- **Nachdiktiertes während der Verarbeitung (Befund 2):** Eingabe währenddessen nicht
  änderbar (mit Hinweis); die Buchung vergleicht den Fingerabdruck des gespeicherten Stands
  (IV des Geheimtexts) mit dem beim Senden und verwirft das Ergebnis mit klarer Meldung. Auch
  Netz-/Fehlerstatus überschreibt nie einen neueren Text. Kein neuer Wert in `verarbeitung`.
- **Anreden (Befund 3, teilweise):** „Hr."/„Hr"/„Fr."/„Fr"; Trenner jeder Leerraum (auch
  geschütztes Leerzeichen, Zeilenumbruch). „Pat."/„Patient(in)" bewusst nicht (Grenze, siehe
  Phase 3). Neuer, nicht blockierender Hinweis in Eingabe und Prüfansicht, wenn kein Name
  gespeichert oder die Namenstabelle aus ist.
- **Übergabe (Befund 4):** Code-Weg: Einträge erst nach „Zahl stimmt" **am PC** (zusätzlich
  zum iPhone); „Zahl stimmt nicht" → Abbruch und neue Sitzung. Wege schließen sich je Sitzung
  aus; abgebrochene Versuche führen zu einer neuen Sitzung. Einträge zeigen „Empfangen über
  QR-Code" bzw. „über Code, Kontrollzahl …". `docs/uebergabe.md` richtiggestellt.
- **Sperre während Entsperren/PIN ändern/Einrichten (Befund 5):** Sperr-Epoche (jedes
  Sperren erhöht sie, auch gesperrt); ein abgeleiteter Schlüssel wird nur gesetzt, wenn sie
  unverändert und die Seite sichtbar ist. PIN ändern ändert dann nichts.
- **Stille Fehler (Befund 8):** Datensätze werden einzeln entpackt; defekte gelten als „nicht
  lesbar" (Hinweis im Kopf jedes Bildschirms), nichts wird gelöscht. Schemas lesen
  nachsichtig (`looseObject`): unbekannte Felder eines neueren Stands bleiben beim
  Zurückschreiben erhalten. Lesefehler sind auf jedem Bildschirm sichtbar. Sofortspeicher
  meldet Schreibfehler; Freigabe blockiert, bis alles gespeichert ist; Textfelder während
  der Freigabe gesperrt.
- **Neue App-Version (Befund 9):** Service Worker im Modus „prompt": neue Version nur gemeldet,
  übernommen auf dem Sperrbildschirm oder nach „Jetzt aktualisieren". Fehlt ein nachgeladener
  Teil (Realtime-Client, QR-Leser): „Bitte die App neu laden".
- **Geteilter Ursprung (Befund 10):** Inhaltsrichtlinie auch für die App (nur im Build):
  keine fremden Skripte/Stile/Bilder, Verbindungen nur zu KI-Adresse und Kanal.
  Empfehlung eigener (Sub-)Domain/Organisation in `docs/bereitstellen.md`.
- **Entlassen (Befund 11):** Rückfrage nennt freigegebene, nicht übergebene Einträge und
  bietet „Erst übergeben" (Entlassen, Bett entfernen, „Neuer Patient" im Bettenplan).
- **Zeitlimit und Sperre (Befund 12):** 150 s Zeitlimit im Gerät, Abbruch beim Sperren,
  kein zweiter Versuch nach Abbruch, Namensliste nach dem Maskieren nicht mehr gehalten.
- **Belegprüfung (Befund 13):** Quelle nur mit ≥ 10 Zeichen ohne Platzhalter und an
  Wortgrenzen; sonst „nicht belegt" (sichtbar, nicht vorausgewählt).
- **Verstellte Uhr (Befund 14, Teil B 5):** jetzt < letzte Bedienung → sofort gesperrt;
  offene Aufgaben mit `tag` in der Zukunft gelten als heute fällig (auch in der Station).
- **Schlüsselbund (Befund 15):** kein Passwortfeld mehr; PIN ändern über das Ziffernfeld in
  einem Blatt unten (bisherige → neue → wiederholen); Zugangscode als Textfeld, verdeckt.
- **PIN-Fehlversuche (Teil B 1):** ab 5 Fehlversuchen 30 s, dann verdoppelnd, höchstens
  15 Minuten; Zähler und Zeitpunkt im Klartext (Meta `fehlversuche`), über Neuladen gemerkt,
  Restzeit auf der Sperre; richtige PIN setzt zurück; kein automatisches Löschen.
- **Angefangene Formulare (Teil B 3):** Bett anlegen, Station einrichten, Bett ändern,
  Aufgabe anlegen/ändern werden verschlüsselt gesichert (Meta `formular`, gleicher
  Sicherungsmechanismus wie das Diktat) und nach dem Entsperren wieder geöffnet. Schließen
  oder Verlassen im entsperrten Zustand verwirft den Stand. Ausnahme bleibt der Bettenplantext.
- **Telefonnummern (Teil B 4):** mit Vorwahl, Leerzeichen, „/", „-", Klammern, +49/0049
  (mind. 8 Ziffern) sowie nach Stichwort (Tel., Telefon, Handy, Mobil, Rufnummer …) entfernt;
  Punkt, Komma, Doppelpunkt trennen nie (Laborwerte, Dosierungen, Uhrzeiten, Daten bleiben).
- **Fehlerfälle (Teil C):** Speicher nicht erreichbar → Satz mit nächstem Schritt und „Neu
  laden"; zweites Fenster mit neuerer Version (`versionchange`) → sperren, Hinweis, „Neu
  laden"; Fangnetz für unerwartete Fehler („Neu laden", „Zur Station"); alte Datensätze
  (Phase 2 bis 5) per Test lesbar.
- **Einhand (Teil D):** Playwright bei 390 × 844: Hauptaktionen jedes Bildschirms im unteren
  Drittel und ≥ 44 × 44; Bett → Textfeld mit einem Tipp. „Schließen" der Blätter jetzt unten.
  Höhe folgt `visualViewport` (Tastatur).
- **Prüfung am Gerät (Teil E):** `docs/pruefung-am-iphone.md`; GitHub Pages vorbereitet
  (`.github/workflows/pages.yml`, `docs/bereitstellen.md`), nicht ausgerollt.
- **EU-Profile:** Muster nimmt jetzt auch dokumentierte Kennungen mit Anhang an (z. B.
  `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, Bedrock-Modellkarte „Claude Haiku 4.5").

### Datenmodell

Unverändert bis auf Meta-Einträge `fehlversuche` (Klartext: Zahl, Zeitpunkt) und `formular`
(verschlüsselt). Schemas nachsichtig (unbekannte Felder bleiben). `HinweisArt` um `telefon`
ergänzt. Keine neue Dexie-Version.

### Was bewusst bleibt

- **6-stellige PIN (Befund 6, nicht gebaut):** Mit einer Kopie der Datenbank ist eine
  6-stellige PIN in Minuten durchprobiert (10⁶ Möglichkeiten, PBKDF2 bremst nur linear). Der
  Schutz hängt an der Gerätesperre des iPhones. Längere PIN/Passphrase oder Bindung an einen
  Geräteschlüssel entscheidet der Nutzer.
- **Namen im Visiteneintrag und in der Übergabe (Befund 7, entschieden am 24.11.2026: Namen
  bleiben):** Das Wiedereinsetzen entspricht CLAUDE.md Abschnitt 5. „Übergabe senden" zeigt je
  Eintrag „Enthält einen Namen" bzw. „Enthält ein Datum oder eine Nummer"; der Text bleibt
  unverändert. Der Klinik-PC sieht damit Namen, die im freigegebenen Text stehen.
- Unbeglaubigte Abbruch-Nachricht und Zusage können eine Übergabe-Sitzung stören (DoS), nie
  lesen oder fälschen; danach beginnt eine neue Sitzung.
- `visualViewport` und Tastatur, Vorschaubild im App-Umschalter, Kamera, Text scannen:
  nur am Gerät prüfbar.

### Nur am Gerät prüfbar

Siehe `docs/pruefung-am-iphone.md` (eine Liste, Reihenfolge wie im Alltag).

### Annahmen

- Fingerabdruck eines Datensatzes = IV des Geheimtexts plus Klartextfelder (ändert sich bei
  jedem Schreiben).
- Ein offenes Formular zur Zeit; Formulare ohne Eingabe werden nach der Sperre nicht wieder
  geöffnet.
- PIN-Wartezeit: bei zurückgestellter Uhr volle Wartezeit statt Verkürzung.
- Telefonnummern ohne Stichwort brauchen eine führende 0 oder +49/0049 und mindestens 8 Ziffern.
- Nach einer abgebrochenen Kopplung startet die PC-Seite automatisch eine neue Sitzung (nur,
  solange noch keine Einträge angezeigt werden).

### Befehle

```
npm install
npm run dev          # Entwicklungsserver
npm run typecheck
npm run lint
npm test             # Einheitstests
npm run build
npm run preview      # gebauten Stand ansehen
npm run test:e2e     # Playwright (einmalig: node node_modules/@playwright/test/cli.js install chromium)
npm run test:ki      # KI-Testsatz (ohne Anbieter: Hinweis; KI_ANBIETER=attrappe | bedrock)
npm run pruefe:bedrock  # nur lesend: Zielregionen, Aufbewahrung, Protokollierung (braucht Zugang)
```

## Tagesbereinigung (24.11.2026)

Entscheidung des Nutzers zur Löschfrist: Mit dem Start in den neuen Tag löscht die App alles
der Vortage außer offenen Aufgaben. Betten und die Angaben am Patienten bleiben.

### Regel

- **Wann:** bei jedem Entsperren (auch nach „PIN festlegen"), bevor der entsperrte Bereich
  erscheint – nie mitten in einer Bedienung. Ein Tageswechsel bei entsperrter App wirkt beim
  nächsten Entsperren. Am selben Tag ändert ein weiterer Lauf nichts (idempotent).
- **Tagesbeginn 04:00** (Entscheidung des Nutzers, 24.11.2026): Der „Tag" der App ist der
  Arbeitstag – der Kalendertag, vor 04:00 Ortszeit der Kalendertag davor (`arbeitstag` in
  `src/fachlich/tag.ts`, eine Konstante `TAGESBEGINN_STUNDE`). Gerechnet über die lokalen
  Datumsfelder, nicht „minus 4 Stunden", damit die Grenze auch an Tagen mit Zeitumstellung bei
  04:00 Ortszeit liegt. Er gilt überall, wo die App „heute" oder „Vortag" entscheidet:
  `heutigerTag` und `tagVonZeitpunkt` liefern den Arbeitstag (Tagesbereinigung,
  `patientAnsicht`, `Aufgabe.tag` und Übertrag, „heute erledigt", Fortsetzen einer offenen
  Eingabe, „heute übertragen" in der Übergabe). Reine Anzeige (`tagKurz`, `zeitpunktAnzeigen`)
  bleibt beim echten Kalenderdatum.
- **Gelöscht** wird, was vor dem heutigen Arbeitstag liegt: Eingaben nach `zeitpunkt` (auch der angefangene Diktat-Entwurf),
  Visiteneinträge und Verlaufsnotizen mit ihrer Eingabe, Aufgaben „Vorschlag", „erledigt",
  „verworfen". Beim ersten Lauf eines neuen Tages außerdem das angefangene Formular.
- **Es bleibt:** Patienten/Betten mit Kürzel und Name, offene Aufgaben jedes Tages (ihre
  `quelle` bleibt; der Verweis `eingabeId` zeigt dann ins Leere, die Oberfläche nutzt ihn
  dafür nicht), alles von heute.
- **Rückfrage:** Freigegebene, nicht übertragene Visiteneinträge der Vortage bleiben samt
  Eingabe stehen; nach dem Entsperren erscheint unten das Blatt „Noch nicht übergeben" mit der
  Zahl, „Erst übergeben" (→ „Übergabe senden") und „Jetzt löschen". Alles andere der Vortage
  ist zu dem Zeitpunkt schon gelöscht (auch Notiz und Vorschläge dieser Eingaben). Das Blatt
  kommt bei jedem Entsperren wieder, solange solche Einträge da sind; nach der Übergabe löscht
  sie der nächste Lauf. Ohne solche Einträge nur ein kurzer Hinweis oben (verschwindet nach
  10 s oder mit „OK").
- **Uhr:** Nur echtes „älter als heute"; Datensätze mit Datum in der Zukunft bleiben. Liegt
  heute vor dem Tag des letzten Laufs (Uhr zurückgestellt) oder ist das Datum ungültig, wird
  nichts gelöscht.
- **Unterbrechungssicher:** Lesen der Klartextfelder und Löschen in einer Dexie-Transaktion
  je Lauf; ein Abbruch hinterlässt den alten Stand, der nächste Lauf holt alles nach. Es wird
  nichts entschlüsselt; nicht lesbare Datensätze der Vortage werden über ihre Klartextfelder
  mitgelöscht.
- **Oberfläche:** „Patient" zeigt Einträge, Verlauf und Eingaben nur von heute (plus noch
  nicht übergebene) mit dem Satz „Einträge der Vortage werden beim Tageswechsel gelöscht. Der
  neue Tag beginnt um 4 Uhr." Aufgaben aller Tage wie bisher. Einstellungen → „Speicher": ein
  Satz zur Regel (mit „Der neue Tag beginnt um 4 Uhr."), kein Schalter. „Entlassen" und „Bett entfernen" unverändert.

Code: `src/speicher/tagesbereinigung.ts` (Plan und Lauf), `src/fachlich/patientansicht.ts`,
`src/oberflaeche/Tagesbereinigung.tsx`; Aufruf in `App.tsx` (`entsperrt`). Tests:
`tests/einheit/tagesbereinigung.test.ts` (gesteuerte Uhr), `tests/einheit/tagesbeginn.test.ts`
(Zeitzone Europe/Berlin: Grenze 03:59/04:00, Zeitumstellung März und Oktober, Diktat 23:30 →
Entsperren 01:00 bleibt / 04:01 gelöscht, Umstellungsfall), `tests/e2e/tagesbereinigung.spec.ts`
(feste Uhr im Browser, auch Entsperren um 01:30 ohne Löschen).

### Datenmodell

Neuer Meta-Eintrag `tagesbereinigung` (Klartext, nur
`{ letzterTag: "JJJJ-MM-TT", tagesbeginn: 4 }`). Keine neue Dexie-Version, keine neuen Felder
an den Datensätzen; gespeicherte Werte (`Aufgabe.tag` usw.) werden nicht umgeschrieben.

**Umstellungsfall:** Ein `letzterTag` ohne `tagesbeginn` (oder mit anderem Wert) stammt aus der
Zeit vor dem Tagesbeginn 04:00 und ist ein Kalendertag. Lief die Bereinigung damals zwischen
00:00 und 04:00, steht dort schon der neue Kalendertag, der nach heutiger Regel noch zum Vortag
gehört – der Uhr-Schutz würde fälschlich anschlagen. Ein solcher Wert wird daher als Vortag
gelesen (frühester möglicher Arbeitstag, `letztenTagLesen`) und beim nächsten Lauf im neuen
Format geschrieben. Das angefangene Formular wird in diesem Lauf nicht verworfen (sein Alter
ist nach der neuen Grenze unbekannt). Folge: Lief der alte Stand am Tag nach 04:00, gilt der
nächste Lauf noch vor 04:00 einmalig als erster Lauf des Tages (Aufgaben, die am Vortag
verworfen wurden, verschwinden dann wenige Stunden früher). Eine um mehr als einen Tag
zurückgestellte Uhr wird weiter erkannt.

### Annahmen

- Zuordnung der Aufgaben (beim ersten Lauf eines Tages): erledigt → Tag von `erledigtAm`
  (ältere ohne: späterer von `tag` und Tag der Eingabe); Vorschlag/verworfen → späterer von
  `tag` und Tag der Eingabe. Eine heute erledigte Aufgabe bleibt damit heute sichtbar.
- Weitere Läufe am selben Tag löschen Aufgaben nur zusammen mit ihrer Eingabe. So bleibt eine
  heute verworfene ältere Aufgabe (es gibt kein `verworfenAm`) bis zum nächsten Tag sichtbar.
- Datensätze ohne verwertbaren Zeitstempel bleiben stehen (Alter unbekannt); ebenso verwaiste
  Einträge ohne eigenes Datum. Verwaiste Einträge/Notizen (Eingabe fehlt) folgen ihrem eigenen
  Datum (`uebertragenAm`/`freigegebenAm` bzw. `datum`).
- Das angefangene Formular hat kein Datum: Es wird beim ersten Lauf eines neuen Tages
  verworfen, aber nur, wenn ein früherer Lauf bekannt ist.
- Scheitert die Bereinigung beim Entsperren (z. B. sofort wieder gesperrt), wird nichts
  gelöscht und die App trotzdem geöffnet; der nächste Lauf holt es nach.
- Im Playwright-Weg wird „übergeben" über den Klartext-Zeitstempel `uebertragenAm` vermerkt;
  die Übergabe selbst prüft `uebergabe.spec.ts`.

### Grenzen

- **Grenze 04:00 statt Mitternacht:** Wer über Mitternacht arbeitet, verliert beim Entsperren
  bis 03:59 nichts. Wer über 04:00 hinaus arbeitet (Nachtdienst bis morgens), hat dasselbe
  Problem wie vorher um Mitternacht: Beim ersten Entsperren ab 04:00 ist alles vor 04:00
  gelöscht (nicht übergebene freigegebene Einträge ausgenommen), auch ein angefangenes, noch
  nicht verarbeitetes Diktat.
- Was zwischen 00:00 und 03:59 diktiert, erledigt oder freigegeben wird, gehört zum Vortag; ein
  um 02:00 erledigter Haken ist ab 04:00 weg, ein um 02:00 angelegter Eintrag ebenso.
- Zeitumstellung: Die Grenze liegt immer bei 04:00 Ortszeit; der Arbeitstag ist an diesen Tagen
  23 bzw. 25 Stunden lang.
- `aktuellesJahr` für die Datumserkennung der Übergabe-Kennzeichnung kommt aus dem Arbeitstag
  (in der Neujahrsnacht bis 04:00 noch das alte Jahr); die Prüfansicht nutzt das
  Kalenderjahr. Nur Kennzeichnung, keine Löschung.
- Eine nach vorn verstellte Uhr (z. B. ein Jahr) löscht alles außer offenen Aufgaben; das ist
  nicht erkennbar. Die Rückfrage schützt nur freigegebene, nicht übertragene Einträge.
- Bei entsperrter App über 04:00 hinaus zeigt „Patient" nach dem Tageswechsel (spätestens bei
  Rückkehr in den Vordergrund) die Einträge des Vortags nicht mehr, obwohl sie bis zum nächsten
  Entsperren noch gespeichert sind.
