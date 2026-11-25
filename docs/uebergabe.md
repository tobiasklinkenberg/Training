# Übergabe an den Klinik-PC

Stand: 24.11.2026 (Phase 5). Ergänzt CLAUDE.md Abschnitt 8.

## Kurz

Die PC-Seite (`…/uebergabe/`) zeigt einen QR-Code und einen Sitzungscode. Das iPhone
koppelt sich per QR-Scan oder durch Eintippen des Codes, schickt die freigegebenen
Visiteneinträge Ende-zu-Ende verschlüsselt über einen flüchtigen Kanal, die PC-Seite zeigt
sie nach Bett mit „Kopieren" und bestätigt den Empfang verschlüsselt. Erst dann vermerkt
das iPhone die Einträge als übertragen. Nach 5 Minuten ohne Aktivität oder beim Verlassen
verwirft die PC-Seite alles.

## Verfahren (Protokoll Version 1, nur WebCrypto)

1. **PC-Seite:** erzeugt je Sitzung ein ECDH-Schlüsselpaar (P-256, privater Schlüssel nicht
   exportierbar), einen Sitzungscode (8 Zeichen aus `ABCDEFGHJKMNPQRSTUVWXYZ23456789`,
   Anzeige `XXXX-XXXX`) und ein QR-Geheimnis (16 Byte). Der Kanalname ist
   `uebergabe-` + die ersten 16 Byte von SHA-256(`visiten-uebergabe/v1/kanal|<Code>`).
   **Richtigstellung (Phase 6):** Der Kanalname verbirgt den Code nicht wirksam – bei
   31⁸ ≈ 8,5 · 10¹¹ Möglichkeiten lässt sich der Code aus dem Kanalnamen durch Probieren
   ermitteln. Die Sicherheit beruht darauf nicht, sondern auf QR-Geheimnis bzw. Kontrollzahl
   mit Bestätigung auf **beiden** Geräten.
   Je Sitzung gibt es genau einen Weg: Sobald einer begonnen hat (Zusage im Code-Weg bzw.
   gültiges „hallo" im QR-Weg), wird der andere abgelehnt. Jeder abgebrochene Versuch führt
   auf der PC-Seite zu einer neuen Sitzung (neuer Code, neue Schlüssel, neues QR-Geheimnis).
2. **QR-Weg:** Der QR-Code enthält `VU1.<Code>.<öffentlicher Schlüssel>.<QR-Geheimnis>`. Das
   Geheimnis geht nie über den Kanal. Das iPhone leitet den Schlüssel sofort ab (Salz =
   QR-Geheimnis) und schickt seinen öffentlichen Schlüssel zusammen mit einem verschlüsselten
   „hallo". Nur wer den QR-Code gesehen hat, kann dieses „hallo" erzeugen; ohne Geheimnis
   gibt es weder Lesen noch Unterschieben. Eine Bestätigung der Kontrollzahl ist nicht nötig
   (sie wird auf dem PC angezeigt). Einträge tragen auf dem PC den Vermerk „über QR-Code".
3. **Code-Weg (Festlegen und Aufdecken):**
   - iPhone → Kanal: nur die Zusage `SHA-256(Kontext | Code | Schlüssel des iPhones |
Zufallswert)`.
   - PC → Kanal: erst danach der eigene öffentliche Schlüssel.
   - iPhone → Kanal: Aufdecken (Schlüssel und Zufallswert). Passt das nicht zur Zusage:
     Abbruch.
   - Beide berechnen die vierstellige Kontrollzahl; der Arzt vergleicht und tippt **auf dem
     iPhone und am PC** „Zahl stimmt". Das iPhone sendet erst, wenn auch die verschlüsselte
     Bestätigung des PCs da ist; die PC-Seite nimmt vorher keine Einträge an (ein Teil vor der
     Bestätigung führt zum Abbruch). „Zahl stimmt nicht" auf einer Seite → Abbruch, die
     PC-Seite beginnt eine neue Sitzung. Weil sich beide Seiten festlegen müssen, bevor sie den
     Schlüssel der Gegenseite kennen, kann ein Angreifer im Kanal die Zahl nicht durch
     Probieren treffen (Erfolgschance 1 zu 10 000 je Versuch, jeder Versuch fällt durch eine
     abweichende Zahl auf). Wer nur den Code kennt (oder aus dem Kanalnamen ermittelt), kann
     sich zwar mit einem eigenen Gerät koppeln, aber am PC erscheint nichts, solange dort
     niemand „Zahl stimmt" tippt – am PC nur bestätigen, wenn **das eigene iPhone** dieselbe
     Zahl zeigt. Einträge tragen auf dem PC den Vermerk „über Code, Kontrollzahl …".
4. **Schlüssel:** ECDH → HKDF-SHA-256 (Kontext: Version, Weg, Sitzungscode, beide
   öffentlichen Schlüssel; Salz: QR-Geheimnis bzw. aufgedeckter Zufallswert) → AES-GCM 256.
   Die Kontrollzahl hat eine eigene HKDF-Ableitung (anderer Kontext, Salz aus Code, beiden
   Schlüsseln und Zufallswert).
5. **Nachrichten:** AES-GCM mit frischem IV je Nachricht; gebundene Daten:
   Version, Kanal (Sitzung), Richtung (`handy`/`pc`) und laufende Nummer. Nummern steigen;
   ältere oder gleiche Nummern, falsche Richtung, veränderter Geheimtext → verworfen.
   Übergaben gehen in Teilen (je höchstens etwa 48 KB Klartext, verschlüsselt unter 70 KB).
   Fehlt ein Teil, gibt es keine Quittung.
6. **Quittung:** Die PC-Seite bestätigt jede vollständige Übergabe verschlüsselt mit Kennung
   und Anzahl. Ohne passende Quittung gilt nichts als übertragen; erneutes Senden ist
   gefahrlos (die PC-Seite zeigt gleiche Einträge nur einmal).
7. **Regeln:** Jede Kanalnachricht wird mit zod geprüft. Unlesbares oder nicht
   Authentisches wird verworfen. Andere Protokollversion, falsche Aufdeckung, zwei
   verschiedene Zusagen oder Schlüssel, ungültiger Schlüssel oder ein Verstoß einer
   authentischen Nachricht gegen den Ablauf → Abbruch mit Meldung, nie stilles Weitermachen.
   Eine Abbruch-Nachricht ist nicht beglaubigt: Der Kanal kann eine Sitzung also beenden
   (stören), aber nichts lesen oder fälschen.

## Was übertragen wird

Je Eintrag genau: Bett, Art (Visite/Nachtrag), Zeitpunkt der Eingabe, freigegebener Text.
Keine Kennungen, kein Kürzel, kein Name, kein Rohtext, keine Aufgaben, keine Verlaufsnotizen.
Nur Freigegebenes. Der freigegebene Text geht so hinüber, wie der Arzt ihn freigegeben hat
(enthält er einen Namen, steht dieser auch auf dem PC).

## Was der Kanal-Dienst sehen kann

Geheimtext; Kanalname (abgeleitet, nicht der Code); öffentliche Schlüssel; Zusage-Hash;
Zufallswert nach dem Aufdecken; Zeitpunkte, Anzahl und Größe der Nachrichten (also grob die
Zahl und Länge der Einträge); IP-Adressen und Browserkennung beider Geräte; den
öffentlichen Schlüssel der App. Er kann Nachrichten verwerfen, verzögern, wiederholen und
eigene unterschieben – das führt höchstens zu Abbruch oder fehlender Quittung, nie zu
lesbaren Inhalten; gefälschte Inhalte nur, wenn am PC eine nicht übereinstimmende
Kontrollzahl bestätigt wird.

## Was der Nutzer einrichten muss (Supabase Realtime Broadcast)

Keine Tabelle, keine Funktion, keine Datenbankänderung.

1. Supabase-Projekt in einer EU-Region (z. B. das Projekt der Serverfunktion).
2. In den Realtime-Einstellungen öffentliche Kanäle zulassen („Allow public access" an;
   sonst sind nur private Kanäle mit Anmeldung möglich). Die App nutzt `private: false`.
   Broadcast vom Client wird laut Dokumentation nicht in `realtime.messages` gespeichert
   (gespeichert wird nur „Broadcast from Database", den die App nicht nutzt).
3. Den öffentlichen Schlüssel (publishable key, `sb_publishable_…`) nehmen – nie den
   geheimen Schlüssel.
4. Beim Bauen der App setzen (nicht ins Repository):
   ```
   VITE_KANAL_URL=https://<projekt>.supabase.co
   VITE_KANAL_SCHLUESSEL=sb_publishable_…
   ```
   Ohne diese Angaben zeigen beide Seiten „Die Übergabe ist noch nicht eingerichtet".
5. Grenzen (Free-Plan laut Dokumentation): 256 KB je Broadcast-Nachricht, 100 Nachrichten je
   Sekunde, 200 gleichzeitige Verbindungen – für die Übergabe ausreichend.

Die PC-Seite erlaubt per Inhaltsrichtlinie (CSP) nur Verbindungen zu dieser Adresse
(`https://` und `wss://`), keine fremden Skripte, Stile oder Bilder.

## Entwicklung

`npm run dev` ohne Kanal-Einstellung nutzt eine lokale Vermittlung im Entwicklungsserver
(`/__uebergabe-kanal`, Server-Sent Events + POST, nichts gespeichert); beide Seiten zeigen
„Testbetrieb". Zwei Fenster: `http://localhost:<port>/uebergabe/` und die App. Die
Vermittlung ist nicht Teil des Produktions-Builds.
