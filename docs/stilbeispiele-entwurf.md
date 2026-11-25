# Stilbeispiele für die Visiten-App (Entwurf zur Korrektur)

Stand: 24.11.2026. Alle Fälle sind erfunden; es kommen keine echten Namen,
Daten oder Fallnummern vor. Platzhalter wie `[[PATIENT]]` stehen für Namen.

So gehst du vor: Lies die sechs Beispiele und ändere direkt im Text, was nicht
nach dir klingt. Setze Abkürzungen, Reihenfolge und Satzbau so, wie du selbst
dokumentierst. Streiche Beispiele, die nicht zu deiner Arbeit passen. Dein
Eintrag und die Verlaufsnotiz dürfen nur enthalten, was im Diktat steht. Erst
deine korrigierte Fassung kommt später in die KI-Anweisung; diese Datei ist
bisher nirgends eingebunden.

---

## Beispiel 1: Visite

**Diktat**

> [[PATIENT]] sagt, die Luft ist besser als gestern. Beine immer noch dick,
> rechts mehr als links. Blutdruck heute Morgen 135 zu 80, Puls 72. Furosemid
> soll von 40 auf 20 Milligramm runter, das stelle ich heute um. Labor von
> heute Morgen muss ich noch anschauen. Morgen früh Kalium und Kreatinin
> anmelden.

**Visiteneintrag**

[[PATIENT]] gibt an, die Atmung sei besser als gestern. Beinschwellung
weiterhin, rechts mehr als links. Blutdruck heute Morgen 135/80, Puls 72.
Furosemid wird von 40 auf 20 mg reduziert. Laborwerte von heute Morgen noch
ausstehend zur Sichtung. Kalium und Kreatinin für morgen früh.

**Verlaufsnotiz**

Atmung besser als gestern, Beinschwellung rechts mehr als links. Furosemid wird
von 40 auf 20 mg reduziert.

**Aufgaben**

| Stufe | Aufgabe                                       | Textstelle aus dem Diktat                        | dringend |
| ----- | --------------------------------------------- | ------------------------------------------------ | -------- |
| 1     | Furosemid von 40 auf 20 mg reduzieren         | „Furosemid soll von 40 auf 20 Milligramm runter" | nein     |
| 2     | Labor von heute Morgen sichten                | „Labor von heute Morgen muss ich noch anschauen" | nein     |
| 3     | Kalium und Kreatinin für morgen früh anmelden | „Morgen früh Kalium und Kreatinin anmelden"      | nein     |

**Rückfragen**

Keine.

---

## Beispiel 2: Visite (ohne Aufgaben)

**Diktat**

> [[PATIENT]] hat gut geschlafen, keine Beschwerden, isst normal. Temperatur
> 36,8. Sonst alles unverändert, es gibt nichts zu tun.

**Visiteneintrag**

[[PATIENT]] hat gut geschlafen, keine Beschwerden, isst normal. Temperatur
36,8. Sonst unverändert.

**Verlaufsnotiz**

Unverändert, keine Beschwerden, Temperatur 36,8.

**Aufgaben**

Keine.

**Rückfragen**

Keine.

---

## Beispiel 3: Visite (unklare Angabe)

**Diktat**

> [[PATIENT]] klagt über Schwindel seit gestern Abend. Blutdruck war 110 zu 60.
> Ich glaube, wir müssen was an den Blutdruckmedikamenten ändern, aber ich
> weiß noch nicht was, erst mit dem Oberarzt besprechen. Röntgen Thorax
> anmelden, wegen dem Husten.

**Visiteneintrag**

[[PATIENT]] klagt über Schwindel seit gestern Abend. Blutdruck 110/60. Husten.
Änderung der Blutdruckmedikation möglich, Art der Änderung offen; Rücksprache
mit dem Oberarzt vorgesehen. Röntgen Thorax wegen Husten wird angemeldet.

**Verlaufsnotiz**

Schwindel seit gestern Abend, Blutdruck 110/60. Röntgen Thorax wegen Husten
wird angemeldet; Blutdruckmedikation mit dem Oberarzt zu besprechen.

**Aufgaben**

| Stufe | Aufgabe                                | Textstelle aus dem Diktat | dringend |
| ----- | -------------------------------------- | ------------------------- | -------- |
| 1     | Röntgen Thorax anmelden (wegen Husten) | „Röntgen Thorax anmelden" | nein     |

**Rückfragen**

- Welche Änderung an den Blutdruckmedikamenten ist gemeint? Im Diktat ist sie
  offen; es wurde keine Aufgabe daraus gemacht.

---

## Beispiel 4: Visite (dringend, drei Stufen)

**Diktat**

> [[PATIENT]] hat seit heute Morgen Brustschmerzen, Blutdruck 150 zu 90.
> Dringend EKG anmelden. Troponin von heute sichten. Morgen früh Troponin
> nochmal anmelden.

**Visiteneintrag**

[[PATIENT]] mit Brustschmerzen seit heute Morgen. Blutdruck 150/90. EKG wird
dringend angemeldet. Troponin von heute zu sichten, Troponin-Kontrolle für
morgen früh.

**Verlaufsnotiz**

Brustschmerzen seit heute Morgen, Blutdruck 150/90. EKG wird dringend
angemeldet, Troponin-Kontrolle morgen früh.

**Aufgaben**

| Stufe | Aufgabe                       | Textstelle aus dem Diktat               | dringend |
| ----- | ----------------------------- | --------------------------------------- | -------- |
| 1     | EKG anmelden                  | „Dringend EKG anmelden"                 | ja       |
| 2     | Troponin von heute sichten    | „Troponin von heute sichten"            | nein     |
| 3     | Troponin morgen früh anmelden | „Morgen früh Troponin nochmal anmelden" | nein     |

**Rückfragen**

Keine.

---

## Beispiel 5: Nachtrag

**Diktat**

> Natrium ist heute 128, gestern war es 133. Kontrolle morgen früh anmelden.

**Visiteneintrag**

Nachtrag: Natrium heute 128, gestern 133. Kontrolle für morgen früh vorgesehen.

**Verlaufsnotiz**

Natrium heute 128 (gestern 133); Kontrolle für morgen früh vorgesehen.

**Aufgaben**

| Stufe | Aufgabe                                    | Textstelle aus dem Diktat        | dringend |
| ----- | ------------------------------------------ | -------------------------------- | -------- |
| 3     | Natrium-Kontrolle für morgen früh anmelden | „Kontrolle morgen früh anmelden" | nein     |

**Rückfragen**

Keine.

---

## Beispiel 6: Nachtrag

**Diktat**

> Befund vom CT Abdomen ist jetzt da, den muss ich noch sichten. Hat
> [[PERSON_1]] aus der Radiologie telefonisch mitgeteilt.

**Visiteneintrag**

Nachtrag: Befund CT Abdomen liegt vor, Sichtung steht aus. Telefonische
Mitteilung durch [[PERSON_1]] (Radiologie).

**Verlaufsnotiz**

Befund des CT Abdomen liegt vor und ist noch zu sichten.

**Aufgaben**

| Stufe | Aufgabe                       | Textstelle aus dem Diktat                                       | dringend |
| ----- | ----------------------------- | --------------------------------------------------------------- | -------- |
| 2     | Befund vom CT Abdomen sichten | „Befund vom CT Abdomen ist jetzt da, den muss ich noch sichten" | nein     |

**Rückfragen**

Keine.
