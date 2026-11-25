# Bereitstellen auf GitHub Pages

Stand: 24.11.2026 (Phase 6). **Vorbereitet, nicht ausgerollt.** Die Arbeitsablauf-Datei
`.github/workflows/pages.yml` prüft alles (Format, Typen, Lint, Einheitstests, Browser-Tests),
baut mit den `VITE_…`-Werten aus den Repository-Variablen und stellt `dist` bereit.

## Vorher entscheiden: öffentlich?

Laut GitHub-Dokumentation („Creating a GitHub Pages site", gelesen am 24.11.2026): Gehört das
Repository einem Konto mit **GitHub Free**, muss es für Pages **öffentlich** sein. Außerdem:
„GitHub Pages sites are publicly available on the internet, even if the repository for the site
is private." Vorher prüfen, ob **alles** im Repository öffentlich sein darf – auch
`src/daten/medikamente.json` (Wissensbasis, Lizenzen der Quellen), `CLAUDE.md`, `docs/` und die
Testdaten (nur erfundene Fälle). Echte Patientendaten gehören ohnehin nie ins Repository.

## Eigene Adresse empfohlen (Befund 10)

Unter `<konto>.github.io/<projekt>/` teilen sich **alle Projektseiten desselben Kontos einen
Ursprung** (`https://<konto>.github.io`) und damit Browser-Speicher und Service-Worker-Bereich.
Eine andere Seite desselben Kontos könnte Daten dieser App im Browser lesen oder ihren
Service Worker stören. Darum:

- **Eigenes Konto oder eigene Organisation** nur für diese App (dann ist `<org>.github.io` der
  einzige Ursprung), **oder**
- **eigene (Sub-)Domain** (z. B. `visite.beispiel.de`) per „Custom domain" mit HTTPS.

Die App setzt zusätzlich eine strenge Inhaltsrichtlinie (CSP): keine fremden Skripte, Stile
oder Bilder; Verbindungen nur zur KI-Adresse und zum Übergabe-Kanal. Das schützt nicht vor
einer anderen Seite desselben Ursprungs.

## Schritte

1. **Repository anlegen** (Konto/Organisation siehe oben) und den Projektordner hochladen.
   `.gitignore` schließt Build, Testberichte, Umgebungsdateien, Bilder und PDFs aus.
2. **Repository-Variablen setzen:** Settings → Secrets and variables → Actions → _Variables_:
   - `VITE_VERARBEITEN_URL` – Adresse der Serverfunktion (siehe `docs/serverfunktion.md`)
   - `VITE_KANAL_URL` – Supabase-Projektadresse (siehe `docs/uebergabe.md`)
   - `VITE_KANAL_SCHLUESSEL` – öffentlicher Schlüssel (`sb_publishable_…`), **nie** der geheime
     Diese Werte landen im ausgelieferten Code und sind damit öffentlich; Geheimnisse gehören
     nicht hierher (die Geheimnisse der Serverfunktion liegen nur bei Supabase).
3. **Pages einschalten:** Settings → Pages → „Build and deployment" → Source: **GitHub
   Actions**.
4. **Ausrollen:** Push auf `main` oder Actions → „Bereitstellen (GitHub Pages)" → „Run
   workflow". Der Ablauf bricht ab, wenn eine Prüfung scheitert.
5. **Danach:** App-Adresse in der Serverfunktion als erlaubte Herkunft eintragen
   (`APP_HERKUNFT`, siehe `docs/serverfunktion.md`); am iPhone installieren und
   `docs/pruefung-am-iphone.md` abarbeiten.

## Quellen

- GitHub Docs, „Creating a GitHub Pages site" (Konto-Typ und Sichtbarkeit, öffentlich im Netz)
- GitHub Docs, „About GitHub Pages" (Adressen `<owner>.github.io/<repositoryname>`)
- GitHub Docs, „Using custom workflows with GitHub Pages" (`actions/configure-pages@v5`,
  `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`, Rechte `pages: write`,
  `id-token: write`, Umgebung `github-pages`)
- GitHub Docs, „Configuring a publishing source for your GitHub Pages site" (Quelle „GitHub
  Actions")
