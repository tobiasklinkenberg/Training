# KI-Dienst für die Serverfunktion `verarbeiten` – Vergleich

Stand: 24.11.2026. Alle Aussagen zu Verarbeitungsort, Vertrag, Training und Speicherung
stützen sich auf Anbieterseiten, die am 24.11.2026 gelesen wurden (Belege in Abschnitt 6).
Was sich dort nicht fand, steht als **nicht belegt** da. Das ist keine Rechtsberatung.

Gemessen wird an den vier Anforderungen aus `CLAUDE.md` 7.1:
**(1) Verarbeitung in der EU, (2) Vertrag zur Auftragsverarbeitung (AVV/DPA),
(3) kein Training mit den Eingaben, (4) keine dauerhafte Speicherung.**

---

## 1. Empfehlung

1. Wenn Claude, dann **Claude über Amazon Bedrock**, aufgerufen aus Frankfurt (`eu-central-1`)
   mit dem EU-Inferenzprofil `eu.anthropic.claude-haiku-5-5`. Dazu den Datenaufbewahrungsmodus
   `none` setzen und das Invocation Logging ausgeschaltet lassen. Das ist der einzige
   Claude-Weg, bei dem alle vier Anforderungen belegt sind: bei zwei davon nur mit Auflagen,
   bei keiner offen.
2. Als Modell zuerst **Claude Haiku 5.5** (kleinstes aktuelles Modell, Kosten deutlich unter
   5 USD im Monat) mit dem Testsatz aus `tests/ki/faelle/` gegen **Claude Sonnet 5.5** prüfen.
   Sonnet nur nehmen, wenn Haiku im Testsatz erkennbar schlechter abschneidet.
3. **Weder das Claude-Abo noch die Anthropic-API direkt** sind geeignet: Das Abo darf nicht
   aus einer eigenen App genutzt werden. Die direkte API bietet keine EU-Verarbeitung, nur
   `global` oder `us`.
4. **Vorbehalt 1:** Die Patientendaten gehören zur Klinik. Vor dem ersten echten Diktat muss
   der Datenschutz der Klinik zustimmen. Der Vertrag mit dem Dienst sollte voraussichtlich auf
   die Klinik laufen oder von ihr genehmigt sein. Ein privates Konto des Arztes reicht dafür
   voraussichtlich nicht.
5. **Vorbehalt 2:** Wenn die Klinik Anbieter mit US-Konzern ablehnt, ist **IONOS AI Model
   Hub** (Verarbeitung in Deutschland, offene Modelle) die naheliegende Alternative. Ob die
   Qualität für deutsche ärztliche Diktate reicht, ist unbelegt und muss der Testsatz zeigen.

## 2. Geht das mit einem bezahlten Claude?

**Ja, aber nicht mit dem Abo, sondern mit Claude über die Cloud (Amazon Bedrock, EU-Profil),
abgerechnet über AWS.**

- **Claude-Abo (Free, Pro, Max, Team): nein.**
  - Die Consumer Terms (Pro, Max) verbieten automatisierten Zugriff, außer über einen
    Anthropic-API-Schlüssel. Sie schließen außerdem gewerbliche Nutzung aus [A6].
  - Anthropic erlaubt Entwicklern nicht, Anfragen über Zugangsdaten von Free-, Pro-, Max-
    oder Ultra-Konten zu leiten. Wer ein Produkt baut, soll einen API-Schlüssel aus der
    Console oder einen Cloud-Anbieter nutzen [A7].
  - Die Oberflächen von Team und Enterprise sind nicht für Zero Data Retention (ZDR)
    zugelassen [A2].
- **Anthropic-API direkt (Console, Pay-as-you-go): technisch ja, aber Anforderung (1) ist
  nicht erfüllt.**
  - `inference_geo` kennt nur `global` und `us`.
  - Der Workspace-Speicherort ist nur `us` [A1].
- **Claude über Amazon Bedrock mit EU-Profil: ja, mit Auflagen** (Abschnitt 3).
- **Claude über Google Vertex AI, Multi-Region `eu`:** Die EU-Verarbeitung ist belegt. Ob und
  wie lange Google Claude-Anfragen speichert, ließ sich nicht belegen.
- **Claude über Microsoft Foundry: nein.** Es gibt nur Global Standard und die US-Datenzone,
  keine EU-Datenzone [A8].

## 3. Tabelle: Weg × Anforderungen

Legende: ✅ erfüllt · ⚠️ mit Auflage · ❌ nicht erfüllt · ❓ nicht belegt

| Weg | (1) EU-Verarbeitung | (2) AVV/DPA | (3) kein Training | (4) keine dauerhafte Speicherung |
| --- | --- | --- | --- | --- |
| Claude-Abo (Pro/Max/Team) aus eigener App | ❌ nicht zulässig [A6, A7] | ❌ Consumer Terms, kein DPA [A6] | ⚠️ nur nach Opt-out (Pro/Max) [A6] | ❌ nicht ZDR-fähig [A2] |
| Anthropic-API direkt | ❌ nur `global`/`us` [A1] | ✅ DPA ist Teil der Commercial Terms [A3, A4] | ✅ [A3] | ⚠️ bis 30 Tage, ZDR nur über Vertrieb [A2, A5] |
| Claude Platform on AWS / Claude on Google Cloud (von Anthropic betrieben) | ❌ Workspace-Speicherort nur `us`, Inferenz `global`/`us` [A1] | ✅ wie API [A2] | ✅ [A3] | ⚠️ wie API [A2] |
| **Claude über Amazon Bedrock, EU-Profil** | ⚠️ nur bei Quellregion in der EU, z. B. `eu-central-1` [B2, B4] | ✅ AWS-DPA in den Service Terms; Anthropic-Bedingungen auf Bedrock [B10, B11] | ✅ [B9, B11] | ⚠️ Modus `none` setzen, Logging aus [B6, B7] |
| Claude über Google Vertex AI, Multi-Region `eu` | ✅ [V1, V2] | ⚠️ Cloud-DPA, wirksam mit Annahme [V5] | ⚠️ allgemein belegt, nicht für Claude benannt [V3] | ❓ für Claude nicht belegt, ZDR „auf Anfrage“ [V3, V4] |
| Claude über Microsoft Foundry | ❌ nur Global oder US-Datenzone [A8] | ✅ Anthropic-Datenbedingungen [A8] | ✅ [A3] | ⚠️ wie API [A2] |
| *Alternative:* Mistral, EU-Endpunkt | ⚠️ EU und EFTA, Steuerungsdaten ggf. außerhalb [M2, M3] | ⚠️ DPA für gewerbliche Kunden [M1] | ⚠️ nur nach Opt-out [M1, M5] | ⚠️ Missbrauchsprüfung ohne Frist-Angabe, ZDR auf Antrag [M1, M4] |
| *Alternative:* Azure OpenAI, Datenzone EU | ✅ EU-Mitgliedstaaten [Z1] | ✅ Microsoft-DPA [Z1] | ✅ [Z1] | ⚠️ Speicherung zur menschlichen Prüfung, Abschaltung nur eingeschränkt [Z1, Z2] |
| *Alternative:* IONOS AI Model Hub | ✅ Deutschland [I1] | ✅ Teil des Vertrags [I1] | ✅ [I1] | ✅ kein Logging der Inhalte [I1] |

### Belege und Auflagen je Weg

**Claude-Abo**
- Consumer Terms, Abschnitt 3: kein Zugriff „through automated or non-human means“, außer
  über einen Anthropic-API-Schlüssel [A6].
- Abschnitt 11: keine gewerbliche Nutzung [A6].
- Training mit Inhalten, außer nach Opt-out [A6].
- Anthropic: Weiterleiten von Anfragen über Free-, Pro-, Max- oder Ultra-Zugangsdaten ist
  nicht erlaubt. Entwickler sollen API-Schlüssel nutzen [A7].

**Anthropic-API direkt**
- Workspace-Speicherort „Currently, `"us"` is the only available workspace geo“ [A1].
- Inferenz: nur `global` oder `us` [A1].
- Commercial Terms: kein Training mit Kundeninhalten. Das DPA ist per Verweis Teil der
  Bedingungen. Die Bedingungen sind „not for consumer use“ [A3, A4].
- Speicherung, zwei Angaben, die nicht ganz zusammenpassen:
  - Die Doku sagt, Gesprächsinhalte würden standardmäßig nicht aufbewahrt [A2].
  - Das Privacy Center (aktualisiert 01.07.2026) sagt, Ein- und Ausgaben würden innerhalb
    von 30 Tagen gelöscht [A5].
  - Markierte Inhalte bleiben bis zu 2 Jahre [A2, A5].
  - ZDR gibt es nur über den Vertrieb [A2].
- Fable-Modelle verlangen eine 30-tägige Aufbewahrung, daher nicht verwenden [A2].

**Claude über Amazon Bedrock (EU-Profil)**
- Für Haiku 5.5 und Sonnet 5.5 gibt es keine Verfügbarkeit in einer einzelnen EU-Region, nur
  über das Geo-Profil `eu.anthropic.claude-…` [B4, B5].
- Aufruf aus `eu-central-1` (Frankfurt) leitet nur an diese Regionen weiter: Frankfurt,
  Stockholm, Mailand, Spanien, Irland, Paris. Das sind alles EU-Mitgliedstaaten [B4].
- **Auflage:** nicht aus London (`eu-west-2`) oder Zürich (`eu-central-2`) aufrufen, denn
  dann gehören London bzw. Zürich zu den Zielen [B4].
- **Auflage:** keine `global.`-Profile nutzen, denn die leiten weltweit weiter [B1].
- AWS rät, die Zielregionen per `GetInferenceProfile` aus der Quellregion zu prüfen und sich
  nicht allein auf das Präfix zu verlassen [B3].
- Profile mit geografischer Bindung behalten ihre Zielregionen [B3].
- Für markierte oder zur Missbrauchsprüfung gespeicherte Daten gilt: gespeichert wird in der
  Zielregion [B2].
- Vertrag:
  - Die AWS Service Terms (Stand 23.11.2026) „incorporate the AWS Data Processing Addendum“,
    wenn Kundendaten verarbeitet werden [B10].
  - Für Claude gelten zusätzlich „Anthropic on Bedrock – Commercial Terms“ (Version
    18.08.2025): Anthropic darf nicht mit Kundeninhalten trainieren, Verarbeitung nach
    Anthropic-DPA, „not for consumer use“ [B11].
- Training: „AWS and the third-party model providers will not use any inputs to or outputs
  from Amazon Bedrock to train“ [B9]. Modellanbieter haben keinen Zugriff auf Prompts und
  Ausgaben [B8].
- Speicherung:
  - Modus `none`: Anfrage- und Antwortdaten werden nicht dauerhaft gespeichert und nicht an
    den Modellanbieter weitergegeben [B6].
  - Eine Aufbewahrung aller Anfragen für 30 Tage ist nur für Fable 5, 5.1 und 5.2
    aufgeführt [B7].
  - **Auflage:** `data_retention_mode: none` für das Konto in `eu-central-1` setzen. Zur
    Einführung gibt es dafür keine Oberfläche, nur API oder SDK [B6].
  - Ob Haiku 5.5 den Modus `none` zulässt (`allowed_modes`), ist **nicht belegt**. Nach dem
    Einrichten prüfen. Wenn nicht, lehnt Bedrock die Anfrage ab, statt still zu speichern [B6].
  - **Auflage:** Model Invocation Logging nicht einschalten. Es ist optional [B4, B9].
- Hinweis: Haiku 5.5 und Sonnet 5.5 laufen über Profile mit „limited model selection“, und
  neue Modellversionen kommen dort eventuell nicht an [B4, B5].

**Claude über Google Vertex AI**
- Haiku 5.5 und Sonnet 5.5 gibt es in der Multi-Region `eu`, nicht in einzelnen
  EU-Regionen [V1, V2].
- Bei der Multi-Region bleibt die Verarbeitung „within that specific geographical region“.
  Der globale Endpunkt bietet keine Garantie [V1].
- Das Cloud-DPA ist Teil des Vertrags ab Annahme [V5].
- Training: Googles Trainingsbeschränkung gilt laut Doku „for all managed models“. Claude
  wird dort nicht genannt [V3].
- Speicherung bei Claude (Protokolle zur Missbrauchsprüfung, Frist): **nicht belegt**.
  - Die ZDR-Seite nennt nur OpenAI-Modelle: dort 30 Tage Protokoll, gespeichert in `us` [V4].
  - Allgemein heißt es: „You can request zero data retention for supported partner models“
    [V3].

**Claude über Microsoft Foundry**
- Bereitstellung nur als Global Standard oder als US Data Zone Standard [A8].

**Mistral (EU-Endpunkt `api.eu.mistral.ai`)**
- Verarbeitung „within the European Union“ auf „data centers in EU and EFTA countries“ [M2].
- Steuerungsdaten (Konto, Schlüssel, Abrechnung) gegebenenfalls außerhalb [M2].
- Daten liegen standardmäßig im EWR, können je nach Funktion zeitweise in Drittländer gehen
  [M3].
- Das DPA (gültig ab 27.07.2026) ist per Verweis Teil des Vertrags, unter „For Commercial
  Customers“ [M1].
- Training: „unless Customer is or has opted-out“. Also muss man das Opt-out im
  Admin-Bereich setzen [M1, M5].
- Missbrauchsprüfung ist ausgenommen, wenn ZDR aktiv ist. Eine Frist ist **nicht belegt** [M1].
- ZDR gibt es bei Pay-as-you-go auf Antrag [M4].

**Azure OpenAI (Datenzone EU)**
- Verarbeitung „in that or any other European Union Member Nation“ [Z1].
- Daten aus der Missbrauchsprüfung liegen in der Geografie der Ressource [Z1].
- Microsoft Products and Services DPA [Z1].
- Prompts und Ausgaben werden nicht zum Training verwendet [Z1].
- Markierte Inhalte werden zur menschlichen Prüfung gespeichert [Z1, Z2].
  - Die Speicherfrist ist **nicht belegt**.
  - Das Abschalten („modified abuse monitoring“) geht nur bei Limited-Access-Berechtigung
    [Z2].
  - Für Modelle ab 01.11.2026 entfällt die Abschaltung künftig [Z1, Z2].

**IONOS AI Model Hub**
- Verarbeitung „in data centers in Germany … and nowhere else“ [I1].
- Inhalte „never logged“, nicht dauerhaft gespeichert, nicht zum Training genutzt [I1].
- Der AVV gilt als Teil des Vertrags, ohne eigene Unterschrift [I1].
- BSI C5 im Geltungsbereich [I1].
- Modelle: Llama 3.3 70B, GPT-OSS 120B, Qwen3.5 397B, Mistral Small 24B und weitere [I2].
- Unterstützung für JSON-Schema-Ausgabe und die Preise sind **nicht belegt** [I2].

### Wer kann den Vertrag schließen?

- **Anthropic (API, auch auf Bedrock):** Die Commercial Terms sind „not for consumer use“.
  Wer für eine Organisation abschließt, braucht die Befugnis dazu [A3, B11].
- **AWS:** Das DPA ist Teil der Service Terms und gilt automatisch bei Verarbeitung von
  Kundendaten [B10]. Ob ein Privatkonto für die Anthropic-Bedingungen genügt, ist
  **nicht belegt**.
- **Google:** Das Cloud-DPA wirkt ab Annahme [V5]. Wer abschließen darf, ist **nicht belegt**.
- **Mistral:** Das DPA ist für gewerbliche Kunden formuliert [M1].
- **IONOS:** Der AVV ist Teil des Vertrags [I1]. Wer Kunde werden kann, ist **nicht belegt**.
- **Für alle Wege:** Bei Patientendaten der Klinik ist der Arzt voraussichtlich nicht selbst
  Verantwortlicher im Sinne der DSGVO. Die Nutzung braucht die Freigabe der Klinik
  (Datenschutzbeauftragte). Ob der Vertrag dann auf die Klinik laufen muss, entscheidet die
  Klinik.

## 4. Eignung, Modellwahl und Kosten

**JSON-Ausgabe und Deutsch**
- Structured Outputs (`output_config.format` mit JSON-Schema) gibt es für Haiku 5.5 auf
  Bedrock [B4]. Laut `claude-api`-Skill (Stand 03.11.2026) auch auf der Claude-API, auf
  Vertex und auf Foundry [S1].
- Das passt zu `KiErgebnis` in `_shared/vertrag.ts`. Die zod-Prüfung im Gerät bleibt trotzdem.
- Im Schema selbst dürfen keine Patientendaten stehen. Schemas werden bis zu 24 Stunden
  zwischengespeichert [A2]. Unser Schema enthält nur Feldnamen.
- Deutsch erreicht auf Global-MMLU 97,4 % des englischen Werts bei Haiku 5.5 und 98,5 % bei
  Sonnet 5.5 [A10].

**Modellwahl**
- Die Aufgabe ist Ordnen und Umformulieren ohne Fachurteil. Das spricht für das kleinste
  Modell: **Haiku 5.5**, Vergleich **Sonnet 5.5**.
- Fable-Modelle scheiden aus, weil sie eine 30-tägige Aufbewahrung verlangen [A2, B7].
- Haiku 5.5 denkt standardmäßig mit (Effort `medium`) [B4]. Für diese Aufgabe auch `low`
  testen.
- Die Entscheidung trifft der Testsatz (`CLAUDE.md` 7.5), nicht diese Tabelle.

**Grobe Monatskosten**
- Annahmen: je Anfrage etwa 3.000 Eingabe-Token (Systemanweisung, Schema und Diktat mit
  einigen hundert Wörtern) und etwa 1.500 Ausgabe-Token (JSON und Denkanteil). 300 bis 900
  Anfragen im Monat (10–30 am Tag).
- Preise: Listenpreise von Anthropic [A9]. Regionale und Multi-Region-Endpunkte auf Bedrock
  und Vertex kosten 10 % mehr als globale [A9].
- Die Bedrock-Preistabelle selbst ließ sich nicht auslesen, daher sind die Werte
  **Schätzungen**.

| Modell (EU-Endpunkt, Listenpreis +10 %) | USD je 1 Mio. Token Ein/Aus | je Anfrage | 300 Anfragen/Monat | 900 Anfragen/Monat |
| --- | --- | --- | --- | --- |
| Claude Haiku 5.5 | 0,11 / 0,55 | ≈ 0,0012 USD | ≈ 0,35 USD | ≈ 1,04 USD |
| Claude Sonnet 5.5 | 2,20 / 11,00 | ≈ 0,023 USD | ≈ 6,90 USD | ≈ 20,80 USD |
| Claude Opus 5.5 (nur zum Vergleich) | 4,40 / 22,00 | ≈ 0,046 USD | ≈ 13,90 USD | ≈ 41,60 USD |

Für Mistral, Azure OpenAI und IONOS wurden keine Preise belegt. Mistral nennt für den
EU-Endpunkt einen Aufschlag von 10 % [M2].

**Aufwand der Anbindung an `ki/anbieter.ts`**

Eine neue Implementierung von `KiAnbieter` plus ein Wert für `KI_ANBIETER`.

- **Bedrock:**
  - Code: klein. Anthropic-SDK für Bedrock, Messages-API am Endpunkt `bedrock-runtime` in
    `eu-central-1`, Modell-ID `eu.anthropic.claude-haiku-5-5`. Der Endpunkt `bedrock-mantle`
    bietet für dieses Modell kein EU-Profil [B4].
  - Geheimnisse: AWS-Zugang oder Bedrock-API-Schlüssel.
  - Einrichtung: mittel. AWS-Konto, Freischaltung der Anthropic-Modelle, Aufbewahrungsmodus
    per API, eine Richtlinie gegen `global.`-Profile.
- **Vertex:** mittel. `AnthropicVertex` mit Region `eu`. Authentifizierung über ein
  Dienstkonto in der Deno-Funktion.
- **Anthropic direkt:** am kleinsten, scheidet aber an Anforderung (1).
- **Mistral, Azure OpenAI, IONOS:** jeweils eigene HTTP- oder SDK-Anbindung. Die
  Systemanweisung und die JSON-Vorgaben müssen dafür neu geprüft werden (Testsatz).

## 5. Vor dem Einsatz mit echten Diktaten zu klären

1. **Freigabe der Klinik:**
   - Datenschutzbeauftragte und gegebenenfalls IT-Sicherheit stimmen zu.
   - Klären, wer Verantwortlicher ist und wer den AVV mit dem Dienst schließt.
   - Klären, ob die pseudonymisierten Diktate noch als Gesundheitsdaten mit Personenbezug
     gelten. Vorsichtshalber davon ausgehen.
2. **Berufsgeheimnis und Landesrecht:** Schweigepflicht (§ 203 StGB) und
   krankenhausrechtliche Vorgaben des Bundeslands durch die Klinik bewerten lassen. Ob US-Konzerne als Anbieter zulässig sind, bewertet ebenfalls die Klinik.
3. **Bedrock-Einrichtung prüfen:**
   - `GetInferenceProfile` aus `eu-central-1` liefert nur EU-Regionen.
   - Der Aufbewahrungsmodus ist `none`, und Haiku 5.5 lässt `none` zu.
   - Invocation Logging ist aus.
   - `global.`-Profile sind per Richtlinie gesperrt.
4. **Supabase:** Region und Protokollierung der Edge Function selbst gehören nicht zu diesem
   Vergleich und wurden **nicht geprüft**. Die Funktion sieht den maskierten Text ebenfalls.
5. **Testsatz:** Haiku 5.5 und Sonnet 5.5 mit den ~20 erfundenen Fällen vergleichen (nichts
   erfunden, nichts übersehen, richtige Stufe, Rückfragen). Danach Modell und Effort festlegen.
6. **Pseudonymfilter:** Die Pflichttests müssen grün sein, bevor irgendein Text das Gerät
   verlässt.
7. **Quellen erneut prüfen:** Belege kurz vor dem Start erneut lesen. Die Abschaltung der
   Missbrauchsprüfung bei Azure und die Bedrock-Aufbewahrungsmodi haben sich 2026 mehrfach
   geändert.

## 6. Quellen (gelesen am 24.11.2026)

„ohne Datum“ heißt: Die Seite nennt kein Änderungsdatum.

| Nr. | Titel | URL | Stand |
| --- | --- | --- | --- |
| A1 | Anthropic – Data residency | https://platform.claude.com/docs/en/manage-claude/data-residency | ohne Datum |
| A2 | Anthropic – API and data retention | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention | ohne Datum |
| A3 | Anthropic – Commercial Terms of Service | https://www.anthropic.com/legal/commercial-terms | 17.06.2025 |
| A4 | Anthropic – Data Processing Addendum | https://www.anthropic.com/legal/data-processing-addendum | gültig ab 24.02.2025 |
| A5 | Anthropic Privacy Center – How long do you store my organization's data? | https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data | aktualisiert 01.07.2026 |
| A6 | Anthropic – Consumer Terms of Service | https://www.anthropic.com/legal/consumer-terms | gültig ab 08.10.2025 |
| A7 | Claude Code – Legal and compliance (Authentication and credential use) | https://code.claude.com/docs/en/legal-and-compliance | ohne Datum |
| A8 | Anthropic – Claude in Microsoft Foundry | https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry | ohne Datum |
| A9 | Anthropic – Pricing | https://platform.claude.com/docs/en/about-claude/pricing | ohne Datum |
| A10 | Anthropic – Multilingual support | https://platform.claude.com/docs/en/build-with-claude/multilingual-support | ohne Datum |
| B1 | AWS – Cross-Region inference | https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html | ohne Datum |
| B2 | AWS – Geographic cross-Region inference | https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html | ohne Datum |
| B3 | AWS – Supported Regions and models for inference profiles | https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html | ohne Datum |
| B4 | AWS – Model card Claude Haiku 5.5 | https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html | Modellstart 07.10.2026 |
| B5 | AWS – Model card Claude Sonnet 5.5 | https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html | Modellstart 28.09.2026 |
| B6 | AWS – Bedrock Data retention | https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html | ohne Datum |
| B7 | AWS – Amazon Bedrock abuse detection | https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html | ohne Datum |
| B8 | AWS – Bedrock Data protection | https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html | ohne Datum |
| B9 | AWS – Amazon Bedrock FAQs | https://aws.amazon.com/bedrock/faqs/ | ohne Datum |
| B10 | AWS – Service Terms (Abschnitt 1.14) | https://aws.amazon.com/service-terms/ | 23.11.2026 |
| B11 | AWS – Bedrock third-party model terms (Anthropic on Bedrock – Commercial Terms) | https://aws.amazon.com/legal/bedrock/third-party-models/ | Version 18.08.2025 |
| V1 | Google Cloud – Vertex AI Data residency | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency | ohne Datum |
| V2 | Google Cloud – Claude Haiku 5.5 (Vertex AI) | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/haiku-5-5 | ohne Datum |
| V3 | Google Cloud – Data governance and zero data retention | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance | ohne Datum |
| V4 | Google Cloud – Vertex AI zero data retention | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention | ohne Datum |
| V5 | Google Cloud – Cloud Data Processing Addendum | https://cloud.google.com/terms/data-processing-addendum | „Current“, ohne Datum |
| M1 | Mistral AI – Data Processing Addendum | https://legal.mistral.ai/terms/data-processing-addendum | gültig ab 27.07.2026 |
| M2 | Mistral AI – Regional inference | https://docs.mistral.ai/inference/regional-inference | ohne Datum |
| M3 | Mistral Help – Where do you store my data? | https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data | „Updated this week“ |
| M4 | Mistral AI – Zero data retention | https://docs.mistral.ai/admin/monitor-comply/zero-data-retention | ohne Datum |
| M5 | Mistral Help – Training opt-out / Do you use my data to train | https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training · https://help.mistral.ai/en/articles/323757-do-you-use-my-user-data-to-train-your-artificial-intelligence-models | „Updated this week“ |
| Z1 | Microsoft Learn – Data, privacy, and security for Foundry Models sold by Azure | https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy | ms.date 18.05.2026, Änderung 17.11.2026 |
| Z2 | Microsoft Learn – Abuse monitoring | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/abuse-monitoring | ms.date 13.05.2026 |
| I1 | IONOS – AI Model Hub Data handling | https://docs.ionos.com/cloud/ai/ai-model-hub/governance-and-compliance/data-handling | ohne Datum |
| I2 | IONOS – AI Model Hub Large Language Models | https://docs.ionos.com/cloud/ai/ai-model-hub/models/llms | ohne Datum |
| S1 | `claude-api`-Skill, Tabelle Plattformverfügbarkeit (keine Datenschutzaussage) | lokal gebündelt | 03.11.2026 |
