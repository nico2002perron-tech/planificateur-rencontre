<!-- Mesure archivée le 2026-08-20 (lot « hors flux »), RÉGÉNÉRÉE après contre-expertise : (1) l'instrument était circulaire — il cessait de profiler un type dès qu'il était classé, donc l'archive perdait la preuve qui avait fondé la règle ; les types sous revue sont maintenant NOMMÉS et profilés qu'ils soient classés ou non ; (2) les échantillons à n<5 ne rendent plus que l'ordre de grandeur (le montant exact d'une transaction unique n'est pas un agrégat). ÉTAT : non-exprimés 178 → 96, ambigus résiduels 8 → 9. -->

# Mesure des types « non exprimés » du CELI — 20 août 2026

> Source : base locale (transactions.json par client), 7 clients, 8590 lignes.
> Agrégats seulement — aucun nom, aucun compte, notes normalisées. Aucune règle décidée ici.

## Inventaire des non-exprimés CELI (pipeline de production)

- événements CELI exprimés (rôles) : 10 · **non exprimés : 96** · ambigus résiduels : 9 · virements internes CELI : 28
- ventilation : valeur comptable (inconnu) × 59 · cotisation (virement-interne) × 15 · transfert (virement-interne) × 11 · cotisation (cotisation) × 6 · depot (cotisation) × 1 · livraison (inconnu) × 1 · ajustement (inconnu) × 1 · fractionnement (inconnu) × 1 · retrait (virement-interne) × 1

> Les virements internes (étape 4) et les cotisations ambiguës sont HORS PÉRIMÈTRE de ce lot (§13).

# Régime CELI


## ajustement — 1 ligne(s)

- comptes distincts : 1 · années : 2020 × 1 · devises : CAD × 1
- signes : zero × 1 · quantité : non-zero × 1 · forme : titre × 1 · symboles : (titre) × 1
- **total (signé)** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : 0 × 1
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 0/1
- note citant un compte : 0/1 · contrepartie interne même jour : 0/1 · jambe d'une paire FX : 0/1 · partie double même compte/jour : 0/1
- notes normalisées : (vide) × 1
- **contexte** — types écrits le même jour sur le même compte : (aucun)
- classification actuelle : inconnu/inconnu × 1

## cotisation — 37 ligne(s)

- comptes distincts : 4 · années : 2021 × 15 · 2024 × 6 · 2026 × 5 · 2023 × 4 · 2014 × 2 · 2020 × 2 · devises : CAD × 35 · USD × 2
- signes : positif × 23 · negatif × 14 · quantité : zero × 23 · non-zero × 14 · forme : encaisse × 23 · titre × 14 · symboles : 1CAD × 23 · (titre) × 14
- **total (signé)** (n=37) : min -11500.00 · p25 -4068.53 · médiane 2065.28 · p75 5273.80 · max 28500.00
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 23/37
- note citant un compte : 15/37 · contrepartie interne même jour : 19/37 · jambe d'une paire FX : 0/37 · partie double même compte/jour : 14/37
- notes normalisées : <MOT> <MOT>: <CPT> # × 7 · <MOT> × 6 · <MOT> <MOT> <MOT> <MOT> <MOT> × 4 · <MOT> <MOT> × 4 · <MOT> # × 2 · <MOT> D. <MOT> × 1 · <MOT> <MOT> <MOT> × 1 · <MOT> <MOT> <MOT> #.#% #JL# <MOT> # × 1 · <MOT> <MOT> CV RD#.##%#JN# <MOT> # × 1 · <MOT> <MOT> <MOT> /<MOT> <MOT> × 1
- **contexte** — types écrits le même jour sur le même compte : cotisation × 248 · vente × 10 · achat × 1
- classification actuelle : cotisation/eleve × 15 · virement-interne/eleve × 15 · cotisation/ambigu × 7

## depot — 1 ligne(s)

- comptes distincts : 1 · années : 2009 × 1 · devises : CAD × 1
- signes : positif × 1 · quantité : zero × 1 · forme : encaisse × 1 · symboles : 1CAD × 1
- **total (signé)** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : +~1e2 × 1
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 1/1
- note citant un compte : 0/1 · contrepartie interne même jour : 0/1 · jambe d'une paire FX : 0/1 · partie double même compte/jour : 0/1
- notes normalisées : FRAIS DE <MOT> × 1
- **contexte** — types écrits le même jour sur le même compte : (aucun)
- classification actuelle : cotisation/eleve × 1

## echange — 11 ligne(s)

- comptes distincts : 2 · années : 2019 × 4 · 2025 × 4 · 2018 × 2 · 2023 × 1 · devises : CAD × 11
- signes : zero × 10 · negatif × 1 · quantité : non-zero × 11 · forme : titre × 11 · symboles : (titre) × 11
- **total (signé)** (n=11) : min -445.51 · p25 0.00 · médiane 0.00 · p75 0.00 · max 0.00
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 0/11
- note citant un compte : 0/11 · contrepartie interne même jour : 8/11 · jambe d'une paire FX : 0/11 · partie double même compte/jour : 11/11
- notes normalisées : (vide) × 11
- **contexte** — types écrits le même jour sur le même compte : echange × 10 · remboursement × 1
- classification actuelle : operation-titre/confirme × 11

## expiration — 2 ligne(s)

- comptes distincts : 2 · années : 2024 × 2 · devises : CAD × 2
- signes : zero × 2 · quantité : non-zero × 2 · forme : titre × 2 · symboles : (titre) × 2
- **total (signé)** (n=2 — trop peu pour des statistiques : ordres de grandeur seulement) : 0 × 2
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 0/2
- note citant un compte : 0/2 · contrepartie interne même jour : 1/2 · jambe d'une paire FX : 0/2 · partie double même compte/jour : 0/2
- notes normalisées : (vide) × 2
- **contexte** — types écrits le même jour sur le même compte : (aucun)
- classification actuelle : operation-titre/confirme × 2

## fractionnement — 1 ligne(s)

- comptes distincts : 1 · années : 2023 × 1 · devises : CAD × 1
- signes : positif × 1 · quantité : zero × 1 · forme : titre × 1 · symboles : (titre) × 1
- **total (signé)** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : +~1e-2 × 1
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 0/1
- note citant un compte : 0/1 · contrepartie interne même jour : 0/1 · jambe d'une paire FX : 0/1 · partie double même compte/jour : 0/1
- notes normalisées : (vide) × 1
- **contexte** — types écrits le même jour sur le même compte : (aucun)
- classification actuelle : inconnu/inconnu × 1

## frais — 7 ligne(s)

- comptes distincts : 3 · années : 2026 × 4 · 2025 × 3 · devises : CAD × 7
- signes : negatif × 6 · positif × 1 · quantité : zero × 7 · forme : encaisse × 7 · symboles : 1CAD × 7
- **total (signé)** (n=7) : min -50.00 · p25 -50.00 · médiane -50.00 · p75 -50.00 · max 57.33
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 7/7
- note citant un compte : 1/7 · contrepartie interne même jour : 1/7 · jambe d'une paire FX : 0/7 · partie double même compte/jour : 0/7
- notes normalisées : FRAIS <MOT> # × 6 · <MOT> <CPT> AU <CPT> × 1
- **contexte** — types écrits le même jour sur le même compte : tvp × 6 · tps × 6 · interets × 2 · dividendes × 2
- classification actuelle : frais-impot/confirme × 6 · ambigu/ambigu × 1

## frais de gestion — 11 ligne(s)

- comptes distincts : 3 · années : 2022 × 3 · 2023 × 3 · 2024 × 3 · 2021 × 2 · devises : CAD × 11
- signes : negatif × 11 · quantité : zero × 11 · forme : encaisse × 11 · symboles : 1CAD × 11
- **total (signé)** (n=11) : min -70.00 · p25 -70.00 · médiane -50.00 · p75 -35.00 · max -35.00
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 11/11
- note citant un compte : 0/11 · contrepartie interne même jour : 0/11 · jambe d'une paire FX : 0/11 · partie double même compte/jour : 0/11
- notes normalisées : FRAIS GEST. <MOT> × 9 · FRAIS GEST. ANNUELS # × 2
- **contexte** — types écrits le même jour sur le même compte : tvp × 11 · tps × 11 · interets × 3
- classification actuelle : frais-impot/confirme × 11

## livraison — 1 ligne(s)

- comptes distincts : 1 · années : 2009 × 1 · devises : CAD × 1
- signes : negatif × 1 · quantité : zero × 1 · forme : encaisse × 1 · symboles : 1CAD × 1
- **total (signé)** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : −~1e2 × 1
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 1/1
- note citant un compte : 0/1 · contrepartie interne même jour : 0/1 · jambe d'une paire FX : 0/1 · partie double même compte/jour : 0/1
- notes normalisées : <MOT> <MOT> <MOT> <MOT> <MOT> <MOT> Z#/# × 1
- **contexte** — types écrits le même jour sur le même compte : transfert × 2
- classification actuelle : inconnu/inconnu × 1

## remboursement — 17 ligne(s)

- comptes distincts : 3 · années : 2024 × 5 · 2023 × 4 · 2025 × 4 · 2021 × 2 · 2022 × 2 · devises : CAD × 17
- signes : positif × 17 · quantité : non-zero × 17 · forme : titre × 17 · symboles : (titre) × 17
- **total (signé)** (n=17) : min 445.51 · p25 4000.00 · médiane 6000.00 · p75 10000.00 · max 15000.00
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 0/17
- note citant un compte : 0/17 · contrepartie interne même jour : 0/17 · jambe d'une paire FX : 0/17 · partie double même compte/jour : 1/17
- notes normalisées : (vide) × 17
- **contexte** — types écrits le même jour sur le même compte : interets × 21 · achat × 2 · echange × 1
- classification actuelle : operation-titre/confirme × 17

## tps — 17 ligne(s)

- comptes distincts : 3 · années : 2022 × 3 · 2023 × 3 · 2024 × 3 · 2025 × 3 · 2026 × 3 · 2021 × 2 · devises : CAD × 17
- signes : negatif × 17 · quantité : zero × 17 · forme : encaisse × 17 · symboles : 1CAD × 17
- **total (signé)** (n=17) : min -3.50 · p25 -2.50 · médiane -2.50 · p75 -2.50 · max -1.75
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 17/17
- note citant un compte : 0/17 · contrepartie interne même jour : 0/17 · jambe d'une paire FX : 0/17 · partie double même compte/jour : 0/17
- notes normalisées : FRAIS GEST. <MOT> × 9 · FRAIS <MOT> # × 6 · FRAIS GEST. ANNUELS # × 2
- **contexte** — types écrits le même jour sur le même compte : tvp × 17 · frais de gestion × 11 · frais × 6 · interets × 5 · dividendes × 2
- classification actuelle : frais-impot/confirme × 17

## tvh — 0 ligne(s)

Aucune ligne dans ce régime.

## tvp — 17 ligne(s)

- comptes distincts : 3 · années : 2022 × 3 · 2023 × 3 · 2024 × 3 · 2025 × 3 · 2026 × 3 · 2021 × 2 · devises : CAD × 17
- signes : negatif × 17 · quantité : zero × 17 · forme : encaisse × 17 · symboles : 1CAD × 17
- **total (signé)** (n=17) : min -6.98 · p25 -4.99 · médiane -4.99 · p75 -4.99 · max -3.49
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 17/17
- note citant un compte : 0/17 · contrepartie interne même jour : 0/17 · jambe d'une paire FX : 0/17 · partie double même compte/jour : 0/17
- notes normalisées : FRAIS GEST. <MOT> × 9 · FRAIS <MOT> # × 6 · FRAIS GEST. ANNUELS # × 2
- **contexte** — types écrits le même jour sur le même compte : tps × 17 · frais de gestion × 11 · frais × 6 · interets × 5 · dividendes × 2
- classification actuelle : frais-impot/confirme × 17

## valeur comptable — 59 ligne(s)

- comptes distincts : 3 · années : 2024 × 59 · devises : CAD × 59
- signes : negatif × 21 · zero × 19 · positif × 19 · quantité : non-zero × 40 · zero × 19 · forme : titre × 40 · encaisse × 19 · symboles : (titre) × 40 · 1CAD × 19
- **total (signé)** (n=59) : min -10613.20 · p25 -3757.21 · médiane 0.00 · p75 2017.43 · max 10613.20
- **impact sur l'encaisse** (ligne d'encaisse à montant non nul) : 19/59
- note citant un compte : 0/59 · contrepartie interne même jour : 19/59 · jambe d'une paire FX : 0/59 · partie double même compte/jour : 39/59
- notes normalisées : (vide) × 40 · <MOT> <MOT> <MOT> × 19
- **contexte** — types écrits le même jour sur le même compte : valeur comptable × 1094
- classification actuelle : inconnu/inconnu × 59

# Régime CELIAPP


## ajustement — 0 ligne(s)

Aucune ligne dans ce régime.

## cotisation — 0 ligne(s)

Aucune ligne dans ce régime.

## depot — 0 ligne(s)

Aucune ligne dans ce régime.

## echange — 0 ligne(s)

Aucune ligne dans ce régime.

## expiration — 0 ligne(s)

Aucune ligne dans ce régime.

## fractionnement — 0 ligne(s)

Aucune ligne dans ce régime.

## frais — 0 ligne(s)

Aucune ligne dans ce régime.

## frais de gestion — 0 ligne(s)

Aucune ligne dans ce régime.

## livraison — 0 ligne(s)

Aucune ligne dans ce régime.

## remboursement — 0 ligne(s)

Aucune ligne dans ce régime.

## tps — 0 ligne(s)

Aucune ligne dans ce régime.

## tvh — 0 ligne(s)

Aucune ligne dans ce régime.

## tvp — 0 ligne(s)

Aucune ligne dans ce régime.

## valeur comptable — 0 ligne(s)

Aucune ligne dans ce régime.

## Les taxes (TPS/TVP/TVH) accompagnent-elles systématiquement des frais ?

- **TPS** (CELI+CELIAPP) : 17 ligne(s) · accompagnée de frais le même jour sur le même compte : 17/17 · même montant qu'un frais : 0/17
  ratio taxe/frais observé : 5.0 % × 17
- **TVP** (CELI+CELIAPP) : 17 ligne(s) · accompagnée de frais le même jour sur le même compte : 17/17 · même montant qu'un frais : 0/17
  ratio taxe/frais observé : 10.0 % × 17
- **TVH** (CELI+CELIAPP) : 0 ligne(s) · accompagnée de frais le même jour sur le même compte : 0/0 · même montant qu'un frais : 0/0

## « Remboursement » — recherche de patterns discriminants

- 17 ligne(s). Croisement forme × signe × quantité × note × voisins :
  - titre + q:non-zero note:vide avec:interets → 15
  - titre + q:non-zero note:vide avec:echange → 1
  - titre + q:non-zero note:vide avec:achat+interets → 1
- symboles : (titre, 8 car.) × 11 · (titre, 6 car.) × 5 · (titre, 3 car.) × 1
- notes : (vide) × 17

## « Valeur comptable » — les jambes titre forment-elles des écritures à somme nulle ?

- **titre** : 4 groupe(s) (compte × jour) · somme ≈ 0 : 0/4
- **  sommes NON nulles (titre)** (n=4 — trop peu pour des statistiques : ordres de grandeur seulement) : −~1e4 × 3 · +~1e0 × 1
- **encaisse** : 4 groupe(s) (compte × jour) · somme ≈ 0 : 0/4
- **  sommes NON nulles (encaisse)** (n=4 — trop peu pour des statistiques : ordres de grandeur seulement) : +~1e4 × 3 · −~1e0 × 1
- **NET du compte (titre + encaisse)** : 4 groupe(s) · net ≈ 0 : 3/4
- **  nets NON nuls** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : −~1e3 × 1
