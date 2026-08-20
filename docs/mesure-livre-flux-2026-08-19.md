# Mesure du livre pour l’étape 3 — flux, conversions, renversements (v2)

_Généré le 2026-08-19 par `scripts/mesurer-livre-flux.mjs` v2. Agrégats seulement._

> **SOURCE DE CETTE MESURE — à lire avant les chiffres.**
> Ce n'est PAS le grand livre de 832 k lignes (il n'est pas sur la machine hors de
> `C:\planificateur-donnees`, et il n'y est pas non plus : aucun fichier de plus de
> 5 Mo). C'est la **base locale** nourrie par les cours cibles :
> `C:\planificateur-donnees	ransactions\<client>\*_brut.txt` — **7 clients,
> 18 comptes, 10 collages, 12 003 lignes brutes → 8 609 après dédoublonnage**
> (3 394 doublons : des historiques collés plusieurs fois, que le dédoublonnage
> multi-ensemble a correctement écartés). Années 2000-2026.
>
> C'est exactement la matière que la ligne du temps consommera, mais c'est PETIT :
> 8 conversions observables, 2 familles E/F, 0 compte B, 0 type `Correction`.
> Les conclusions valent pour cette base ; elles sont à re-mesurer sur le grand
> livre avant d'être appelées générales.
>
> **Lecture des motifs** : le seuil de rareté (`--mot-rare 100`) est calibré pour
> 832 k lignes. Sur 8 609, des mots de vocabulaire ordinaires tombent sous 100
> occurrences et sortent `<MOT>` — dans `AU F# <MOT> #.####`, le `<MOT>` est le
> mot-clé du taux (TAUX/CONV/@ : « taux extractible = oui » le prouve). On n'a PAS
> abaissé le seuil : sur une base de 7 clients, un mot rare peut être un nom.
>
> Vérification automatique de la sortie : aucun numéro de compte non masqué,
> aucune forme « NOM, PRÉNOM », mots hors vocabulaire dans les motifs = lexique
> Croesus ordinaire (ANNUELS, CONDITIONNEL, EMISS, GEST, INTERET, JUN, LEUR,
> PROCHAIN). Lancée par Claude sur instruction explicite de Nicolas (19 août 2026).


- fichiers lus : 10 · lignes brutes : 12003 · rejetées (arité/date/compte) : 0 · **retenues après dédoublonnage : 8609**
- source : `récursif`, encodage `utf8`, motif de fichier `_brut(_\d+)?\.txt$` · lignes à 20 colonnes : 12002 · à 18 colonnes (décalage 2) : 1
- années couvertes : 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 · lignes par année : 2000 24 · 2001 34 · 2002 29 · 2003 21 · 2004 18 · 2005 16 · 2006 15 · 2007 14 · 2008 17 · 2009 114 · 2010 169 · 2011 204 · 2012 156 · 2013 178 · 2014 157 · 2015 239 · 2016 322 · 2017 391 · 2018 469 · 2019 547 · 2020 577 · 2021 782 · 2022 823 · 2023 835 · 2024 1085 · 2025 917 · 2026 456
- dateReglement ≠ date : 1807 lignes (20.99 %) — la question « date de transaction vs date de règlement » reste OUVERTE ; ce script ne s'en sert que comme indice, jamais pour ranger une ligne dans une année.
- clients distincts (colonne Nom, jamais imprimée) : 7 · comptes distincts : 18

## A. Couverture des libellés Croesus (`type`)

Définition d'une **ligne candidate à un flux de capital** : total ≠ 0, type hors {revenus, frais, impôts, inventaire}, et (symbole 1CAD/1USD OU type ∈ {Cotisation, Dépôt, Retrait, Transfert, Réception, Livraison}). 428 lignes sur 8609 (4.97 %).

| libellé | lignes | % lignes | dont candidates flux | liste blanche | connu de moteur-livre (29) |
|---|---:|---:|---:|:---:|:---:|
| Dividendes | 4381 | 50.89 % | 0 | oui | oui |
| Intérêts | 1575 | 18.29 % | 0 | **non** | oui |
| Achat | 674 | 7.83 % | 0 | oui | oui |
| Vente | 440 | 5.11 % | 0 | oui | oui |
| Valeur comptable | 249 | 2.89 % | 0 | **non** | oui |
| Échange | 232 | 2.69 % | 0 | **non** | oui |
| Transfert | 226 | 2.63 % | 154 | oui | oui |
| Retrait | 157 | 1.82 % | 152 | oui | oui |
| Remboursement | 108 | 1.25 % | 0 | **non** | oui |
| Cotisation | 93 | 1.08 % | 93 | oui | oui |
| TVP | 79 | 0.92 % | 0 | **non** | oui |
| TPS | 79 | 0.92 % | 0 | **non** | oui |
| Frais de gestion | 74 | 0.86 % | 0 | **non** | oui |
| Journal | 45 | 0.52 % | 0 | **non** | oui |
| Ajustement | 41 | 0.48 % | 0 | **non** | oui |
| Frais | 28 | 0.33 % | 0 | **non** | oui |
| Dépôt | 26 | 0.30 % | 26 | oui | oui |
| Expiration | 19 | 0.22 % | 0 | **non** | oui |
| Fractionnement | 19 | 0.22 % | 0 | **non** | oui |
| Imp. non résident | 14 | 0.16 % | 0 | **non** | oui |
| Divers | 12 | 0.14 % | 0 | **non** | oui |
| Substitution | 10 | 0.12 % | 0 | **non** | oui |
| Exercice | 8 | 0.09 % | 0 | **non** | oui |
| Réception | 7 | 0.08 % | 0 | oui | oui |
| Montant brut | 6 | 0.07 % | 0 | **non** | oui |
| Livraison | 3 | 0.03 % | 3 | **non** | oui |
| Impôt retenu | 2 | 0.02 % | 0 | **non** | oui |
| Assignation | 2 | 0.02 % | 0 | **non** | **NON — jamais vu** |

- **couverture globale des lignes** : 6004 / 8609 = 69.74 %
- **couverture des lignes candidates à un flux de capital** : 425 / 428 = **99.30 %** ← la métrique qui compte
- candidates flux HORS liste blanche, par type : Livraison 3

### Les libellés hors liste blanche — métadonnées agrégées
- **Intérêts** (1575) — formes titre 904, encaisse 671 · signes + 1344, − 231 · quantités qté ≠ 0 896, qté 0 679 · devises CAD 1539, USD 36 · lettres E 456, S 315, A 282, W 256, Z 101, J 75 · symboles 1CAD 635, EIF.DB.J 46, CHR.DB.C 38, 1USD 36, EIF.DB.L 30
- **Valeur comptable** (249) — formes titre 166, encaisse 83 · signes − 88, + 86, 0 75 · quantités qté ≠ 0 166, qté 0 83 · devises CAD 249 · lettres S 117, W 60, T 33, E 15, Z 15, A 9 · symboles 1CAD 83, TRP 6, PEA 6, JE.H 6, BNS 6
- **Échange** (232) — formes titre 232 · signes 0 207, − 13, + 12 · quantités qté ≠ 0 231, qté 0 1 · devises CAD 231, USD 1 · lettres E 106, S 70, Z 22, A 17, W 11, T 6 · symboles PEA 11, ATD 9, PKK 9, PTOAF 9, GLDMF 9
- **Remboursement** (108) — formes titre 108 · signes + 108 · quantités qté ≠ 0 106, qté 0 2 · devises CAD 108 · lettres A 33, E 28, S 23, W 17, Z 4, T 3 · symboles JE.DB 4, DIV.DB 4, CHE.DB.D 4, CHR.DB.A 3, EIF.DB.J 3
- **TVP** (79) — formes encaisse 79 · signes − 76, + 3 · quantités qté 0 79 · devises CAD 79 · lettres S 25, Z 19, W 17, E 12, T 5, A 1 · symboles 1CAD 79
- **TPS** (79) — formes encaisse 79 · signes − 76, + 3 · quantités qté 0 79 · devises CAD 79 · lettres S 25, Z 19, W 17, E 12, T 5, A 1 · symboles 1CAD 79
- **Frais de gestion** (74) — formes encaisse 65, titre 9 · signes − 70, + 4 · quantités qté 0 66, qté ≠ 0 8 · devises CAD 70, USD 4 · lettres S 26, Z 17, E 13, W 11, F 3, T 3 · symboles 1CAD 65, NVO 4, TELFY 3, AEM 1, 84101A 1
- **Journal** (45) — formes titre 45 · signes 0 45 · quantités qté ≠ 0 43, qté 0 2 · devises CAD 45 · lettres Z 39, S 6 · symboles NCE229 17, CIG53205 13, CIG53234 5, CIG50234 4, TML1210 2
- **Ajustement** (41) — formes titre 41 · signes 0 41 · quantités qté ≠ 0 41 · devises CAD 41 · lettres Z 18, A 14, E 4, T 4, W 1 · symboles CIG50234 18, CCM7510 18, FID3998 3, MMF4506 2
- **Frais** (28) — formes encaisse 28 · signes − 24, + 4 · quantités qté 0 28 · devises CAD 28 · lettres E 9, S 8, W 7, Z 2, T 2 · symboles 1CAD 28
- **Expiration** (19) — formes titre 19 · signes 0 19 · quantités qté ≠ 0 19 · devises CAD 16, USD 3 · lettres E 9, S 5, F 3, W 2 · symboles PEA.RT 4, ADK.RT 2, 886269 2, 908298 2, VIX180117C11 2
- **Fractionnement** (19) — formes titre 19 · signes 0 11, + 8 · quantités qté ≠ 0 11, qté 0 8 · devises CAD 14, USD 5 · lettres E 14, S 2, F 1, W 1, T 1 · symboles ATD.B 4, VTRS 2, KL 1, ICE 1, NFLX 1
- **Imp. non résident** (14) — formes titre 14 · signes − 13, + 1 · quantités qté ≠ 0 14 · devises USD 9, CAD 5 · lettres F 9, E 5 · symboles ZIM 10, NVO 4
- **Divers** (12) — formes encaisse 6, titre 6 · signes 0 12 · quantités qté 0 6, qté ≠ 0 6 · devises CAD 12 · lettres Z 6, E 4, S 2 · symboles 1CAD 6, 876345 4, T01648 2
- **Substitution** (10) — formes titre 10 · signes + 5, − 5 · quantités qté ≠ 0 10 · devises CAD 10 · lettres Z 5, E 5 · symboles CIG2943 2, TRP 2, SOBO 2, BTCC 2, RPR.DB.B 2
- **Exercice** (8) — formes titre 8 · signes 0 6, − 2 · quantités qté ≠ 0 6, qté 0 2 · devises CAD 7, USD 1 · lettres E 4, S 3, F 1 · symboles PKK.WT 4, PKK 2, SHLD180119P5 1, SU170120C36 1
- **Montant brut** (6) — formes titre 6 · signes + 6 · quantités qté 0 6 · devises CAD 6 · lettres E 5, S 1 · symboles MST.UN 5, 714229 1
- **Livraison** (3) — formes encaisse 3 · signes − 3 · quantités qté 0 3 · devises CAD 3 · lettres Z 1, E 1, W 1 · symboles 1CAD 3
- **Impôt retenu** (2) — formes titre 2 · signes − 2 · quantités qté ≠ 0 2 · devises CAD 2 · lettres E 2 · symboles META 1, MST.UN 1
- **Assignation** (2) — formes titre 2 · signes 0 2 · quantités qté ≠ 0 2 · devises CAD 2 · lettres E 2 · symboles SU170120C36 2

## B. Structure E/F et A/B — les comptes jumeaux, mesurés par la RACINE du numéro

- lignes iA par lettre : A 1396 · B 0 · E 3587 · F 141 · J 223 · comptes iA par lettre : A 2 · B 0 · E 5 · F 2 · J 1
- **E/F** : familles avec les deux = 2 · E seul = 3 · F seul = 0 · **E ayant son F = 40.00 %** · **F ayant son E = 100.00 %**
- **A/B** : familles avec les deux = 0 · A seul = 2 · B seul = 0 · **A ayant son B = 0.00 %** · **B ayant son A = —**
- familles iA : 8 · familles portant PLUS d'un Nom (conjoints sous une même racine ? erreur ?) : 0
- répartition du nombre de lettres par famille : 1 : 3 · 2 : 2 · 3 : 1 · 4 : 2

## C. Paires FX candidates — l’univers, et le pouvoir discriminant de chaque indice

Univers U = paires (x, y) du MÊME CLIENT, |Δ| ≤ 3 jours, x sur lettre CAD (A/E/J), y sur lettre USD (B/F), signes opposés, totaux ≠ 0. **708 paires**, 231 lignes x distinctes.

**Vérité terrain disponible** = paires dont la note porte un taux ET dont le ratio le respecte à ≤ 1 % : **8** (« conversions observables »). Tout ce qui suit mesure chaque indice CONTRE cet ensemble.

| indice | paires de U qui l’ont | % de U | dont observables | **précision** (observables ÷ qui l’ont) | **rappel** (observables qui l’ont ÷ observables) |
|---|---:|---:|---:|---:|---:|
| même racine de compte | 693 | 97.88 % | 8 | 1.15 % | 100.00 % |
| lettres jumelles (A/B ou E/F) | 708 | 100.00 % | 8 | 1.13 % | 100.00 % |
| devises CAD↔USD | 633 | 89.41 % | 8 | 1.26 % | 100.00 % |
| 1CAD / 1USD | 19 | 2.68 % | 8 | 42.11 % | 100.00 % |
| même date (J0) | 420 | 59.32 % | 8 | 1.90 % | 100.00 % |
| taux présent dans la note | 37 | 5.23 % | 8 | 21.62 % | 100.00 % |
| ratio cohérent avec le taux (≤ 1 %, seuil de LECTURE) | 8 | 1.13 % | 8 | 100.00 % | 100.00 % |
| contrepartie unique à la distance minimale | 115 | 16.24 % | 8 | 6.96 % | 100.00 % |
| note parle de conversion/taux | 109 | 15.40 % | 8 | 7.34 % | 100.00 % |

### Les combinaisons d’indices STRUCTURELS les plus fréquentes (hors note), et leur précision
Clé = memeFamille · jumelles · devisesOk · encaisse · j0 · unique (1 = vrai).

| combinaison | paires | % de U | observables | précision | ratios : médiane · p5 · p95 |
|---|---:|---:|---:|---:|---|
| `111010` | 320 | 45.20 % | 0 | 0.00 % | 0.4106 · 0.0872 · 4.1712 |
| `111000` | 205 | 28.95 % | 0 | 0.00 % | 6.5659 · 0.0150 · 133.0662 |
| `111001` | 68 | 9.60 % | 0 | 0.00 % | 0.1832 · 0.0130 · 604.1020 |
| `110010` | 64 | 9.04 % | 0 | 0.00 % | 17.2324 · 1.7370 · 121.7664 |
| `111011` | 15 | 2.12 % | 0 | 0.00 % | 0.7201 · 0.0049 · 299.5490 |
| `111111` | 10 | 1.41 % | 8 | 80.00 % | 1.2744 · 0.6646 · 1.3191 |
| `011111` | 8 | 1.13 % | 0 | 0.00 % | 13.5960 · 3.2933 · 15.4037 |
| `011001` | 5 | 0.71 % | 0 | 0.00 % | 0.0490 · 0.0072 · 1654.5100 |
| `110000` | 4 | 0.56 % | 0 | 0.00 % | 69.0987 · 0.7599 · 146.4664 |
| `110001` | 4 | 0.56 % | 0 | 0.00 % | 1.6027 · 0.5415 · 1.6643 |
| `110011` | 2 | 0.28 % | 0 | 0.00 % | 0.9086 · 0.7476 · 1.0696 |
| `010001` | 1 | 0.14 % | 0 | 0.00 % | 3573.2148 · 3573.2148 · 3573.2148 |
| `011011` | 1 | 0.14 % | 0 | 0.00 % | 0.8003 · 0.8003 · 0.8003 |
| `111101` | 1 | 0.14 % | 0 | 0.00 % | 295.4540 · 295.4540 · 295.4540 |

- **paires satisfaisant TOUS les indices structurels** (`111111`) : 10 — observables 8 (80.00 %) · sans taux en note 1 · avec taux mais ratio discordant 1
- même client mais **racine différente**, tout le reste structurel vrai : 8 (observables 0) — si ≈ 0, la racine peut devenir un invariant

### Proximité des dates — J0 est-il un invariant ou un signal fort ?

Pour chaque ligne CAD structurellement compatible (même racine, jumelles, CAD↔USD, 1CAD/1USD), la distance à sa contrepartie LA PLUS PROCHE :

| distance minimale | lignes x | dont observables (taux + ratio) | dont plusieurs contreparties à cette distance |
|---|---:|---:|---:|
| J0 | 10 | 8 | 0 |
| ±1 j (supplémentaires, sans contrepartie plus proche) | 0 | 0 | 0 |
| ±2 j (supplémentaires, sans contrepartie plus proche) | 1 | 0 | 0 |
| ±3 j (supplémentaires, sans contrepartie plus proche) | 0 | 0 | 0 |

- ratios des paires structurelles par distance — 0 j : n=10, médiane 1.2744, p5 0.6646, p95 1.3191 · 1 j : n=0, médiane —, p5 —, p95 — · 2 j : n=1, médiane 295.4540, p5 295.4540, p95 295.4540 · 3 j : n=0, médiane —, p5 —, p95 —

## D. Distribution des ratios |CAD| ÷ |USD| et concordance avec le taux de la note

- **toutes paires de U** (n = 708) : min 0.0009 · p1 0.0028 · p5 0.0405 · p25 0.2752 · **médiane 0.8293** · p75 6.9888 · p95 88.2158 · p99 573.6622 · max 3573.2148
- **paires structurelles J0 (racine + jumelles + devises + encaisse + même date)** (n = 10) : min 0.3903 · p1 0.4451 · p5 0.6646 · p25 1.2467 · **médiane 1.2744** · p75 1.3092 · p95 1.3191 · p99 1.3240 · max 1.3252
  - histogramme (pas 0,05) : < 0.5:1  1.00:1  1.20:1  1.25:3  1.30:4
- **structurelles J0 à contrepartie unique** (n = 10) : min 0.3903 · p1 0.4451 · p5 0.6646 · p25 1.2467 · **médiane 1.2744** · p75 1.3092 · p95 1.3191 · p99 1.3240 · max 1.3252
- **structurelles J0 E/F** (n = 10) : min 0.3903 · p1 0.4451 · p5 0.6646 · p25 1.2467 · **médiane 1.2744** · p75 1.3092 · p95 1.3191 · p99 1.3240 · max 1.3252
- structurelles J0 A/B : aucune valeur
- **conversions OBSERVABLES (taux + ratio ≤ 1 %)** (n = 8) : min 1.2405 · p1 1.2422 · p5 1.2492 · p25 1.2659 · **médiane 1.2937** · p75 1.3109 · p95 1.3205 · p99 1.3243 · max 1.3252

### Le taux de la note : convention DIRECTE (CAD par USD) ou INVERSE (USD par CAD) ?
- paires de U avec un taux extractible : 37

| tolérance | direct concordant | inverse concordant | les deux | aucun |
|---|---:|---:|---:|---:|
| ≤ 0.1 % | 8 | 0 | 0 | 29 |
| ≤ 0.5 % | 8 | 0 | 0 | 29 |
| ≤ 1.0 % | 8 | 0 | 0 | 29 |
| ≤ 2.0 % | 8 | 0 | 0 | 29 |
| ≤ 5.0 % | 8 | 1 | 0 | 28 |

- **écart relatif DIRECT |ratio − taux| ÷ taux** (n = 37) : min 0.0000 · p1 0.0000 · p5 0.0000 · p25 0.1600 · **médiane 0.4343** · p75 0.9512 · p95 6.3259 · p99 145.4559 · max 221.9505
- **écart relatif INVERSE |1/ratio − taux| ÷ taux** (n = 37) : min 0.0384 · p1 0.0454 · p5 0.1066 · p25 0.3755 · **médiane 0.5120** · p75 0.9974 · p95 86.1793 · p99 193.1420 · max 222.3743
- écart direct ≤ 0,1 % : 8 · ≤ 0,5 % : 8 · ≤ 1 % : 8 · ≤ 2 % : 8 · > 5 % : 29 — **la tolérance se choisit en lisant cette courbe, pas avant**

## E. Patterns des notes (paires structurelles J0 et lignes d’encaisse)

| motif normalisé (comptes → `<CPT>`, nombres → `#`, mots rares/prénoms → `<MOT>`) | occurrences | taux extractible |
|---|---:|:---:|
| `DU F# <MOT> #.####` | 4 | oui (4) |
| `AU F# <MOT> #.####` | 3 | oui (3) |
| `DU E# <MOT> #.####` | 3 | oui (3) |
| `AU E# <MOT> #.####` | 2 | oui (2) |
| `AU E# <MOT> #.#### <MOT>: #.###.#CR` | 2 | oui (2) |
| `AU M# <MOT> #.####` | 2 | oui (2) |
| `DU L# <MOT> #.####` | 2 | oui (2) |
| `INTERET AU # <MOT>` | 2 | non |
- motifs distincts sur les paires structurelles J0 : 8 · dont contenant TAUX/CONV/EN CAD/EN USD : 0

- top motifs de TOUTES les lignes d'encaisse (1374 lignes, 124 motifs) : `INTERET AU # <MOT>` 593 · `RETRAIT` 126 · `FRAIS GEST. ANNUELS #` 108 · `<MOT> <MOT> <MOT>` 84 · `INTERET AU # JUN` 68 · `FRAIS GEST. <MOT>` 63 · `FRAIS <MOT> #` 42 · `<MOT>` 26 · `<MOT> A #` 23 · `<MOT> <MOT>` 16 · `<MOT> RETRAIT <MOT> #<MOT>-<MOT>` 13 · `<MOT> <MOT> <MOT> <MOT> <MOT>` 8 · `<MOT> AU <MOT> <CPT>` 7 · `RETRAIT <MOT> ME <MOT> <MOT> DU O# <MOT> <MOT>` 7 · `FRAIS DE <MOT>` 7

## F. Ambiguïtés

- lignes x structurelles ayant PLUSIEURS contreparties à leur distance minimale : 0 sur 11
- paires structurelles J0 dont le ratio est hors [p1, p99] des observables : 4
- paires de U où la DEVISE de la ligne contredit la lettre (x en USD ou y en CAD) : 75
- paires de U jumelles J0 dont un côté n'est PAS de l'encaisse (titre ou vide) : 402 — types : Achat/Vente 277, Vente/Achat 116, Achat/Dividendes 3, Dividendes/Achat 2, Intérêts/Transfert 2, Dividendes/Intérêts 1

## G. Renversements / annulations — appariement un-pour-un au plus proche, ventilé

- paires appariées (même compte, même symbole, même |montant|, signes opposés) à ≤ 30 jours : **110**
- clés (compte × symbole × |montant|) à plus de 2 lignes — montants récurrents : 540 clés

| catégorie | ≤ 0 j | ≤ 1 j | ≤ 2 j | ≤ 3 j | ≤ 5 j | ≤ 10 j | ≤ 30 j |
|---|---:|---:|---:|---:|---:|---:|---:|
| toutes | 95 | 101 | 105 | 107 | 108 | 108 | 110 |
| Correction/Ajustement/Journal présent | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| note d’annulation présente | 21 | 21 | 21 | 21 | 21 | 21 | 21 |
| types identiques | 90 | 91 | 93 | 94 | 94 | 94 | 95 |
| types différents | 5 | 10 | 12 | 13 | 14 | 14 | 15 |
| paire Achat/Vente | 23 | 23 | 23 | 23 | 23 | 23 | 23 |
| clé unique (2 lignes) | 54 | 58 | 58 | 59 | 60 | 60 | 61 |
| clé récurrente (> 2 lignes) | 41 | 43 | 47 | 48 | 48 | 48 | 49 |
| même quantité | 91 | 97 | 101 | 103 | 104 | 104 | 106 |

- (≤ 5 j) combinaisons de types : Dividendes / Dividendes (26) · Intérêts / Intérêts (17) · Achat / Achat (14) · Retrait / Retrait (12) · Vente / Vente (9) · TVP / TVP (3) · TPS / TPS (3) · Frais de gestion / Frais de gestion (3) · Échange / Échange (3) · Retrait / Frais (3) · Dépôt / Livraison (3) · Frais / Frais (2)
- (≤ 5 j) motifs de notes : `(vide) ⇄ (vide)` (29) · `FRAIS GEST. ANNUELS # ⇄ FRAIS GEST. ANNUELS #` (15) · `CONV. EN CAD @ #.##### ⇄ CONV. EN CAD @ #.#####` (12) · `INTERET AU # JUN ⇄ INTERET AU # JUN` (6) · `<MOT> ⇄ RETRAIT <MOT> ME <MOT> <MOT> DU O# <MOT> <MOT>` (6) · `<MOT># ⇄ <MOT># <MOT> DE # <MOT>` (5) · `INTERET AU # <MOT> ⇄ INTERET AU # <MOT>` (3) · `FRAIS <MOT> ⇄ FRAIS <MOT>` (3) · `CONDITIONNEL A LEUR EMISS PROCHAIN COUPON <MOT> #.# <MOT> DE # JU <MOT> <MOT> ⇄ CONDITIONNEL A LEUR EMISS PROCHAIN COUPON <MOT> #.# <MOT> <MOT>` (2) · `CONDITIONNEL A LEUR EMISS <MOT> DE # M ⇄ CONDITIONNEL A LEUR EMISS EN <MOT> DU # <MOT>` (2)

⚠ Lire la table par colonnes : là où « toutes » monte fort d’une fenêtre à l’autre SANS que « Correction/Ajustement/Journal » ni « note d’annulation » ne suivent, ce sont des paires qui ne sont probablement PAS des renversements (deux exécutions, un aller-retour). La rupture dit N.

## H. `1CAD` / `1USD` — matrice par type Croesus

Pour chaque type Croesus porté par une ligne 1CAD/1USD (total ≠ 0) : combien ont une jambe jumelle J0 (même racine, lettre jumelle, signe opposé, encaisse), un taux en note, un ratio cohérent (≤ 1 %, seuil de lecture), une contrepartie unique ou multiple.

| type | lignes encaisse | devise cohérente avec le symbole | avec jambe jumelle J0 | % | taux en note (paire) | ratio ≤ 1 % du taux | unique | multiples |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Intérêts | 671 | 671 | 2 | 0.30 % | 0 | 0 | 2 | 0 |
| Retrait | 150 | 150 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Transfert | 118 | 118 | 17 | 14.41 % | 17 | 16 | 16 | 1 |
| Valeur comptable | 83 | 83 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| TVP | 79 | 79 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| TPS | 79 | 79 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Frais de gestion | 65 | 65 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Cotisation | 60 | 58 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Frais | 28 | 28 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Dépôt | 26 | 26 | 0 | 0.00 % | 0 | 0 | 0 | 0 |
| Livraison | 3 | 3 | 0 | 0.00 % | 0 | 0 | 0 | 0 |

- **1CAD** : 1318 lignes · signes + 662, − 656 · lettres E 397, S 272, W 237, A 164, Z 151, T 74, J 23 · devise de ligne ≠ CAD : 2
- **1USD** : 44 lignes · signes + 25, − 19 · lettres F 44 · devise de ligne ≠ USD : 0

## I. `Journal`, `Divers`, `Montant brut` — sans nature, mesurés

- **Journal** — 45 lignes (0.52 %) · signes 0 45 · quantité ≠ 0 43, 0 2 · symbole titre 45 · symboles dominants NCE229 17, CIG53205 13, CIG53234 5, CIG50234 4, TML1210 2, TML2062 2 · lettres Z 39, S 6 · avec contrepartie opposée ≤ 3 j même compte/symbole/|montant| : 0 (0.00 %)
  - motifs de notes : `(vide)` 45
- **Divers** — 12 lignes (0.14 %) · signes 0 12 · quantité 0 6, ≠ 0 6 · symbole 1CAD/1USD 6, titre 6 · symboles dominants 1CAD 6, 876345 4, T01648 2 · lettres Z 6, E 4, S 2 · avec contrepartie opposée ≤ 3 j même compte/symbole/|montant| : 0 (0.00 %)
  - motifs de notes : `(vide)` 3 · `<MOT> <MOT> <MOT> - <MOT> #<MOT>-<MOT> N <CPT> #` 2 · `<MOT> <MOT>: # S` 2 · `<MOT> <MOT> <MOT> #<MOT>-<MOT> Y # #` 2 · `<MOT> <MOT> <MOT> <MOT> #` 1 · `<MOT> <MOT> <MOT>É <CPT> #` 1 · `<MOT> <MOT>: # L` 1
- **Montant brut** — 6 lignes (0.07 %) · signes + 6 · quantité 0 6 · symbole titre 6 · symboles dominants MST.UN 5, 714229 1 · lettres E 5, S 1 · avec contrepartie opposée ≤ 3 j même compte/symbole/|montant| : 1 (16.67 %)
  - motifs de notes : `CONV. EN CAD @ #.#####` 4 · `(vide)` 2

---
_Fin. Rien n’a été écrit ni modifié. Le script masque les comptes, normalise les notes et remplace les mots rares par <MOT> — relire quand même avant de coller._
