English: [[Geometry|Geometry]]

# Geometrie

## Konventionen

| Konvention | Wert |
| --- | --- |
| Längen | Millimeter (mm) |
| Winkel | Grad (°); Schränkung positiv = Nase hoch |
| Achsen | x in Profiltiefenrichtung, positiv zur Endleiste; y in Spannweitenrichtung, positiv zum rechten Flügelende; z nach oben |
| Berechnete Geometrie | rechter Halbflügel (y ≥ 0); der linke Halbflügel ist sein Spiegelbild an der Ebene y = 0 |
| Kurven und Flächen | NURBS (Non-Uniform Rational B-Spline, nicht-uniformer rationaler B-Spline) mit allen Gewichten 1, d. h. nicht-rationale B-Splines |
| Algorithmusnummern (A2.1 …) und Gleichungsnummern | Piegl und Tiller, *The NURBS Book*, 2. Auflage, Springer 1997 |

## Symbole

| Symbol | Bedeutung |
| --- | --- |
| LE, TE | Nasenleiste (leading edge), Endleiste (trailing edge); als Index: x_LE, x_TE |
| N | Anzahl der Tiefenintervalle je Profilseite (N + 1 Stationen je Profilseite, Nase und Endleiste eingeschlossen): **Settings** > **Chordwise stations per surface**, Vorgabe 60, Bereich 16 bis 200 |
| K | Stationen je Feld in Spannweitenrichtung: **Settings** > **Spanwise stations per panel with guides or smooth mode**, Vorgabe 8, Bereich 3 bis 40; die Gittergrenze aus Abschnitt 3.2 kann K verringern |
| c | Profiltiefe in mm |
| f_pivot | Drehpunkt der Schränkung als Anteil der Profiltiefe: **Settings** > **Twist pivot (fraction of chord)**, Vorgabe 0,25, Bereich 0 bis 1 |
| n | Index des letzten Punkts einer Punktliste (Punkte 0 … n) |
| p | Grad einer Kurve |
| u | Flächenparameter um das Profil: 0 obere Endleiste, u_LE Profilnase, 1 untere Endleiste |
| v | Flächenparameter entlang der Spannweite: 0 Wurzel, 1 Rand |
| Feld | Spannweitenabschnitt zwischen zwei benachbarten Profilschnitten |
| Station | eine platzierte Profilkontur an der Spannweitenposition y; jeder Profilschnitt ist eine Station |

Ableitungen werden als dx/du und d²x/du² geschrieben. Indizes sind Punktnummern (Q_k, x_N) oder
Bezeichner (x_LE, x_norm).

## Ablauf

| Schritt | Code | Algorithmen aus The NURBS Book |
| --- | --- | --- |
| 1. Profil als NURBS-Kurve | `src/airfoil/geometry.js`, `src/geom/profile.js` | A2.1, A2.2, A2.3, A3.1, A3.2, A9.1 |
| 2. Gemeinsame Tiefenstationen | `src/geom/profile.js`, `src/geom/wing.js` | A3.1 |
| 3. Stationen in Spannweitenrichtung | `src/geom/wing.js`, `src/geom/spanwise.js`, `src/geom/guide.js` | A9.1 |
| 4. Fläche | `src/geom/wing.js`, `src/geom/nurbs.js` | A9.1 je Zeile und Spalte (gleichwertig zu A9.4), A3.5 |
| 5. Dreiecksnetze | `src/geom/mesh.js`, `src/geom/triangulate.js` | A3.5 |
| 6. STEP-Topologie (STEP: Standard for the Exchange of Product model data) | `src/export/step.js` | A5.1 |
| 7. Grundrisskennwerte | `src/geom/stats.js`, `src/geom/wing.js` (`planformAt`) | – |

## 1. Profil als NURBS-Kurve

Eingabe: Profilpunkte in Selig-Reihenfolge (obere Endleiste → Profilnase → untere Endleiste), die die
Plausibilitätsprüfungen bestehen ([[Dateiformate|Dateiformate]]). Ein Fehler der
Plausibilitätsprüfungen, eine sich selbst überschneidende Kurve (Abschnitt 1.4) oder ein Rücklauf in x
(Abschnitt 1.5) blockiert den Flügelaufbau, Warnungen nicht. Die Plausibilitätsprüfungen entfernen
zuerst aufeinanderfolgende Punkte, die näher als 1e-9 des x-Bereichs beieinander liegen (Info
`duplicates`): Ihre Parameter u_k (Abschnitt 1.2) können auf denselben Wert gerundet werden und machen
das lineare Gleichungssystem singulär.

### 1.1 Normierung

- Profilnase der Datei P: der Dateipunkt mit dem größten Abstand zur Endleistenmitte (Mittel aus erstem
  und letztem Punkt). Quadrierte Abstände, die relativ höchstens 1e-15 unter dem größten liegen, gelten als
  gleich; dann gilt der Punkt mit kleinerem x, sodass jede Skalierung derselben Kontur denselben Punkt
  wählt.
- Nur Verschiebung und gleichmäßige Skalierung. Das Profil wird nicht gedreht.

```
c_file = x_max − x_min
x_norm = (x − x_min) / c_file
z_norm = (z − z_P)  / c_file
```

- Geneigte Profile: Die Linie von P zur Endleistenmitte behält ihren Winkel. Über 0,5° melden die
  Plausibilitätsprüfungen die Warnung `rotated`. Die Schränkung bezieht sich dann auf die x-Achse der
  Datei.

### 1.2 Interpolation

| Eigenschaft | Wert |
| --- | --- |
| Verfahren | globale Kurveninterpolation durch jeden Punkt Q_0 … Q_n (A9.1) |
| Grad | 3 |
| Parameter | **Settings** > **Profile parametrization**: **Centripetal (recommended)** (zentripetal, Vorgabe), **Chord length** (Sehnenlänge) oder **Uniform** (gleichabständig) (Gl. 9.3 bis 9.6) |
| Knotenvektor | geklemmt (clamped), durch Mittelwertbildung (averaging, Gl. 9.8) |
| Lineares Gleichungssystem | Band-LU-Zerlegung (lower-upper) ohne Pivotsuche; Zeile k enthält die p + 1 Basiswerte des Knotenintervalls von u_k, alle übrigen Einträge sind 0; Kollokationsmatrizen von B-Splines sind bei nicht fallenden Parametern total positiv, daher ist die Elimination ohne Zeilentausch stabil (de Boor und Pinkus 1977); fallende Parameter brechen die Interpolation mit dem Fehler „Interpolation parameters must be nondecreasing.“ ab |
| Parameterbereich | u = 0 an der oberen Endleiste, u = 1 an der unteren Endleiste |

```
d_k = |Q_k − Q_(k−1)|^e          e = 1 (Chord length), e = 0.5 (Centripetal)
u_0 = 0,  u_k = u_(k−1) + d_k / Σ d,  u_n = 1
Uniform:  u_k = k / n
Knoten:   U_(j+p) = (u_j + … + u_(j+p−1)) / p,   j = 1 … n − p,   je p + 1 Endknoten bei 0 und bei 1
```

### 1.3 Profilnase der Kurve

Der Ursprung des Profilschnitts ist der Punkt der Kurve mit minimalem x: u_LE mit dx/du(u_LE) = 0.

| Eigenschaft | Wert |
| --- | --- |
| Startwert | Parameter des Dateipunkts mit minimalem x |
| Iteration | Newton-Schritt u ← u − (dx/du) / (d²x/du²), Ableitungen nach A2.3 und A3.2 |
| Intervall | Parameter der beiden benachbarten Dateipunkte; ein Schritt außerhalb wird zu einem Bisektionsschritt nach dem Vorzeichen von dx/du |
| Abbruch | \|dx/du\| < 1e-14, Schritt < 1e-14 oder 50 Iterationen |
| Rückfall | ist x(u_LE) größer als x des Dateipunkts mit minimalem x, gilt der Parameter dieses Dateipunkts |

### 1.4 Prüfung auf Selbstüberschneidung

Eine kubische Kurve kann zwischen Dateipunkten, die jede Plausibilitätsprüfung bestehen, eine Schleife
bilden, z. B. hinter der Endleiste einer grob aufgelösten Datei. Dieselbe Prüfung läuft für jede
Profilkurve und für die Flächenzeilen (Abschnitt 4).

| Eigenschaft | Profilkurve | Flächenzeile |
| --- | --- | --- |
| Kurve | NURBS-Kurve aus Abschnitt 1.2, normierte Koordinaten | Zeile v = konst. der Fläche S, in die x-z-Ebene projiziert |
| Geprüfte Zeilen | – | beim y jedes Profilschnitts, in der Mitte zwischen 2 benachbarten Profilschnitten und in der Mitte zwischen den 2 Stationen jedes der 64 breitesten Stationsintervalle (`MAX_STATION_ROWS`; jedes Intervall, wenn es höchstens 64 gibt; zusätzliche Stationen eingeschlossen); übrige Zeilen: Dickenprüfungen aus Abschnitt 3.6 |
| Abtastwerte je Knotenintervall | per = max(1, min(256, round(4000 · L_span / L_total))); L_span = Länge des Kontrollpolygons des Knotenintervalls (p Strecken), L_total = Summe über die nicht leeren Knotenintervalle | 4 |
| Abtastwerte insgesamt | Σ per + 1, etwa 4001 | 4 · spans + 1 |
| Test | echte Kreuzungen nicht benachbarter Polygonsegmente; jede gefundene Kreuzung wird vermessen; Kreuzungen bis zur Toleranz zählen nicht; die Suche endet nach 20 Kreuzungen über der Toleranz; die größte wird gemeldet | ebenso |
| Suche | Gitter aus etwa √n × √n Zellen über n Segmente, jede Zelle in x und in y mindestens doppelt so groß wie der Median der Segment-Begrenzungsrechtecke; nur Segmente mit einer gemeinsamen Zelle werden geprüft; eine Zelle mit mehr als 32 Segmenten erhält ein eigenes Gitter über den Bereich ihrer Segmente, höchstens 6 Ebenen tief (`selfIntersections` in `src/airfoil/geometry.js`) | ebenso |
| Größe einer Kreuzung (mittlere Breite) | die Kreuzung teilt das Polygon in 2 Teile; Teil P = der Teil mit der kleineren Diagonale des achsparallelen Hüllrechtecks; Größe = Fläche(P) / Diagonale(P), Fläche von P als geschlossenes Polygon (Gaußsche Trapezformel) | ebenso |
| Toleranz | Größe > 5e-4 der Profiltiefe (0,05 %) ist ein Fehler. Spitz auslaufende geschlossene Endleisten von 246 echten Dateien hinterlassen schmale Schleifen von höchstens 1,6e-5 der Profiltiefe (0,0016 %); die Schleife einer grob aufgelösten Datei mit 9 Punkten misst 2,5e-3 der Profiltiefe (0,25 %). Beim Flügelaufbau ist die Schleife außerdem auf 0,1 mm begrenzt (`CROSSING_LIMIT` in `src/geom/profile.js`), bei der größten Profiltiefe der Profilschnitte mit diesem Profil: Über 200 mm Profiltiefe ist eine Schleife breiter als 0,1 mm ein Fehler, und die Meldung ergänzt „the loop is … mm wide at … mm chord, above 0.1 mm.“ | Größe > min(5e-4 · c, 0,1 mm), c = Profiltiefe beim y der Zeile |
| Meldung | „the NURBS curve through the points crosses itself near x = … % chord“ | „The loft surface crosses itself at y = … mm near x = … mm“ |
| Abhilfe | eine Datei mit mehr Punkten oder feinerer Verteilung an dieser Stelle | **Settings** > **Chordwise stations per surface** erhöhen; die Meldung endet mit „Increase Settings > Chord samples.“ |

Die Profilvorschau führt die Prüfung der Profilkurve und die Prüfung auf Rücklauf in x (Abschnitt 1.5)
mit der Parametrisierung des Projekts aus (**Settings** > **Profile parametrization**) und meldet einen
Befund als Fehler `curve-shape`. Eine gescheiterte Interpolation (Abschnitt 1.2) ist ebenfalls Fehler
`curve-shape`. Die Vorschau zeigt dann **Cannot add (errors)** statt **Add to project**.

### 1.5 Rücklauf in x

Die Neuabtastung aus Abschnitt 2 löst x(u) = Zielwert je Profilseite. Eine Profilseite, die in x
zurückläuft, hat mehrere Lösungen; die Neuabtastung verliert den zurücklaufenden Teil.

| Eigenschaft | Wert |
| --- | --- |
| Abtastwerte | die Abtastwerte der Profilkurve aus Abschnitt 1.4 |
| Oberseite (u von 0 bis u_LE) | Rücklauf = x − bisheriges Minimum von x |
| Unterseite (u von u_LE bis 1) | Rücklauf = bisheriges Maximum von x − x |
| Toleranz | Rücklauf > 1e-4 der Profiltiefe (0,01 %) ist ein Fehler |
| Meldung | „the surface runs back in x by … % chord near x = … % chord“ |

## 2. Gemeinsame Tiefenstationen

Jedes Profil wird an denselben N + 1 Tiefenanteilen je Profilseite abgetastet. Die Verteilung ist
kosinusförmig: am feinsten an Nasen- und Endleiste.

```
s_k = (1 − cos(π k / N)) / 2          k = 0 … N
```

| N | Kleinster Schritt (an Nase und Endleiste) | Größter Schritt (Profilmitte) | Punkte je Profilschnitt |
| --- | --- | --- | --- |
| 16 | 0,961 % der Profiltiefe | 9,75 % der Profiltiefe | 33 |
| 60 (Vorgabe) | 0,0685 % der Profiltiefe | 2,62 % der Profiltiefe | 121 |
| 200 | 0,00617 % der Profiltiefe | 0,785 % der Profiltiefe | 401 |

Je Profilseite wird u aus x(u) = Zielwert auf dem Kurvenast bestimmt:

```
Oberseite:  Zielwert = x_LE + s_k (x(0) − x_LE)     u in [0, u_LE]
Unterseite: Zielwert = x_LE + s_k (x(1) − x_LE)     u in [u_LE, 1]
```

| Eigenschaft des Lösers | Wert |
| --- | --- |
| Verfahren | Regula falsi (Sekantenschritt im Intervall) |
| Bisektionsschritt | ersetzt den Sekantenschritt in jeder dritten Iteration und immer dann, wenn der Sekantenpunkt das Intervall verlässt |
| Abbruch | \|x(u) − Zielwert\| ≤ 1e-13, Intervallbreite ≤ 1e-13 oder 200 Iterationen (dann die Intervallmitte) |
| Kein Vorzeichenwechsel im Intervall | das Intervallende mit dem kleineren \|x(u) − Zielwert\| |

- k = 0 ist die Profilnase der Kurve, k = N der Kurvenendpunkt. Beide werden ohne Lösen übernommen.
- Ergebnis: 2N + 1 Punkte. Index 0 … N: Oberseite Endleiste → Nase. Index N … 2N: Unterseite
  Nase → Endleiste. Die Profilnase hat den Index N.

Einheitstiefe (`unitChord` in `src/geom/wing.js`):

```
x_TE,mid = (x_0 + x_2N) / 2
c_curve  = x_TE,mid − x_N
x_unit   = (x − x_N) / c_curve
z_unit   = (z − z_N) / c_curve
```

Ergebnis: Die NURBS-Profilnase liegt bei (0, 0), die Endleistenmitte bei x_unit = 1.

| Eigenschaft | Folge |
| --- | --- |
| Punkt k hat in jedem Profilschnitt denselben Tiefenanteil auf derselben Profilseite | Profilschnitte werden Punkt für Punkt interpoliert |
| Die Profilnase ist in jedem Profilschnitt Punkt N | die Nasenleiste liegt auf einem Flächenparameter u_LE |

Einschränkung: x(u) muss von der Profilnase zu jedem Endleistenendpunkt monoton steigen. Ein Rücklauf
über 1e-4 der Profiltiefe ist ein Fehler (Abschnitt 1.5). Bei einem kleineren Rücklauf liefert der
Löser für die betroffenen Stationen eine von mehreren Lösungen. Die Warnung `non-monotonic` der
Plausibilitätsprüfungen prüft nur die Dateipunkte (x-Abnahme > 1e-6 der Profiltiefe zwischen
benachbarten Punkten einer Profilseite), nicht die Kurve. Der Fehler `folds` der
Plausibilitätsprüfungen weist ein Profil ab, dessen Ober- oder Unterseite an mehr als 50 Punkten in x
zurückläuft: „The upper surface runs back in x at … points; the limit is 50.“ (Unterseite ebenso).

## 3. Stationen in Spannweitenrichtung

### 3.1 Interpolation der Schnittwerte

Jede Größe f eines Profilschnitts (x, z, Profiltiefe, Schränkung und die 2N + 1 Konturpunkte) wird als
gewichtete Summe mit Gewichten w_i(y) interpoliert:

```
f(y) = Σ_i w_i(y) f_i          Σ_i w_i(y) = 1
```

| **Spanwise interpolation** | Gewichte w_i(y) | Bedingung |
| --- | --- | --- |
| **Linear between sections (straight panels)** (linear, gerade Felder) | Hutfunktionen: linear zwischen den beiden benachbarten Profilschnitten | jede Anzahl von Profilschnitten |
| **Smooth (natural cubic spline through sections)** (glatt) | Kardinalfunktionen eines natürlichen kubischen Splines durch die Schnittpositionen y_i (zweite Ableitung 0 an Wurzel und Rand) | 3 oder mehr Profilschnitte; bei 2 Profilschnitten gelten die Hutfunktionen |

- y außerhalb von [y_root, y_tip] wird auf den Bereich begrenzt.
- **Smooth**: Die Berechnung wertet den Spline jedes überblendeten Werts direkt aus. Ein
  Tridiagonalsystem der Größe Profilschnitte − 2 (Thomas-Algorithmus, ohne Pivotsuche; das System
  ist diagonaldominant) liefert die zweiten Ableitungen aller Werte an den Profilschnitten, eine
  rechte Seite je Wert. n Profilschnitte mit m Werten: einmal O(n · m) Rechenschritte, dann O(m) je
  Spannweitenposition aus den beiden benachbarten Profilschnitten. Das Ergebnis gleicht der
  gewichteten Summe mit den Kardinalfunktionen bis auf Rundungsfehler.
- **Smooth**: Die Kardinalfunktionen verlassen zwischen den Profilschnitten den Bereich [0, 1]
  (3 gleich verteilte Profilschnitte: kleinstes Gewicht −0,096). Große Dicken- oder Tiefenänderungen
  und ungleiche Abstände verstärken das Überschwingen.
- **Smooth**, Fehler beim Aufbau (Abschnitt 3.6): ein interpolierter Wert liegt um mehr als das 2-Fache
  des Bereichs seiner Schnittwerte außerhalb dieses Bereichs; eine negative interpolierte Dicke; ein
  interpoliertes x der Profilnase, x der Endleiste oder z außerhalb von ±1 200 000 mm oder eine
  Profiltiefe über 100 000 mm.

### 3.2 Lage der Stationen

| Bedingung | Stationen je Feld | Verteilung im Feld | Grad der Fläche entlang v |
| --- | --- | --- | --- |
| **Linear**, keine Leitkurve eingeschaltet | 1 (der Profilschnitt) | – | 1 |
| **Linear**, eine Leitkurve eingeschaltet | K (der Profilschnitt und K − 1 Zwischenstationen) | kosinusförmig | min(3, K): 3 bei K ≥ 3; 2 oder 1, wenn die Gittergrenze des Lofts K auf 2 oder 1 senkt |
| **Smooth** | K (der Profilschnitt und K − 1 Zwischenstationen) | kosinusförmig | 3 (Stationen − 1 bei weniger als 4 Stationen) |

Der Randschnitt ist die letzte Station. Anzahl der Stationen bei K je Feld: (Profilschnitte − 1) · K + 1,
dazu die zusätzlichen Stationen unten (in jedem Modus).
Beispiel: Vorlage **Glider** (Segelflugmodell), 3 Profilschnitte, K = 8: 17 Stationen.

```
y_(i,k) = y_i + (y_(i+1) − y_i) (1 − cos(π k / K)) / 2          k = 0 … K − 1
```

Unterscheidbare Spannweitenanteile: a < b sind unterscheidbar, wenn b − a > max(4 ε · max(|a|, |b|), 2^-1021),
ε = 2^-52 (`paramsApart` in `src/geom/nurbs.js`). Zwei nicht unterscheidbare Profilschnitte sind ein Fehler;
eine Zwischenstation, die von der letzten behaltenen Station oder vom Rand nicht unterscheidbar ist, entfällt;
Leitkurven im Modus Durchgangspunkte wenden dieselbe Regel auf das normierte y ihrer Punkte an.

Flächengitter (`loftGrid` in `src/model/budget.js`): Stationen mal Konturpunkte vor dem Einfügen
zusätzlicher Stationen, ((Profilschnitte − 1) · K + 1) · (2N + 1) Punkte. **Linear** ohne Leitkurve
verwendet K_set = 1. Die Grenzen gelten in jedem Modus.

| Größe | Wert |
| --- | --- |
| Warnschwelle | über 60 000 Gitterpunkten (`WARN.gridPoints`): Der Aufbau ergänzt die Warnung „Large project: …“ mit „… loft grid points (warning above 60,000)“ und der erwarteten Zeit und dem Browser-Speicher jeder Änderung. **Settings** zeigt unter den Auflösungsfeldern „Loft grid: … points.“, über 60 000 mit Zeit und Speicher. |
| Grenze | 5 000 000 Gitterpunkte (`LIMITS.maxGridPoints` in `src/model/project.js`); darüber geht einem Browser-Tab auf einem Desktop-Rechner der Speicher aus |
| Verwendetes K | max(1, min(K_set, floor((5 000 000 / (2N + 1) − 1) / (Profilschnitte − 1)))), das größte K, dessen Gitter ((Profilschnitte − 1) · K + 1) · (2N + 1) höchstens 5 000 000 Punkte hat; K_set = Wert in **Settings**. K < K_set nur über 5 000 000 Gitterpunkten. |
| Warnung (K < K_set) | „Spanwise stations per panel reduced from K_set to K: S sections with N chord samples keep the loft within 5,000,000 grid points.“ |
| Fehler (mehr als 5 000 000 Gitterpunkte mit dem verwendeten K) | „The loft grid needs P points with one station per panel (S sections, N chord samples); the limit is 5,000,000. Reduce the chord samples or the sections.“ Es wird keine Fläche aufgebaut. |
| Beispiel | 200 Profilschnitte, K_set = 8, N = 60 (Vorgaben): K = 8, 1593 Stationen, 192 753 Gitterpunkte: Warnung mit Zeit und Speicher |
| Beispiel | 2000 Profilschnitte, K_set = 8, N = 200: K = 6, 11 995 Stationen, 4 809 995 Gitterpunkte |
| Beispiel | 4200 Profilschnitte, K_set = 8, N = 200, **Linear** mit einer Leitkurve: K = 2, 8399 Stationen, 3 367 999 Gitterpunkte; Grad der Fläche entlang v 2 |
| Beispiel | 20 000 Profilschnitte, N = 200, jeder Modus: K = 1, 8 020 000 Gitterpunkte: Fehler |

Zusätzliche Stationen: Die Fläche verläuft nur durch die Stationen. Zwischen den Stationen kann sie
von der vorgesehenen Fläche abweichen, auch durch Schränkung. Nach der Flächenanpassung (Abschnitt 4)
vergleicht der Aufbau Flächenpunkte mit den Punkten einer bei y platzierten Station (Abschnitte 3.4,
3.7, 3.8), im Raum (`probe` in `src/geom/wing.js`).

| Parameter | Wert |
| --- | --- |
| Verglichene Konturpunkte j | N (Profilnase), 0 (oberer Endleistenpunkt), N − k (Oberseite) und N + k (Unterseite) für k = s, 2s, … < N; s = max(1, floor(N / 6)) |
| Verglichene Tiefenstationen je Profilseite | N = 16: 7. N = 60: 5 (k = 10, 20, 30, 40, 50; s_k = 6,7 %, 25 %, 50 %, 75 %, 93,3 % der Profiltiefe). N = 200: 6. |
| Abweichung bei y | Maximum über j von \|S(u_j, v) − P_j\|, Abstand im Raum; u_j = Flächenparameter des Konturpunkts j (Abschnitt 4), P_j = Punkt j der bei y platzierten Station |
| Toleranz | min(0,5 mm; 0,1 · c(y)) |
| Einfügen | Abweichung an jeder Prüfposition y aus Abschnitt 3.6; je eine Station an jedem lokalen Maximum von Abweichung / Toleranz, an dem die Abweichung die Toleranz überschreitet (die Toleranz schrumpft mit der Profiltiefe, sodass die größte Abweichung unter ihrer Toleranz liegen kann, während kleinere weiter außen ihre überschreiten); eine neue Station hält mindestens 1e-6 · (y_tip − y_root) Abstand zu jeder anderen Station |
| Grenze | 6 Durchläufe, insgesamt 32 zusätzliche Stationen; über 60 000 Gitterpunkten (`WARN.gridPoints`) 1 Durchlauf, denn jeder Durchlauf passt den ganzen Loft neu an |
| Behaltene Anpassung | von den Anpassungen vor und nach jedem Durchlauf die mit dem kleinsten Maximum über die Prüfpositionen von Abweichung / Toleranz; bei Gleichstand die frühere. Dicht beieinander hinzugefügte Stationen können die kubische Anpassung ausschwingen lassen: 2 Profilschnitte, Nasenlinie mit einer Beule von 4 mm Höhe und 0,06 mm Breite (Kontrollpunkte): 3,67 mm ohne zusätzliche Stationen, 18 797 mm nach 32 zusätzlichen Stationen; der Aufbau behält die erste Anpassung und warnt |
| Nach der letzten Anpassung | Profiltiefe und örtliche Dicke der angepassten Fläche (Abschnitt 3.6) zusätzlich bei 0,25, 0,5 und 0,75 jedes Stationsintervalls (Viertelpunkte); sie gehen nur in die Fehler aus Abschnitt 3.6 ein: Dort wird keine Station eingefügt, und die Abweichung dort geht nicht in die Warnung ein |
| Abweichung über der Toleranz an einer Prüfposition | Warnung mit der größten Abweichung an den Prüfpositionen, deren y und Anzahl der zusätzlichen Stationen; Abhilfe: K erhöhen |

Derselbe Vergleich liefert die Profiltiefe und die örtliche Dicke der angepassten Fläche (Abschnitt 3.6).

Beispiel: Vorlage **Swept flying wing** (3 Profilschnitte, **Linear**, Schränkung am Rand −4°):
2 zusätzliche Stationen bei y = 150,0 mm und y = 450,0 mm. Dieselbe Vorlage mit Schränkung am Rand 0°:
keine zusätzliche Station.

Spitze elliptische Flügelenden (Assistent: **Planform** = **Elliptic (guide curves)**, **Tip** =
**Pointed (1/200 scale)**), jede Vorlage: 5 bis 9 zusätzliche Stationen. Größte Abweichung an den
Prüfpositionen: 0,077 mm (**Tail surface**) bis 0,371 mm (**Swept flying wing**), unter der
Toleranz; keine Warnung. Nasenlinie und Endlinie enden ein Viertel und drei Viertel der Randtiefe um
die Pfeillinie, sodass der Randschnitt seinen Viertelpunkt auf dieser Linie behält. Innerhalb von
2 mm vor dem Flügelende weichen x von Nasen- und Endleiste der Fläche höchstens 0,031 mm
(**Swept flying wing**; 2001 Spannweitenpositionen) vom vorgesehenen Grundriss ab; die übrigen
Konturpunkte dort sind nicht gemessen, und die Warnung erfasst diese Positionen nicht.

### 3.3 Leitkurven

Nasenlinie (Nasenleiste) und Endlinie (Endleiste): ebene B-Spline-Kurven in der Grundrissebene (x, y),
Punkte P_0 … P_n.

| Eigenschaft | **Through points** (`fit`, durch Punkte) | **Control points** (`control`, Kontrollpunkte) |
| --- | --- | --- |
| Rolle der Punkte | die Kurve verläuft durch sie | Kontrollpolygon |
| Parameter | proportional zu y: t_k = (y_k − y_0) / (y_n − y_0) | – |
| Knotenvektor | geklemmt, durch Mittelwertbildung (Gl. 9.8) | geklemmt, gleichabständig, innere Knoten j / (n − p + 1) (Gl. 9.7) |
| **Degree** (Grad) | 1 bis 5, Vorgabe 3, höchstens n | 1 bis 5, Vorgabe 3, höchstens n |

Bedingungen (Verletzung = Fehler, keine Fläche):

- mindestens 2 Punkte, alle Werte endlich
- y von Punkt zu Punkt streng steigend
- y(t) nicht fallend, geprüft an 401 Parametern mit Toleranz 1e-9 mm
- x jedes Kontrollpunkts der Kurve innerhalb von ±1 200 000 mm (`LIMITS.maxExtent`); bei
  **Through points** sind das die Kontrollpunkte, die die Interpolation berechnet. Ein B-Spline liegt
  in der konvexen Hülle seiner Kontrollpunkte, daher bleibt die ganze Kurve in dieser Grenze. Meldung:
  „Nose line: the curve through the points reaches x = … mm, beyond ±1200000 mm; space the points
  more evenly in y or use control-point mode.“ (Endlinie: „End line: …“)

Mit **Through points** ist y(t) linear in t, weil ein Spline lineare Funktionen exakt wiedergibt.

Abbildung auf die Spannweite: Der y-Bereich der Leitkurve [y_first, y_last] wird linear auf
[y_root, y_tip] gestreckt.

```
f   = clamp((y − y_root) / (y_tip − y_root), 0, 1)
t   = Lösung von (y(t) − y_first) / (y_last − y_first) = f
      (Löser aus Abschnitt 2 auf dem normierten y, bis das t-Intervall höchstens 1e-15 breit ist)
x   = x(t)
```

**Reset to sections** (auf Schnitte zurücksetzen) setzt die Punkte der Leitkurve auf die Kanten der
Profilschnitte:

| Leitkurve | Punkt je Profilschnitt |
| --- | --- |
| Nasenlinie | (x, y) der Profilnase |
| Endlinie | (x + c, y) der Endleiste |

Eine ausgeschaltete Leitkurve ohne Bearbeitung folgt diesen Punkten ([[Dateiformate|Dateiformate]],
Abschnitt `guides.nose`, `guides.end`). x eines Leitkurvenpunkts ist auf ±1 100 000 mm begrenzt
(`LIMITS.maxGuideCoordinate`): x eines Profilschnitts bis 1 000 000 mm plus eine Profiltiefe bis
100 000 mm.

![Grundriss-Editor, Vorlage Glider: Nasenlinie und Endlinie eingeschaltet; Kasten der Nasenlinie mit Use guide curve, Mode Through points, Degree 3, Reset to sections und Punkttabelle](images/planform.png)

Registerkarte **Planform** (Grundriss), Vorlage **Glider**. Bedienelemente: [[Benutzerhandbuch|Benutzerhandbuch]],
Abschnitt Grundriss.

### 3.4 Lage der Profilnase und Profiltiefe je Station

| Eingeschaltete Leitkurven | x_LE | Profiltiefe c |
| --- | --- | --- |
| keine | interpoliertes x | interpolierte Profiltiefe |
| Nasenlinie | x der Nasenlinie | interpolierte Profiltiefe |
| Endlinie | x der Endlinie − c | interpolierte Profiltiefe |
| beide | x der Nasenlinie | x der Endlinie − x der Nasenlinie |

z und Schränkung werden immer interpoliert.

### 3.5 Flügelende

| **Wing tip** | Geometrie |
| --- | --- |
| **Flat (cut at the tip section)** (flach, am Randschnitt abgeschnitten) | der Flügel endet am Randschnitt mit einer ebenen Abschlussfläche |
| **Pointed (tip profile scaled down)** (spitz, Randprofil verkleinert) | der Randschnitt erhält die Profiltiefe c_tip (Vorgabe 1/200 von c(y_prev), mindestens 1 mm); der Flügel endet mit einer ebenen Abschlussfläche der Profiltiefe c_tip; mit beiden Leitkurven ist die Randtiefe der Abstand der Leitkurven bei y_tip, mindestens c_tip |

Spitzes Flügelende:

```
c_tip = max(r · c(y_prev), 1 mm)
```

| Größe | Wert |
| --- | --- |
| y_prev | Spannweitenposition des vorletzten Profilschnitts |
| c(y_prev) | Profiltiefe dort, nach Anwendung der Leitkurven |
| r | 1 / q. q: Wert von **Tip profile scale 1 : N of the previous section chord**. Bereich 100 bis 1000, Schritt 50, Vorgabe 200 (r = 0,005). |
| c_tip = 1 mm (r · c(y_prev) < 1 mm) | die Tabelle **Sections** zeigt `(min.)` hinter der Randtiefe; entfällt, wenn die Warnung unten greift |
| Letztes Feld | eine Profiltiefe unter c_tip und über −0,01 mm wird auf c_tip angehoben |
| Warnung | beide Leitkurven eingeschaltet und die Randtiefe (x der Endlinie − x der Nasenlinie bei y_tip) größer als c_tip + 0,5 mm; der Flügel endet dann mit dieser Profiltiefe; die Meldung nennt beide Werte |

Beispiel: Vorlage **Glider** (Leitkurven enden 90 mm voneinander entfernt) mit **Wing tip** =
**Pointed**: c_tip = 1 mm, Randtiefe 90 mm, Warnung „nose line and end line end 90.0 mm apart, so the
tip chord is 90.0 mm instead of 1.00 mm“.

### 3.6 Prüfungen beim Aufbau

Prüfpositionen y:

- jede Station aus Abschnitt 3.2
- 257 gleichmäßig verteilte Positionen: y_root + (y_tip − y_root) k / 256, k = 0 … 256
- y jedes Kontrollpunkts einer Leitkurve und des Kurvenpunkts an jedem Knoten, linear auf
  [y_root, y_tip] abgebildet

Dicke an einer Prüfposition als Anteil der Profiltiefe (oberer minus unterer Punkt an derselben
Tiefenstation):

```
t_k = z_unit,(N−k) − z_unit,(N+k)          k = 1 … N − 1
```

Tiefenstationen hinter 99 % der Profiltiefe (s_k > 0,99): Ein negatives t_k mit einem Betrag bis
min(1e-4, 0,1 mm / c) zählt als 0. Die neu abgetastete Endleiste eines spitz auslaufenden Profils kann
in einer Kreuzungsschleife liegen, die die Kurvenprüfung aus Abschnitt 1.4 zulässt (Schleifen mit einer
mittleren Breite bis 5e-4 der Profiltiefe, höchstens 0,1 mm).

Positionen der angepassten Fläche: die Prüfpositionen und die Viertelpunkte 0,25, 0,5 und 0,75 jedes
Stationsintervalls nach der letzten Anpassung (Abschnitt 3.2).

Örtliche Dicke der angepassten Fläche bei y, für die verglichenen Tiefenstationen k aus Abschnitt 3.2:
die Flächenpunkte S(u_(N−k), v) und S(u_(N+k), v), zurückgerechnet in das System mit Einheitstiefe der
Station bei y (Verschiebung, Tiefenmaßstab und Schränkung rückgängig gemacht), oberes z minus unteres z.

Prüfungen in der Reihenfolge des Codes. Jede Zeile ist ein Fehler; es wird keine Fläche aufgebaut.

| Prüfung | Bedingung |
| --- | --- |
| Anzahl der Profilschnitte | weniger als 2 Profilschnitte |
| Projektgrenzen | Profiltiefe eines Profilschnitts über 100 000 mm, x, y oder z eines Profilschnitts außerhalb von ±1 000 000 mm, Schränkung außerhalb von ±360°, mehr als 20 000 Profilschnitte, oder eine Leitkurve (ein- oder ausgeschaltet) mit mehr als 20 000 Punkten, einem Punkt mit x außerhalb von ±1 100 000 mm oder y außerhalb von ±1 000 000 mm. Dieselben Grenzen wie bei **Open** (`limitErrors` in `src/model/project.js`); ein Projekt, das nicht gespeichert werden kann, kann daher nicht exportiert werden. Jede überschrittene Grenze ergibt eine Meldung, z. B. „Section 3: twist must be within ±360 degrees.“ oder „Section 2: chord must be at most 100000 mm.“ Mehr als 20 000 Profilschnitte: nur die Meldung „At most 20,000 sections are supported (found N).“, die Profilschnitte werden nicht gelesen. Eine Leitkurve mit mehr als 20 000 Punkten: „guides.nose.points: at most 20,000 points (found N).“ (Endlinie: `guides.end.points`). |
| Seite der Wurzel | erster Profilschnitt (nach Sortierung nach y) bei y < 0: „lies on the mirrored side“ |
| Lage der Profilschnitte | 2 Profilschnitte mit demselben y |
| Profilverweis | ein Profilschnitt verweist auf eine Profil-ID, die im Projekt fehlt |
| Profil | Fehler der Plausibilitätsprüfungen, fehlgeschlagene NURBS-Interpolation, sich selbst überschneidende NURBS-Kurve (Abschnitt 1.4) oder Rücklauf in x (Abschnitt 1.5). Bei Parametrisierung **Chord length** oder **Uniform** endet die Meldung mit „Settings > Profile parametrization "centripetal" follows the points more closely.“ |
| Leitkurven | eine Bedingung aus Abschnitt 3.3 verletzt |
| Flächengitter | mehr als 5 000 000 Gitterpunkte mit den verwendeten Stationen je Feld (Abschnitt 3.2) |
| Schnittwerte | x_LE, c, z oder cos(Schränkung) einer Prüfposition ist keine endliche Zahl. Meldung: „Section values give non-finite coordinates at y = … mm; check the positions, chords and twists of the sections.“ |
| Ausdehnung der Geometrie | an einer Prüfposition: x_LE, x_LE + c (Endleiste) oder z außerhalb von ±1 200 000 mm (`LIMITS.maxExtent`) oder c über 100 000 mm. Ursachen: Überschwingen bei **Smooth**; eine Leitkurve nahe ±1 200 000 mm, bei der die hinzugerechnete oder abgezogene Profiltiefe die Ausdehnung verlässt; Nasenlinie und Endlinie mehr als 100 000 mm voneinander entfernt. Meldung: „At y = … mm the wing leaves the project limits (leading-edge x … mm, z … mm, chord … mm; limits ±1200000 mm and 100000 mm chord). Check the guide curves, or use linear interpolation.“ |
| Überschwingen bei **Smooth** | Nur **Smooth**. An einer Prüfposition liegt ein interpolierter Wert um mehr als 2 × (max − min) seiner Schnittwerte außerhalb von [min, max] (`OVERSHOOT_LIMIT` = 2). Werte: x_LE (keine Leitkurve eingeschaltet), Profiltiefe (nicht beide Leitkurven eingeschaltet), z, Schränkung und die Höhe z_unit jedes Konturpunkts k = 1 … 2N − 1. Die Meldung nennt den Wert mit dem größten Überschwingen (`leading-edge x`, `chord`, `z`, `twist`, `upper surface height at x = … % chord` oder `lower surface height at x = … % chord`), sein y, den Bereich der Schnittwerte und den kleinsten Abstand zwischen 2 Profilschnitten. Abhilfe laut Meldung: **Linear**, gleichmäßiger verteilte Profilschnitte oder weniger dicht liegende Profilschnitte. |
| Interpolierte Dicke | min t_k < −1e-9 an einer Prüfposition. **Smooth**: Überschwingen (Abschnitt 3.1); Abhilfe laut Meldung: **Linear** oder mehr Profilschnitte. **Linear**: Ober- und Unterseite eines Profils kreuzen sich an dieser Tiefenstation; Abhilfe laut Meldung: Profile prüfen oder **Chordwise stations per surface** erhöhen. Die Meldung nennt y und x. |
| Dicke nach der Einstellung **Trailing edge** | min t_k < −1e-9 nach der Änderung der Endleistendicke aus Abschnitt 3.7. Geprüft an Positionen mit c ≥ 1 mm. **Fixed thickness in mm**: Endleistendicke auf 5 % der Profiltiefe begrenzt. Ursache: Das Profil ist innen dünner als die eingestellte Endleistendicke. |
| Berührung der Profilseiten | min t_k ≤ 1e-5 (0,001 % der Profiltiefe) an den Tiefenstationen s_k von 0,01 bis 0,99, nach der Einstellung **Trailing edge** aus Abschnitt 3.7. Geprüft an Positionen mit c ≥ 1 mm. Die Meldung nennt y und x. **As in the airfoil files**: Abhilfe **Linear** oder mehr Profilschnitte; andere Modi: Abhilfe **As in the airfoil files** oder eine dickere Endleiste. |
| Profiltiefe | kleinste Profiltiefe < 1 mm; die Meldung nennt Profiltiefe und zugehöriges y |
| Profiltiefe, Hinweis | wie oben, Minimum am Rand, Profiltiefe > −0,01 mm, **Wing tip** = **Flat**: die Meldung ergänzt „set Settings > Wing tip to Pointed“ (**Settings** > **Wing tip** auf **Pointed** stellen) |
| Angepasste Fläche, endlich | nach der Flächenanpassung und den zusätzlichen Stationen (Abschnitt 4): eine Koordinate eines Kontrollpunkts ist keine endliche Zahl. Meldung: „The fitted surface has non-finite coordinates; check the positions, chords and twists of the sections.“ |
| Dicke der angepassten Fläche | an jeder Position der angepassten Fläche: örtliche Dicke < −1e-9 (hinter 99 % der Profiltiefe: < −min(1e-4, 0,1 mm / c)) an einer verglichenen Tiefenstation („The fitted surface turns inside out between stations“), oder ≤ 1e-5 (0,001 % der Profiltiefe) an einer verglichenen Tiefenstation von 1 % bis 99 % der Profiltiefe („The fitted surface has zero thickness between stations“). Die Meldung nennt y und die Dicke. Ursache laut Meldung: Die Fläche durch die Stationen schwingt zwischen ihnen aus (schnell veränderliche Leitkurven oder ungleich verteilte Profilschnitte im Modus **Smooth**). Abhilfe laut Meldung: Leitkurven glätten, Profilschnitte gleichmäßiger verteilen oder Profilschnitte hinzufügen. |
| Profiltiefe der angepassten Fläche | an jeder Position der angepassten Fläche: c_fit < 0,9 mm (1 mm Mindesttiefe abzüglich 10 %). c_fit = ((S(0, v) + S(1, v)) / 2 − S(u_LE, v)), in der x-z-Ebene auf die vorgesehene Tiefenrichtung der Station bei y projiziert. Meldung: „The fitted surface folds or narrows between stations“ |
| Selbstüberschneidung der Fläche | eine Flächenzeile an einem Profilschnitt, in der Mitte zwischen 2 benachbarten Profilschnitten oder in der Mitte zwischen den 2 Stationen eines der 64 breitesten Stationsintervalle (zusätzliche Stationen eingeschlossen) überschneidet sich in der x-z-Ebene mit einer Schleifengröße (mittlere Breite) über 5e-4 · c; 4 Abtastwerte je Knotenintervall (Abschnitt 1.4) |

### 3.7 Endleiste

Je Station, nach der Interpolation:

| **Trailing edge** | Endleistendicke g als Anteil der Profiltiefe |
| --- | --- |
| **As in the airfoil files** (`asis`, wie in den Profildateien) | interpolierte Kontur unverändert |
| **Closed (sharp)** (`closed`, geschlossen) | g = 0; beide Endpunkte rücken auf ihre Mitte |
| **Fixed thickness in mm** (`thickness`, feste Dicke) | g = t / c, t = **Trailing-edge thickness (mm)** (Vorgabe 0,4 mm), begrenzt auf 5 % der Profiltiefe |

| Projekt | **Trailing edge** | t |
| --- | --- | --- |
| Vorgabe des Projektmodells (Projektdateien ohne diese Einstellung) | **As in the airfoil files** | 0,4 mm (ungenutzt) |
| Beispielflügel „Sport wing 1500“ (erster Besuch) | **Fixed thickness in mm** | 0,5 mm |
| Projekte aus dem Assistenten | **Fixed thickness in mm** | max(0,3 mm, 0,2 % der Wurzeltiefe), auf 0,01 mm gerundet; **Glider** 0,4 mm, **Sport** 0,48 mm, **Tail surface** 0,3 mm |

Änderung der Endleistendicke: Die Oberseite verschiebt sich um die halbe Änderung nach oben, die Unterseite
nach unten. Das Gewicht steigt linear von 0 an der Profilnase auf 1 an der Endleiste; die Profilnase
bleibt an ihrem Ort.

```
δ = (g − g_current) / 2
w = clamp((x − x_LE) / (x_TE,branch − x_LE), 0, 1)
Oberseite:  z ← z + δ w
Unterseite: z ← z − δ w
```

Eine negative Dicke nach dieser Änderung ist ein Fehler beim Aufbau (Abschnitt 3.6).

Topologie der Endleiste über alle Stationen:

| Stationen | Endleiste der Fläche |
| --- | --- |
| \|Endleistendicke\| < 1e-6 mm an jeder Station | geschlossen: beide Endpunkte an jeder Station zusammengelegt |
| sonst | offen: jede Station mit einer Endleistendicke unter min(0,01 mm, 5 % von c) wird auf diesen Wert geöffnet |

| Warnung | Bedingung |
| --- | --- |
| Dicke begrenzt | t / c > 5 % an 1 oder mehr Stationen; Stationen im letzten Feld eines spitzen Flügelendes zählen nicht |
| Stationen geöffnet | offene Endleiste und 1 oder mehr Stationen mit einer Endleistendicke unter dem Minimum |

### 3.8 Platzierung im Raum

Punkt mit Einheitstiefe (x_unit, z_unit) aus Abschnitt 2, Schränkung θ, Drehpunkt f_pivot. Die
Drehachse liegt parallel zu y durch den Punkt (x_unit, z_unit) = (f_pivot, 0). Der Profilschnitt liegt
in der Ebene Y = y.

```
dx  = x_unit − f_pivot
r_x =  dx cos θ + z_unit sin θ
r_z = −dx sin θ + z_unit cos θ
X = x_LE + c (f_pivot + r_x)
Y = y
Z = z + c r_z
```

## 4. Fläche

Tensorprodukt-B-Spline-Fläche S(u, v) durch das Stationsgitter Q (2N + 1 Punkte je Station).

| Richtung | Parameter | Grad | Knotenvektor |
| --- | --- | --- | --- |
| u (um das Profil) | Mittel der Parametrisierungen aller Stationen; u_0 = 0, u_2N = 1 | 3 | geklemmt, durch Mittelwertbildung |
| v (Spannweite), **Linear** | v = (y − y_root) / (y_tip − y_root) | 1 ohne Leitkurven; mit einer Leitkurve min(3, K) (2 oder 1, wenn die Gittergrenze des Lofts K senkt, Abschnitt 3.2) | eine Interpolation je Feld; Felder an den Profilschnitten mit innerer Knotenvielfachheit p verbunden (C0: stetig in der Lage, Knicke an den Profilschnitten) |
| v (Spannweite), **Smooth** | ebenso | 3 (Stationen − 1 bei weniger als 4 Stationen) | eine Interpolation über alle Stationen, Mittelwertbildung (C2: stetig bis zur zweiten Ableitung) |

Ablauf:

1. Jede Stationszeile entlang u interpolieren (eine Band-LU-Zerlegung gilt für alle Zeilen).
2. Jede Spalte der erhaltenen Kontrollpunkte entlang v interpolieren (Band-LU, Abschnitt 1.2).
3. y der Kontrollpunkte bei v = 0 auf y_root und bei v = 1 auf y_tip setzen (entfernt Rundungsfehler des Lösers).

Eigenschaften:

- S verläuft durch jeden Stationspunkt: S(u_j, v_k) = Q_(j,k).
- Die Isokurve u = u_LE verläuft durch die Profilnase jeder Station.
- Kontrollpunkte je Halbflügel: (2N + 1) × Stationen.
- Die Flächenzeilen an jedem Profilschnitt, in der Mitte zwischen benachbarten Profilschnitten und in
  der Mitte zwischen den Stationen der 64 breitesten Stationsintervalle werden auf
  Selbstüberschneidung geprüft (Abschnitt 1.4).

![3D-Ansicht der Vorlage Swept flying wing mit dem NURBS-Kontrollnetz](images/flying-wing-control-net.png)

Vorlage **Swept flying wing** (Pfeilnurflügel; 3 Profilschnitte, 2 zusätzliche Stationen, **Linear**,
keine Leitkurve) mit **Settings** > **Show NURBS control net**. Die 121 Netzlinien entlang der Spannweite liegen in diesem
Maßstab so dicht, dass sie als Schattierung erscheinen.

| Vorlage des Assistenten (N = 60, K = 8) | Stationen | Kontrollpunkte je Halbflügel | Grad u × v |
| --- | --- | --- | --- |
| **Sport** (Sportmodell) | 2 | 121 × 2 | 3 × 1 |
| **Swept flying wing** (Pfeilnurflügel) | 5 (2 zusätzlich, Abschnitt 3.2) | 121 × 5 | 3 × 1 |
| **Glider** (Segelflugmodell, elliptische Leitkurven, **Tip** = **Flat**) | 17 | 121 × 17 | 3 × 3 |
| **Glider** (Segelflugmodell, elliptische Leitkurven, **Tip** = **Pointed (1/200 scale)**) | 22 (5 zusätzlich, Abschnitt 3.2; größte Abweichung 0,263 mm, keine Warnung) | 121 × 22 | 3 × 3 |

## 5. Dreiecksnetze

Dreiecksnetze für den Export als STL (Stereolithografie) und 3MF (3D Manufacturing Format) und für die
3D-Ansicht.

| Richtung | Abtastung |
| --- | --- |
| u | Stationsparameter u_j; jedes Intervall in d Teile geteilt |
| v | Stationsparameter v_k; jedes Intervall in r · d Teile geteilt; r = 1 (Grad 1 entlang v), r = 3 (Grad 2 oder 3) |

d = **Mesh density (STL, 3MF)** (Netzdichte): 1 (**Normal**) oder 2 (**Fine (4x triangles)**, fein). Die
3D-Ansicht tastet mit d = 1 ab. Die Anzahlen unten gelten für die Exportnetze.

Anzahlen je Halbflügel (n_u = 2N · d, V = Anzahl der Abtastwerte in v):

| Größe | Offene Endleiste | Geschlossene Endleiste |
| --- | --- | --- |
| Eckpunkte je Abtastwert in v | n_u + 1 | n_u (Endleistenpunkt gemeinsam) |
| Dreiecke der Fläche | 2 n_u (V − 1) | 2 n_u (V − 1) |
| Dreiecke des Endleistenstreifens | 2 (V − 1) | 0 |
| Dreiecke je Abschlussfläche (Wurzel, Rand) | n_u − 1 | n_u − 2 |

Beispiel: Vorlage **Sport**, N = 60, d = 1, offene Endleiste: 242 Eckpunkte, 480 Dreiecke je Halbflügel.

- Orientierung: Jedes Dreieck zeigt nach außen (Normale S_v × S_u).
- Abschlussflächen: Die Konturen an Wurzel und Rand werden in der x-z-Ebene trianguliert. Oberer Punkt k
  bildet ein Paar mit unterem Punkt k (dieselbe Tiefenstation): 2 Dreiecke je Stationsintervall,
  lineare Laufzeit.
- Andere Diagonale: Läuft ein Dreieck eines Vierecks nicht gegen den Uhrzeigersinn, verwendet das
  Viereck seine andere Diagonale (verfeinerte Tiefenstationen bilden keine genauen Paare). Mit nur einer
  Diagonale fällt eine Abschlussfläche bei **Fine** mit geschlossener Endleiste (NACA 4415, 200
  Tiefenstationen je Profilseite) auf Ear Clipping zurück: 2,2 s.
- Rückfall für Abschlussflächen: Ear Clipping (Abschneiden von Ohren). Er greift, wenn ein Viereck mit
  keiner der beiden Diagonalen nur Dreiecke gegen den Uhrzeigersinn ergibt. Er greift auch, wenn die
  Dreiecksflächen um mehr als 1e-9 (relativ) von der Konturfläche abweichen. Beide Flächen werden relativ
  zu einem Eckpunkt der Kontur summiert, sodass ein Flügel 1 000 000 mm vom Ursprung entfernt die
  Streifen behält.
- Linker Halbflügel: y → −y, Umlaufsinn der Dreiecke umgekehrt.

| **Wing halves** | Hüllen |
| --- | --- |
| **Both halves as separate bodies** (beide Hälften als getrennte Körper) | 2 geschlossene Hüllen, Abschlussflächen an der Wurzel enthalten |
| **Full wing as one body (mesh formats, root at y = 0)** (ganzer Flügel als ein Körper) | Wurzel bei genau y = 0 mm: 1 geschlossene Hülle, die Hälften teilen die Wurzelpunkte, keine Abschlussflächen an der Wurzel; sonst 2 Hüllen |
| **Right half only** (nur rechte Hälfte) | 1 geschlossene Hülle |

## 6. STEP-Topologie

Datei im Format STEP nach ISO 10303 (ISO: International Organization for Standardization), Schema AP214 (Application Protocol 214). Jeder Halbflügel ist ein
`MANIFOLD_SOLID_BREP` (Volumenkörper in Randdarstellung, boundary representation) mit einer
`CLOSED_SHELL`. Namen der Volumenkörper: `<name> right`, `<name> left`. Kopfdaten, Einheiten und
Toleranz: [[Dateiformate|Dateiformate]].

| **Wing halves** | Volumenkörper |
| --- | --- |
| **Right half only** | 1 |
| beide anderen Optionen | 2 (im STEP-Export werden die Hälften nie zusammengefügt) |

Teilung: Die Fläche wird bei u_LE durch Knoteneinfügen (A5.1) bis zur Vielfachheit 3 in jeder v-Spalte
geteilt. Ein Teilungsparameter näher als 1e-10 an einem vorhandenen Knoten wird auf diesen Knoten
gesetzt. Beide Teile erhalten auf [0, 1] normierte Knotenvektoren.

| Teil | u = 0 | u = 1 |
| --- | --- | --- |
| Oberseite | obere Endleiste | Profilnase |
| Unterseite | Profilnase | untere Endleiste |

Flächen (Topologie) des rechten Halbflügels; (+) = Kante in eigener Richtung, (−) = umgekehrt:

| Fläche | Geometrie | Kantenschleife |
| --- | --- | --- |
| Oberseite | `B_SPLINE_SURFACE_WITH_KNOTS`, Grad 3 × Grad entlang v | obere Endleiste (+), Rand oben (+), Nasenleiste (−), Wurzel oben (−) |
| Unterseite | `B_SPLINE_SURFACE_WITH_KNOTS`, Grad 3 × Grad entlang v | Nasenleiste (+), Rand unten (+), untere Endleiste (−), Wurzel unten (−) |
| Endleiste (nur offene Endleiste) | B-Spline-Regelfläche, Grad 1 in u (Knotenvektor (0, 0, 1, 1)) zwischen der unteren und der oberen Endleisten-Kontrollpunktzeile | untere Endleiste (+), Randlinie (+), obere Endleiste (−), Wurzellinie (−) |
| Abschlussfläche Wurzel | `PLANE`, Normale −y, Ursprung an der Profilnase der Wurzel | Wurzel oben (+), Wurzel unten (+), Wurzellinie (+, nur offene Endleiste) |
| Abschlussfläche Rand | `PLANE`, Normale +y, Ursprung an der Profilnase am Rand | Rand unten (−), Rand oben (−), Randlinie (−, nur offene Endleiste) |

| Endleiste | Flächen | Kanten | Knoten (Topologie) |
| --- | --- | --- | --- |
| Geschlossen | 4 | 6 | 4 |
| Offen | 5 | 9 | 6 |

- Geschlossene Endleiste: Obere und untere Endleiste sind eine Kante mit 2 gemeinsamen Knoten (Topologie).
- Kanten einer B-Spline-Fläche: die exakte Rand-Isokurve dieser Fläche (erste oder letzte
  Kontrollpunktzeile oder -spalte).
- Typ der Kantenkurven: `B_SPLINE_CURVE_WITH_KNOTS`. Wurzellinie und Randlinie haben den Grad 1.

Orientierungsflags:

| Flag | Rechter Halbflügel | Linker Halbflügel (gespiegelt) |
| --- | --- | --- |
| `same_sense` der B-Spline-Flächen | `.F.` (S_u × S_v zeigt nach innen) | `.T.` |
| `same_sense` der ebenen Flächen | `.T.` | `.T.` |
| Orientierung von `FACE_OUTER_BOUND` | `.T.` | `.F.` (jede Schleife umgekehrt) |
| Normale der Ebene | Wurzel −y, Rand +y | als Vektoren gespiegelt: Wurzel +y, Rand −y (nach außen) |

Prüfung: `scripts/validate_step.py` liest die von `scripts/export-step-cases.mjs` geschriebenen Dateien
mit OpenCascade. Fälle: die 8 Fälle aus `test/step-cases.js`.

Bestehenskriterien je Datei:

- Lesestatus `IFSelect_RetDone`
- Anzahl der Volumenkörper = erwartete Anzahl: 2; `root-offset-half` (**Right half only**): 1
- je Volumenkörper: `BRepCheck_Analyzer` meldet ihn gültig
- je Volumenkörper: Hülle geschlossen (keine freien Kanten, keine fehlerhafte Orientierung)
- je Volumenkörper: Volumen > 0
- je Volumenkörper: Abweichung zum Netzvolumen ≤ 5e-4 (relativ) bei Verfeinerung u × 4 und v × 8

## 7. Grundrisskennwerte

MAC: mittlere aerodynamische Flügeltiefe (mean aerodynamic chord). Die Integrale verwenden den
vorgesehenen Grundriss: x_LE(y) und c(y) aus Abschnitt 3.4, einschließlich Leitkurven und
Mindesttiefe eines spitzen Flügelendes (`planformAt` in `src/geom/wing.js`). Quadratur: 5-Punkt-Gauß-
Legendre, exakt für Polynome bis Grad 9, auf jedem Intervall [y_a, y_b] zwischen benachbarten
Teilungspunkten. Teilungspunkte: Wurzel, Rand, die Profilschnitte und für jede eingeschaltete Leitkurve
jeder Knoten und jeder Kontrollpunkt, auf die Spannweite des Flügels abgebildet (`planformBreaks` in
`src/geom/wing.js`). Stationen sind keine Teilungspunkte: Der vorgesehene Grundriss knickt dort
nicht, und die Teilung an 139 994 Stationen (20 000 Profilschnitte, Leitkurven mit 20 000 Punkten)
dauerte 27 s. Ein Intervall wird halbiert, solange die beiden Hälften eines der 4 Integrale um mehr
als 1e-10 seines Maßstabs ändern, höchstens 12-mal (`REL_TOLERANCE`, `MAX_DEPTH` in
`src/geom/stats.js`).

```
S_half   = ∫ c dy
MAC      = ∫ c² dy     / S_half
y_MAC    = ∫ c y dy    / S_half
x_LE,MAC = ∫ c x_LE dy / S_half
x_25     = x_LE,MAC + 0.25 · MAC
b        = 2 · y_tip
S        = 2 · S_half
AR       = b² / S

∫ f dy   ≈ Σ_intervals (Δy / 2) Σ_i w_i f(y_a + (1 + t_i) Δy / 2)
t_i      = 0, ±0.538469310105683, ±0.906179845938664
w_i      = 0.568888888888889, 0.478628670499366, 0.236926885056189

halve [a, b] while |I_left + I_right − I_whole| > 1e-10 · max(s, 1) · (b − a) for one integral,
                   at most 12 halvings
s        = c_max, c_max², c_max · y_max, c_max · max(|x_LE| + c)   (per integral, over the stations)
```

| Grundriss zwischen 2 benachbarten Teilungspunkten | Quadratur |
| --- | --- |
| **Linear** oder **Smooth**, keine Leitkurve | exakt: c und x_LE haben in y höchstens Grad 3, die Integranden höchstens Grad 6 |
| eine Leitkurve eingeschaltet, oder Profiltiefe im letzten Feld eines spitzen Flügelendes auf c_tip angehoben | nicht auf jedem Intervall exakt: x(y) einer Leitkurve im Modus **Control points** ist kein Polynom, die Mindesttiefe erzeugt einen Knick; die Halbierung verfeinert diese Intervalle |

Quadraturfehler gegenüber der Mittelpunktregel mit 200 000 Intervallen (Abweichungen dieser Größe liegen
innerhalb des Fehlers der Mittelpunktregel selbst):

| Fall | S | MAC | y_MAC | x_LE,MAC |
| --- | --- | --- | --- | --- |
| **Glider**, **Tip** = **Flat** | −2,2e-10 % | −6,7e-12 % | −4,2e-10 % | 3,2e-12 mm |
| **Glider**, **Tip** = **Pointed (1/200 scale)** | −2,1e-9 % | 2,0e-9 % | −3,1e-9 % | −8,6e-10 mm |
| andere Grundrisse mit Leitkurven | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen |

- b: Spannweite, S: Flügelfläche, AR (aspect ratio): Streckung. b, S und AR gelten für beide
  Halbflügel.
- MAC, y_MAC und x_LE,MAC beziehen sich auf einen Halbflügel.
- Mit y_root > 0 enthält b die Lücke 2 · y_root in der Mitte, S nicht.
- **Show mirrored half (y < 0)** ändert nur die Darstellung, nicht die Kennwerte.
- x_25 ist ein geometrischer Bezugspunkt, keine Berechnung von Neutralpunkt oder Schwerpunkt.
- Ein Aufbauergebnis ohne `planformAt` fällt auf die Trapezregel über die Stationen zurück;
  `buildWing` setzt `planformAt` immer.

| Zeile in **Checks** | Wert | Einheit, Nachkommastellen |
| --- | --- | --- |
| **Span** (Spannweite) | b | mm, 1 |
| **Wing area** (Flügelfläche) | S | dm², 2 |
| **Aspect ratio** (Streckung) | AR | –, 2 |
| **Mean aerodynamic chord (MAC)** | MAC | mm, 1 |
| **MAC position** (Lage der MAC) | y_MAC, x_LE,MAC | mm, 1 |
| **25 % MAC (geometric reference)** (geometrischer Bezugspunkt) | x_25 | mm, 1 |
| **Root / tip chord** (Wurzeltiefe / Randtiefe) | c der ersten und der letzten Station | mm, 1 |
| **Surface** (Fläche) | Grad u × Grad v; Kontrollpunkte (2N + 1) × Stationen | – |
| **Trailing edge** (Endleiste) | `closed` oder `open` (Abschnitt 3.7) | – |

Beispiel: Vorlage **Glider** (**Tip** = **Flat**, N = 60, K = 8): **Span** 2000,0 mm, **Wing area**
33,73 dm², **Aspect ratio** 11,86, **MAC** 174,2 mm, **MAC position** y 450,6 mm, x 6,5 mm,
**25 % MAC** x 50,0 mm, **Root / tip chord** 200,0 / 90,0 mm, **Surface** Grad 3 × 3,
121 × 17 Kontrollpunkte, **Trailing edge** `open`.

![Registerkarte Checks, Vorlage Glider: Spannweite, Flügelfläche, Streckung, MAC, Lage der MAC, 25 % MAC, Wurzel- und Randtiefe, Grad der Fläche und Kontrollpunkte, Endleiste](images/checks.png)
