# Prüfung am iPhone und am Klinik-PC – Liste zum Abhaken

Stand: 24.11.2026 (Phase 6). Eine Liste für alles, was nur am Gerät, mit Konto oder am
Klinik-PC prüfbar ist (gesammelt aus `docs/stand.md`, `docs/ios-pruefung.md`,
`docs/uebergabe.md`, `docs/serverfunktion.md`). Reihenfolge wie im Alltag.

**Nur erfundene Daten verwenden** (z. B. Bett „90-1", Name „Muster, Erika", Diktat „Erfunden:
Ramipril umstellen."). Kein echter Bettenplan, keine echten Namen, keine Fotos von Patienten.

Je Punkt: **Tun** · **Erwartet** · **Bei Abweichung notieren**. Abhaken mit `[x]`.
Vorab notieren: iPhone-Modell, iOS-Version, Datum, App-Adresse.

## 1. Installieren

- [ ] **Tun:** App-Adresse in Safari öffnen, „Teilen → Zum Home-Bildschirm" (iOS 26: „Als
      Web-App öffnen" an). Über das Symbol starten.
      **Erwartet:** Vollbild ohne Safari-Leiste, dunkles Thema, „PIN festlegen".
      **Notieren:** ob Safari-Leiste sichtbar, Bildschirmfoto der Startseite.
- [ ] **Tun:** Dieselbe Adresse zusätzlich in Safari öffnen.
      **Erwartet:** Eigener, leerer Speicher (PIN festlegen erscheint erneut).
      **Notieren:** ob Daten geteilt werden.
- [ ] **Tun:** Flugmodus an, App vom Symbol starten.
      **Erwartet:** App startet offline (Sperre bzw. PIN festlegen).
      **Notieren:** Fehlermeldung, leerer Bildschirm.

## 2. PIN und Speicher

- [ ] **Tun:** PIN festlegen (Ziffernfeld unten), Einstellungen → „Dauerhaft gespeichert".
      **Erwartet:** Anzeige „Ja" (nach `persist()`).
      **Notieren:** angezeigter Wert.
- [ ] **Tun:** 5× falsche PIN, dann richtige.
      **Erwartet:** Ab dem 5. Fehlversuch „Zu viele Fehlversuche. Nächster Versuch in 30 s",
      Ziffernfeld gesperrt; auch nach Schließen und Neustart der App. Nach Ablauf entsperrt die
      richtige PIN; danach keine Wartezeit mehr.
      **Notieren:** Restzeit nach Neustart.
- [ ] **Tun:** Einstellungen → „PIN ändern" (Ziffernfeld unten: bisherige, neue, wiederholen).
      **Erwartet:** Kein Angebot des Schlüsselbunds/„Passwort sichern"; „PIN geändert".
      **Notieren:** jedes Schlüsselbund-Angebot.
- [ ] **Tun:** Einstellungen → Zugangscode eintippen (erfundener Testcode).
      **Erwartet:** Anzeige verdeckt, kein Passwort-Angebot, kein Vorschlag der Tastatur.
      **Notieren:** Abweichungen.
- [ ] **Tun:** Während „Wird geprüft …" (Entsperren) sofort die App wechseln.
      **Erwartet:** Nach Rückkehr weiterhin gesperrt („Entsperren unterbrochen").
      **Notieren:** ob ohne PIN entsperrt.
- [ ] **Tun:** Symbol entfernen, neu installieren (nur mit Testdaten!).
      **Erwartet laut Recherche:** Daten können weg sein (nicht belegt).
      **Notieren:** Daten weg ja/nein.

## 3. Station, Formulare, Bettenplan

- [ ] **Tun:** „Station einrichten" (Zimmer 1–3), „Bett anlegen" mit einer Hand.
      **Erwartet:** Alle Hauptknöpfe und „Schließen" im unteren Drittel erreichbar.
      **Notieren:** Stellen, an denen nach oben gegriffen werden muss.
- [ ] **Tun:** „Bett anlegen", etwas tippen, Sperrtaste drücken, entsperren.
      **Erwartet:** Blatt wieder offen, Text erhalten (ebenso Aufgabe anlegen/ändern, Bett
      ändern, Station einrichten).
      **Notieren:** verlorene Eingaben.
- [ ] **Tun:** Bettenplan: in das Textfeld tippen → „Text scannen" (falls angeboten) auf einen
      **selbst geschriebenen erfundenen** Plan halten.
      **Erwartet:** Text erscheint; Umlaute, Komma, Bindestrich korrekt; zeilenweise.
      **Notieren:** ob „Text scannen" angeboten wird (Web-App und Safari), Fehlzeichen bei ♀/♂
      und Kästchen, Zeilenfolge, ob ein Foto in der Mediathek landet.
- [ ] **Tun:** Text aus dem Plan kopieren und einfügen; danach Zwischenablage prüfen.
      **Erwartet:** Hinweis der App, die Zwischenablage nicht mit Namen liegen zu lassen.
      **Notieren:** ob die Zwischenablage auf andere Geräte (iCloud) übergeht.
- [ ] **Tun:** Bettenplan lesen und übernehmen im Flugmodus.
      **Erwartet:** Funktioniert ohne Netz.

## 4. Diktat

- [ ] **Tun:** Bett antippen.
      **Erwartet:** Textfeld im Fokus, **Tastatur offen** mit höchstens einem weiteren Tipp.
      **Notieren:** Zahl der nötigen Tipps.
- [ ] **Tun:** Mikrofontaste der Tastatur, erfundenes Diktat mit „Frau Muster" und „Tel. 0221
      1234567".
      **Erwartet:** Text erscheint; Hinweis zu Namen ohne gespeicherten Namen; in der Vorschau
      des gesendeten Texts Name und Nummer ersetzt.
      **Notieren:** was nicht ersetzt wurde.
- [ ] **Tun:** Bei offener Tastatur „Verarbeiten" erreichen.
      **Erwartet:** Knopf bleibt über der Tastatur sichtbar (`visualViewport`).
      **Notieren:** ob verdeckt.

## 5. Sperre und App-Wechsel

- [ ] **Tun:** Mitten im Diktat App wechseln (Home, App-Umschalter, Sperrtaste) für 5 s,
      2 min, 10 min, 1 h; zurückkehren.
      **Erwartet:** Gesperrt; nach PIN derselbe Bildschirm, derselbe Text (höchstens das
      letzte Zeichen fehlt).
      **Notieren:** verlorener Text, ob die Seite neu geladen wurde, ob `visibilitychange`
      sichtbar wirkte.
- [ ] **Tun:** App-Umschalter öffnen und Vorschaubild ansehen.
      **Erwartet:** Kein Patienteninhalt im Vorschaubild.
      **Notieren:** sichtbarer Inhalt.
- [ ] **Tun:** 2 Minuten nichts tun.
      **Erwartet:** Sperre (spätestens beim nächsten Antippen).
- [ ] **Tun:** Uhrzeit des iPhones zurückstellen (Einstellungen → Datum & Uhrzeit, manuell).
      **Erwartet:** Sofort gesperrt; offene Aufgaben bleiben sichtbar.
- [ ] **Tun:** Tagesbereinigung (der Tag beginnt um 4 Uhr): am Abend erfundene Einträge
      freigeben, einen davon nicht übergeben; nach Mitternacht (z. B. 01:00) entsperren; am
      Morgen nach 04:00 (echter Tageswechsel, Uhr nicht verstellen) erneut entsperren.
      **Erwartet:** Um 01:00 ist noch alles da, keine Rückfrage. Nach 04:00 Blatt „Noch nicht
      übergeben" unten mit „Erst übergeben"/„Jetzt löschen"; alles andere des Vortags gelöscht,
      offene Aufgaben mit „offen seit …" oben; Betten, Kürzel und Namen unverändert. Ohne offene
      Übergabe nur der kurze Hinweis oben.
      **Notieren:** ob die Bereinigung erst beim Entsperren kam (nicht mitten in der Bedienung),
      verlorene offene Aufgaben, Verhalten bei einem Dienst über 04:00 hinaus.
- [ ] **Tun:** Neue App-Version bereitstellen lassen, während die App offen ist.
      **Erwartet:** Hinweis „Neue Version ist bereit"; Übernahme erst beim Sperren oder nach
      „Jetzt aktualisieren"; kein Neuladen mitten in der Eingabe.

## 6. KI (erst nach Einrichtung laut `docs/serverfunktion.md`)

- [ ] **Tun:** Erfundenes Diktat verarbeiten; Vorschau „So wurde der Text gesendet" ansehen.
      **Erwartet:** Nur Platzhalter statt Namen; Entwurf, Aufgaben, Rückfragen.
- [ ] **Tun:** Während „Wird verarbeitet …" sperren.
      **Erwartet:** Abbruch, kein zweiter Versuch; danach erneut verarbeitbar, nichts halb
      gespeichert.
- [ ] **Tun:** Während der Verarbeitung zur Eingabe zurück.
      **Erwartet:** Text nicht änderbar mit Hinweis; Prüfansicht gesperrt, bis fertig.
- [ ] **Tun:** Flugmodus während des Sendens.
      **Erwartet:** „Kein Netz … wartet"; später „Jetzt verarbeiten".
- [ ] **Mit Konto prüfen** (siehe `docs/serverfunktion.md`, „Was erst mit Konto …"):
      Freischaltung der Modelle in `eu-central-1`, IAM-Richtlinie, Aufbewahrung `none`,
      Zielregionen per `GetInferenceProfile`, echte Antworten und Testsatz (Haiku, Sonnet),
      Supabase `SB_REGION`, `forceFunctionRegion`, JWT-Prüfung, Plattform-Protokolle.

## 7. Übergabe am Klinik-PC (erst nach Einrichtung laut `docs/uebergabe.md`)

- [ ] **Tun:** Am Klinik-PC die Übergabe-Seite öffnen.
      **Erwartet:** QR-Code und Code; keine Fehlermeldung zur Inhaltsrichtlinie; Verbindung
      zum Kanal (kein „Keine Verbindung" hinter Proxy/Firewall).
      **Notieren:** Browser und Version, Fehlermeldungen.
- [ ] **Tun:** Am iPhone „QR-Code scannen".
      **Erwartet:** Kamerafrage (ggf. bei jedem Start erneut, bekannt); QR vom Bildschirm
      lesbar; Kamera stoppt nach dem Erkennen und bei Sperre.
      **Notieren:** ob BarcodeDetector oder Ersatz genutzt wird (Dauer bis zum Erkennen).
- [ ] **Tun:** Code-Weg: Code eintippen, Zahl auf beiden Geräten vergleichen, **erst am
      iPhone, dann am PC** „Zahl stimmt".
      **Erwartet:** Einträge erst nach beiden Bestätigungen; je Eintrag „Empfangen über …".
- [ ] **Tun:** „Kopieren" am PC, in die Kliniksoftware einfügen.
      **Erwartet:** Text vollständig, Umlaute und Zeilenumbrüche erhalten.
      **Notieren:** Abweichungen beim Einfügen.
- [ ] **Tun:** 5 Minuten nichts tun.
      **Erwartet:** Seite leer, „Neue Sitzung".
- [ ] **Tun:** Am iPhone während des Sendens sperren.
      **Erwartet:** Nichts halb als übertragen vermerkt; erneutes Senden möglich.
