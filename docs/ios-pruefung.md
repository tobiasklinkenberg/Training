# iOS-Prüfung (Zielgerät iPhone, Web-App auf dem Home-Bildschirm)

Stand: 22.11.2026. Grundlage: Recherche in Dokumentation von WebKit, MDN und im WebKit-Bugtracker. iPhone-Modell und iOS-Version waren bei der Recherche offen (entschieden am 24.11.2026: iPhone 12 Pro oder neuer, aktuelle iOS-Version); Aussagen gelten daher für „iOS 17 bis iOS 26" und nennen Unterschiede, wo belegt. Was nicht belegt werden konnte, ist ausdrücklich so gekennzeichnet.

Zeitliche Einordnung: Aktuell ist Safari/iOS 26 (Safari 26.0 am 15.09.2025, zuletzt gefunden: Safari 26.6). Eine Wirkung einzelner Punkte auf ältere iOS-Versionen ist unten vermerkt.

---

## 1. IndexedDB, `navigator.storage.persist()` und Entfernen des Symbols

### Ergebnis
- Eine Web-App vom Home-Bildschirm hat dieselben Speichergrenzen wie Safari (pro Ursprung bis ca. 60 % des Speicherplatzes, gesamt bis ca. 80 %; seit Safari 17). Platzmangel ist für diese App kein Thema.
- Daten in IndexedDB sind standardmäßig „best effort" und können von iOS entfernt werden (Speicherdruck, zu hohes Gesamtkontingent, lange Nichtnutzung; ältester Ursprung zuerst).
- `navigator.storage.persist()` existiert und schützt vor dieser Entfernung. WebKit entscheidet automatisch ohne Nachfrage anhand von Heuristiken; als Heuristik wird ausdrücklich genannt, ob die Seite als Home-Bildschirm-Web-App geöffnet wird. Eine Garantie ist das nicht, deshalb `persisted()` nach dem Aufruf prüfen.
- Die 7-Tage-Löschung von Safari (ITP) gilt für die Domain einer Home-Bildschirm-Web-App nicht. Dort liegt der Speicher getrennt von Safari.
- Seit iOS 26 wird jede zum Home-Bildschirm hinzugefügte Seite standardmäßig als Web-App geöffnet (Schalter „Als Web-App öffnen" abschaltbar). Ein Manifest ist nicht mehr nötig. Bis iOS 25 war das Verhalten manifestabhängig.
- Speicher von Safari und Web-App sind getrennt (Safari-Daten tauchen in der Web-App nicht auf).
- **Entfernen des Symbols:** Dazu fand sich in den geprüften WebKit-/MDN-Quellen keine Aussage. Es ist nicht belegt, was mit den Daten passiert. Bei Web-Apps ist anzunehmen, dass die Daten mit der App verschwinden; das ist eine Annahme und nicht belegt.
- Hinweis zur EU: Die für iOS 17.4 angekündigte Abschaltung von Home-Bildschirm-Web-Apps in der EU wurde laut Presseberichten (MacRumors, 01.03.2024) vor Auslieferung zurückgenommen. Sekundärquelle, keine Apple-Seite direkt gelesen.

### Folge für die App
- Beim ersten Start `navigator.storage.persist()` aufrufen, Ergebnis mit `persisted()` prüfen und in den Einstellungen anzeigen („Speicher geschützt: ja/nein").
- Entfernen des Symbols, Neuinstallation oder iOS-Aufräumen als möglichen Totalverlust behandeln. Da es keinen Server und kein Konto gibt (Grundprinzip 5), braucht es einen manuellen Weg zur Sicherung: Export einer verschlüsselten Datei (gleiche PIN) und Import. Das ist eine Umsetzungsentscheidung für Phase 1/2, noch nicht beschlossen.
- Offene Aufgaben nicht als einzige Kopie betrachten; Hinweis in den Einstellungen: „Symbol entfernen kann Daten löschen" (bis zur Prüfung am Gerät vorsorglich).
- Daten in Safari angelegt und später als Web-App geöffnet gehen nicht automatisch mit: erst als Web-App installieren, dann einrichten.

### Quelle
- „Updates to Storage Policy" (WebKit-Blog, 10.08.2023): https://webkit.org/blog/14403/updates-to-storage-policy/
- „Tracking Prevention in WebKit" (webkit.org, ohne Datumsangabe auf der Seite): https://webkit.org/tracking-prevention/
- „WebKit Features in Safari 26.0" (WebKit-Blog, 15.09.2025): https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- „Storage quotas and eviction criteria" (MDN, zuletzt geändert 05.01.2026): https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- EU-Hinweis (Sekundärquelle): https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/

### Sicherheit der Aussage
Quotas, Eviction, `persist()`-Heuristik, 7-Tage-Ausnahme: belegt (Stand der WebKit-Seiten 2023; spätere Änderungen in den Safari-26-Notizen nicht gefunden, aber nicht lückenlos geprüft: teilweise belegt für iOS 26). Verhalten beim Entfernen des Symbols: **nicht belegt**.

---

## 2. Kamera in der installierten Web-App (QR-Scan)

### Ergebnis
- `getUserMedia` ist in Home-Bildschirm-Web-Apps grundsätzlich nutzbar (frühere Lücke in iOS 11/12 ist alt; Meldungen aus 2019 zu iOS 13-Betas). Quelle dafür sind WebKit-Bugs, keine aktuelle Dokumentation.
- Die Kameraerlaubnis wird in der installierten Web-App nicht zuverlässig gespeichert: WebKit-Bug 280394 (gemeldet 24.09.2024, Status NEW, zuletzt geändert 08.07.2026) beschreibt, dass die Abfrage bei jedem Start erneut erscheint und keine Option „Immer erlauben" besteht. Kommentare von 2026 berichten, dass dies ab etwa iOS 26.3.1 wieder auftritt (in 26.2 blieb die Erlaubnis erhalten) und dass die Abfrage erneut kommt, wenn der Kamerastrom beim Bildschirmsperren noch offen war.
- `BarcodeDetector` ist laut MDN „limited availability, experimental"; Safari-Unterstützung konnte nicht bestätigt werden (Kompatibilitätstabelle nicht lesbar). Für den QR-Scan ist daher eine JavaScript-Bibliothek (Dekodierung aus Videobild) einzuplanen; nicht belegt, ob es unter Safari nativ geht.
- Beim Eintippen-Weg (Abschnitt 8 der CLAUDE.md) gibt es keine Kameraabhängigkeit; er bleibt als vollwertiger Ersatz nötig.

### Folge für die App
- Kamera nur auf dem Bildschirm „Übergabe senden" öffnen, Strom sofort mit `track.stop()` beenden, sobald ein Code erkannt wurde, und bei `visibilitychange` (hidden) und Sperre beenden (vermeidet die erneute Abfrage).
- Erlaubnisabfrage beim jeweiligen Scan einplanen; Fehler (`NotAllowedError`) zeigt Hinweis und bietet die Code-Eingabe an.
- QR-Dekodierung per Bibliothek, mit Feature-Erkennung für `BarcodeDetector`. Bibliothek nicht ausgewählt (nicht Teil dieser Prüfung).
- Kein Einfluss auf PIN-Sperre und Speicher.

### Quelle
- WebKit Bugzilla 280394, „Persist permissions for getUserMedia" (zuletzt geändert 08.07.2026): https://bugs.webkit.org/show_bug.cgi?id=280394
- WebKit Bugzilla 215884, wiederholte Abfragen im Standalone-Modus (Altmeldung): https://bugs.webkit.org/show_bug.cgi?id=215884
- „BarcodeDetector" (MDN, zuletzt geändert 11.06.2026): https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
- „WebKit Features for Safari 26.5" (WebKit-Blog, 11.05.2026): Kamera-Korrektur betrifft nur Google Meet: https://webkit.org/blog/17938/webkit-features-for-safari-26-5/

### Sicherheit der Aussage
Kamera grundsätzlich nutzbar: teilweise belegt (nur Bugtracker, keine Doku). Wiederholte Abfrage: belegt als offener Fehler, Wirkung auf konkrete iOS-Version nicht geprüft. `BarcodeDetector` unter Safari: **nicht belegt**.

---

## 3. Zwischenablage, Bildschirmsperre, App-Wechsel

### Ergebnis
- **Zwischenablage (Schreiben):** `navigator.clipboard.writeText` ist in Safari nur im sicheren Kontext (HTTPS) und mit kurz zuvor erfolgter Nutzeraktion (Tippen) möglich. Das passt zu einem „Kopieren"-Button. Die Berechtigungen `clipboard-read`/`clipboard-write` unterstützt Safari nicht (laut MDN auch nicht geplant). Zwischenablage-Lesen löst ein Menü „Einsetzen" aus; für die App nicht nötig. Quelle MDN, 20.10.2026. Die „Kopieren"-Funktion liegt auf dem PC (Übergabe-Seite, Abschnitt 8), nicht auf dem iPhone; auf dem iPhone relevant nur, falls dort ebenfalls kopiert wird.
- **Bildschirm wach halten:** Die Screen Wake Lock API ist laut MDN „Baseline 2025" (Seite zuletzt geändert 12.11.2026); die Sperre wird beim Verbergen der Seite automatisch freigegeben und muss neu angefordert werden. Safari-spezifische Aussagen zu installierten Web-Apps wurden in der Quelle nicht gefunden. Eine Quelle von WebKit nannte Wake Lock für Web-Apps seit iOS 16.4 (WebKit-Blog 16.02.2023, in der Beta-Ankündigung).
- **Sperre/Hintergrund:** JavaScript im Hintergrund ist nicht zuverlässig lauffähig. `pagehide`/`unload` feuern auf Mobilgeräten nicht zuverlässig (MDN); `visibilitychange` ist das empfohlene Signal. Laut WebKit-Bug (iOS 13.4.1, später als behoben gemeldet) feuert auch `visibilitychange` nicht, wenn die App beendet wird. Ein Zurückladen der Seite nach längerem Hintergrund ist aus der Recherche weder belegt noch widerlegt (Quellen alt, iOS 11 bis 15).
- Timer (zum Beispiel die 2-Minuten-Inaktivität) laufen im Hintergrund nicht verlässlich weiter.

### Folge für die App
- Sperre beim Wechsel in den Hintergrund: bei `visibilitychange` → `hidden` den Schlüssel sofort verwerfen (das deckt die Vorgabe der CLAUDE.md ab). Nicht auf `pagehide`/`beforeunload` verlassen.
- Beim Zurückkehren (`visible`) die abgelaufene Zeit mit `Date.now()` gegen den letzten Aktivitätszeitpunkt prüfen, statt sich auf laufende Timer zu verlassen; Sperre erzwingen, wenn die Frist überschritten ist.
- Nach Rückkehr kann die Seite neu geladen sein: Zustand (Bett, Eingabeentwurf) laufend lokal sichern (Grundprinzip 7). Da der Schlüssel nur im Arbeitsspeicher liegt, muss jeder Entwurf im laufenden Tippen **verschlüsselt** gespeichert werden können; nach Verwerfen des Schlüssels fehlt dafür der Schlüssel. Konsequenz für Phase 1: Entwurfstext vor dem Sperren (bei `hidden`) noch verschlüsselt wegschreiben, bevor der Schlüssel verworfen wird; Reihenfolge ist wichtig und zu testen.
- Zwischenablage: „Kopieren" nur aus Tipp-Ereignis auslösen, keine Abhängigkeit von Berechtigungen.
- Wake Lock optional; kein Pflichtbestandteil.

### Quelle
- „Clipboard API" (MDN, zuletzt geändert 20.10.2026): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- „Screen Wake Lock API" (MDN, zuletzt geändert 12.11.2026): https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- „Web Push for Web Apps on iOS and iPadOS" (WebKit-Blog, 16.02.2023), nennt Screen Wake Lock für Web-Apps: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- „Window: pagehide event" (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
- WebKit Bugzilla 202399 (Lebenszyklus-Ereignisse, ältere Meldung): https://bugs.webkit.org/show_bug.cgi?id=202399

### Sicherheit der Aussage
Zwischenablage: belegt. Wake Lock in installierter Web-App unter aktuellem iOS: teilweise belegt. Verhalten von Hintergrund, Sperre und Seitenneuladen: teilweise belegt (nur allgemeine Ereignis-Doku und alte Bugs; keine aktuelle Zusicherung von Apple gefunden).

---

## 4. Face ID über WebAuthn (nur Stufe 2)

### Ergebnis
- WebAuthn ist laut MDN seit September 2021 „widely available"; eine Prüfung auf biometrische Plattform-Authentifizierung ist per `PublicKeyCredential.getClientCapabilities()` (`userVerifyingPlatformAuthenticator`) möglich. Eine Safari-spezifische Aussage zu Face ID enthält die gelesene MDN-Seite nicht (Seite zuletzt geändert 27.10.2026).
- Ob WebAuthn mit Face ID in einer Home-Bildschirm-Web-App funktioniert: **nicht belegt.** Ein Apple-Forenbeitrag (Februar 2026, iOS 18.6.2, ohne Apple-Antwort) berichtet von Fehlern bei Passkey-Anmeldung aus Home-Bildschirm-Verknüpfungen (doppelte Abfrage, hängende Anmeldung); der Autor schreibt, es könne auch im normalen Safari auftreten.
- Ein Passkey ist ein Anmeldenachweis, kein Schlüsselspeicher. Er entsperrt allein keine lokalen Daten. Um daraus den Datenschlüssel zu gewinnen, bräuchte es die PRF-Erweiterung. Deren Unterstützung ist für Safari 18/iOS 18 in Foren und Dritt-Artikeln mit Teilfehlern beschrieben (Cross-Device-Fluss, Fehlermeldung `true` trotz fehlender hmac-secret-Unterstützung), ohne dass eine Apple-Dokumentation dazu gefunden wurde. Für Web-Apps im Standalone-Modus: **nicht belegt.**

### Folge für die App
- PIN bleibt die alleinige Grundlage (wie in der CLAUDE.md). Der Datenschlüssel kommt ausschließlich aus der PIN (PBKDF2).
- Face ID wäre in Stufe 2 nur als Komfort denkbar und müsste den Schlüssel anders sichern (PRF oder ein zusätzlich verschlüsselt abgelegter Schlüssel). Ein bloßes „WebAuthn erfolgreich → entsperren" wäre kein Schutz der verschlüsselten Daten und darf nicht gebaut werden. Entscheidung bleibt für Stufe 2; erst nach Test am Gerät.
- Kein Einfluss auf Phase 1, außer: Schlüsselableitung so kapseln, dass ein zweiter Entsperrweg später ergänzt werden kann (nur Hinweis, keine Vorarbeit nötig).

### Quelle
- „Web Authentication API" (MDN, zuletzt geändert 27.10.2026): https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
- Apple Developer Forums, „Passkey authentication issues on iPhone when launching login pages via Home Screen shortcuts" (Februar 2026): https://developer.apple.com/forums/thread/815784
- Apple Developer Forums, „PRF Extension Not Supported in Safari's Cross-Device WebAuthn Flow": https://developer.apple.com/forums/thread/774112
- Apple Developer Forums, „WebAuthn PRF extension reports true despite no hmac-secret authenticator extension": https://developer.apple.com/forums/thread/782466

### Sicherheit der Aussage
WebAuthn allgemein: belegt. Face ID in installierter Web-App: **nicht belegt**. PRF in Safari: teilweise belegt (nur Foren/Dritt-Quellen, keine Apple- oder WebKit-Dokumentation gelesen).

---

## Am Gerät zu prüfen
1. Nach „Zum Home-Bildschirm" prüfen, dass die App im Standalone-Modus läuft (iOS 26: Schalter „Als Web-App öffnen" an).
2. `persisted()` nach `persist()` abfragen und anzeigen; Wert merken.
3. Symbol entfernen, neu installieren: Sind die Daten weg? (mit Testdaten; Kernfrage aus Abschnitt 1, nicht belegt).
4. Gleiche Seite in Safari und als Web-App öffnen: bestätigen, dass der Speicher getrennt ist.
5. Kamera in der installierten App: Abfrage beim ersten Scan; nach Schließen und Neustart erneut? Nach Bildschirmsperre mit offenem Kamerastrom erneut? Läuft `BarcodeDetector` oder muss eine Bibliothek ran?
6. App in den Hintergrund legen (Home, App-Wechsel, Sperrtaste) für 5 s, 2 min, 10 min, 1 h: Wird die Seite neu geladen? Feuert `visibilitychange`? Bleibt der Entwurf erhalten? Ist die Sperre korrekt?
7. Reihenfolge testen: Entwurf verschlüsselt wegschreiben, dann Schlüssel verwerfen, beim App-Wechsel in unter 1 s.
8. `navigator.clipboard.writeText` aus Tipp-Ereignis auf dem iPhone (falls dort verwendet).
9. Wake Lock in der installierten App (falls gewünscht), inklusive erneutem Anfordern nach App-Wechsel.
10. Stufe 2: WebAuthn mit Face ID in der installierten App (Registrieren, Anmelden, nach Neustart), `getClientCapabilities()`, und PRF-Ausgabe.
11. Prüfen auf der tatsächlichen iOS-Version, da Fehler 280394 laut Kommentaren versionsabhängig ist (26.2 ohne, ab etwa 26.3.1 mit erneuter Abfrage; Angabe eines einzelnen Nutzers).

---

## 5. Texterkennung (Live Text / „Text scannen") für den Bettenplan

Nachtrag vom 24.11.2026. Anlass: Betten und Kürzel sollen aus einem ausgedruckten Bettenplan (Tabelle mit Zimmerüberschriften, Zeilen „Bettnummer Nachname, Vorname Abteilungskürzel", dazu Kästchen und Symbole) übernommen werden. Namen dürfen das iPhone nicht verlassen; die Erkennung muss auf dem Gerät laufen. Hinweis: Apples Support-Seiten führen inzwischen auch iOS 27 in der Versionsauswahl; die Quellen unten decken iOS 15 bis 26 ab.

### Ergebnis

**5.1 „Text scannen" im Textfeld einer Webseite**
- Apple dokumentiert „Scan Text" (Kamera-Symbol, dann Text scannen, Auswahl, Einfügen) für die Notizen-App: ab iOS 15.4, nur auf unterstützten Modellen und in unterstützten Sprachen. Live Text in der Kamera: iPhone XS/XR oder neuer (A12 oder neuer), iOS 15 oder neuer.
- Ob dieselbe Funktion in einem beliebigen Textfeld einer Webseite erscheint, belegt keine der gelesenen Apple-Seiten. Nur ein Drittanbieter-Artikel (Gadget Hacks, ohne Datum, iOS 15) beschreibt: Textfeld lange drücken, Live-Text-Symbol tippen, die Tastatur wird durch den Kamerasucher ersetzt, Text auswählen, „Einfügen"; er nennt das Safari-Suchfeld ausdrücklich. Das ist keine Apple-Aussage.
- Für die installierte Web-App: **nicht belegt.**
- Deutsch: Die Apple-Seite „Feature Availability" führt im Abschnitt Live Text „German" in der Sprachliste (automatisch ausgewertet, die Seite war lang; am Gerät gegenprüfen). Apples Anleitungsseiten selbst nennen keine Sprachen.

**5.2 Auf dem Gerät oder Bilddaten an Apple?**
- Eine Apple-Aussage dazu wurde **nicht gefunden.** Ein Drittanbieter-Artikel (Eclectic Light, 29.03.2022, Bezug macOS) sagt: Live Text lädt keine Daten auf Server hoch.

**5.3 Wird ein Foto gespeichert? Vergleich Kamera-App mit Kopieren und Einfügen**
- Die gelesene Apple-Seite zu „Scan Text" sagt nichts dazu, ob ein Foto gespeichert wird. **Nicht belegt.** Für Live Text in der Kamera-App beschreibt Apple Auswahl und „Kopieren", aber nicht, was gespeichert bleibt. Der kopierte Text liegt in der Zwischenablage, bis er überschrieben wird; ob er auf andere Geräte der Person synchronisiert wird, wurde nicht geprüft.

**5.4 Kann eine Webseite die Funktion anstoßen oder beeinflussen?**
- Es wurde **keine** Schnittstelle und kein Attribut gefunden. „Es gibt keine" ist damit nicht belegt (die Suche war nicht gezielt auf die WebKit-Attribut-Liste). Bis zum Gegenbeweis: Nur der Nutzer löst es aus (Menü beim langen Drücken oder Tastatur).

**5.5 Texterkennung in Safari/WebKit (Shape Detection, `TextDetector`)**
- Es gibt keine offizielle WebKit-Aussage, dass Safari `TextDetector` oder `BarcodeDetector` ausliefert. WebKit-Bug 198174 und 281848 sowie ein Apple-Forenthread berichten nur von einem Feature-Schalter; unter iOS 18 war die Schnittstelle laut Meldungen defekt. Zu `TextDetector` fand sich bei WebKit nichts. Für Safari auf iOS: **nicht nutzbar.**

**5.6 Rückfallweg: Foto in der App, Erkennung auf dem Gerät**
- `<input type="file" accept="image/*" capture="environment">` öffnet laut MDN (20.04.2026) die Kamera; Safari-Unterstützung auf iOS ist aus den gelesenen Quellen **nicht belegt** (Kompatibilitätstabelle nicht lesbar).
- Tesseract.js (Apache-2.0) läuft im Browser per WebAssembly und kann offline laufen, wenn `workerPath`, `corePath` und `langPath` selbst gehostet werden; Sprachdateien werden als `.traineddata.gz` erwartet. Deutsche Daten laut Hugging-Face-Spiegeln ca. 1,5 MB (fast) und ca. 8,6 MB (best). Größe der WASM-Kerndateien nicht ermittelt.
- Gedruckte Tabellen: Die Tesseract-Doku nennt Tabellen ohne eigene Segmentierung als bekanntes Problem; Rahmen und Linien stören; gute Ergebnisse brauchen gerade, scharfe Bilder (ca. 300 DPI). Messwerte für Bettenpläne gibt es nicht. Ob Kästchen und Symbole Fehlzeichen erzeugen, ist nicht belegt.

### Folge für die App
- Die Erkennung bleibt außerhalb der App: Die App bietet ein großes Textfeld „Bettenplan einfügen" an (normales Textfeld, keine eigene Kamera). Der Nutzer füllt es über die iOS-Funktion (Text scannen, oder Kamera-App, Kopieren, Einfügen). Das braucht in der App keine Erkennungsbibliothek, sofern es am Gerät funktioniert.
- Die App liest den eingefügten Text mit einem festen Muster (Bettnummer, Name, Kürzel), zeigt das Ergebnis als **Liste zur Bestätigung** und legt erst nach Freigabe Patienten an. Nicht passende Zeilen werden markiert, nicht geraten. Namen bleiben lokal (Option „Namenstabelle"); kein Netz, kein Server.
- Der eingefügte Rohtext wird nach der Übernahme nicht aufbewahrt; Hinweis, die Zwischenablage nicht mit Namen liegen zu lassen.
- Eigene Aufnahme mit Tesseract.js nur, wenn der iOS-Weg nicht trägt; dann Sprachdaten und Kerndateien selbst bündeln und im Service Worker cachen. Erwartung: geringere Trefferquote bei Tabellen mit Kästchen; die Prüfliste bleibt Pflicht. Für Phase 1 nicht nötig (Betten können per Hand angelegt werden).
- Kein Einfluss auf PIN-Sperre und Verschlüsselung in Phase 1.

### Quelle
- „Use Live Text with your iPhone camera" (Apple Support, ohne Datum auf der Seite): https://support.apple.com/guide/iphone/use-live-text-iphcf0b71b0e/ios
- „Copy and translate text from photos on your iPhone or iPad" (Apple Support, 01.05.2026): https://support.apple.com/en-us/120004
- „Scan text" im iPhone-Benutzerhandbuch iOS 15 (Apple Support, ohne Datum): https://support.apple.com/en-kg/guide/iphone/scan-text-and-documents-iph653f28965/15.0
- „iOS and iPadOS Feature Availability" (Apple, ohne Datum): https://www.apple.com/ios/feature-availability/
- Gadget Hacks, „Enter text from real world into any search field" (iOS 15, ohne Datum, Drittanbieter): https://ios.gadgethacks.com/how-to/enter-text-from-real-world-into-any-search-field-ios-15-0384737/
- Eclectic Light, „Live Text, Visual Look Up, Face Recognition, ML and Privacy" (29.03.2022, Drittanbieter): https://eclecticlight.co/2022/03/29/live-text-visual-look-up-face-recognition-ml-and-privacy/
- WebKit Bugzilla 198174: https://bugs.webkit.org/show_bug.cgi?id=198174 ; 281848: https://bugs.webkit.org/show_bug.cgi?id=281848 ; Apple-Forum: https://developer.apple.com/forums/thread/767761
- „capture" (MDN, 20.04.2026): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
- Tesseract.js, Local Installation: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- Tesseract, „Improving the quality of the output" (tessdoc, ohne Datum): https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
- Tessdata fast, deu (Hugging-Face-Spiegel): https://huggingface.co/lm-kit/tessdata-fast/blob/main/deu.traineddata ; best: https://huggingface.co/lm-kit/tessdata-best/blob/main/deu.traineddata

### Sicherheit der Aussage
- 5.1: teilweise belegt (Notizen-App belegt; Textfeld einer Webseite nur Drittanbieter; installierte Web-App nicht belegt; Deutsch teilweise belegt).
- 5.2: von Apple nicht belegt, nur Drittanbieter.
- 5.3: nicht belegt.
- 5.4: nicht belegt (nichts gefunden, nicht gezielt ausgeschlossen).
- 5.5: teilweise belegt (Bugtracker und Foren, keine offizielle Aussage).
- 5.6: Tesseract offline und Größen teilweise belegt; Tabelleneignung teilweise belegt (Doku nennt Problem, keine Messung); `capture` auf iOS nicht belegt.

### Am Gerät zu prüfen (zu Abschnitt 5)
1. Im Textfeld der installierten Web-App lange drücken: Erscheint „Text scannen" bzw. das Live-Text-Symbol? Gleiches in Safari zum Vergleich. iOS-Version und Modell notieren.
2. Deutsch: Werden Umlaute und Namen mit Komma richtig erkannt? Probeblatt mit erfundenen Namen verwenden.
3. Kommt der Text zeilenweise an oder als eine Zeile? Erscheinen Kästchen und Symbole als Fehlzeichen? Stimmt die Reihenfolge der Zimmerüberschriften?
4. Bleibt nach „Einfügen" ein Foto in der Fotomediathek oder unter „Zuletzt gelöscht"? In der Kamera-App: Foto nur beim Auslösen? Ist die Zwischenablage auf anderen eigenen Geräten sichtbar?
5. Mit Flugmodus wiederholen (Hinweis auf Verarbeitung auf dem Gerät, kein Beweis).
6. Nur falls Fallback nötig: `capture` in der installierten Web-App, Fotoqualität, Dauer und Trefferquote von Tesseract.js (deutsch, fast und best) am Probeblatt, Betrieb offline nach dem ersten Laden.
