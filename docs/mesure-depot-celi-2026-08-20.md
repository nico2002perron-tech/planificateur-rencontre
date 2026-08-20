<!-- Mesure archivée le 2026-08-20 (lot « Dépôt »), RÉGÉNÉRÉE le même jour après contre-expertise : l'instrument publiait les statistiques exactes des échantillons à n<5, c'est-à-dire le montant brut d'une transaction réelle. Les petits échantillons ne rendent plus que l'ordre de grandeur. Instrument : scripts/mesurer-depot-celi.mjs sur scripts/instrument-commun.mjs — lecture seule, agrégats seulement. -->

# Mesure « Dépôt » CELI/CELIAPP + avant/après des non-exprimés — 20 août 2026

> Source : base locale (transactions.json par client), 7 clients, 8590 lignes.
> Agrégats seulement — aucun nom, aucun compte, notes normalisées (masque v2).

## Dépôt — régime CELI : 1 ligne(s)

- comptes distincts : 1 · années : 2009 × 1 · devises : CAD × 1 · signes : + × 1
- symboles : 1CAD × 1 · quantité nulle/absente : 1/1
- **montants (valeur absolue)** (n=1 — trop peu pour des statistiques : ordres de grandeur seulement) : +~1e2 × 1
- note citant un compte : 0/1 (régimes cités : (aucun))
- contrepartie interne même jour (autre compte, |montant| égal) : 1/1
- partie double même compte même jour (jambe titre, |montant| égal) : 0/1
- mouvement OPPOSÉ même jour (somme ≈ 0) : 0/1
- motifs de notes (normalisés) : FRAIS DE <MOT> × 1
- **seaux (heuristique de mesure)** : ressemble à de l'argent neuf externe 0 · à un transfert interne 0 · à une opération technique 0 · indécidable 1

## Dépôt — régime CELIAPP : 0 ligne(s)

Aucune ligne. Rien à classifier — la décision ne peut venir que du grand livre.

## Comparaison : l’argent neuf CELI/CELIAPP reconnu par separerCotisations

- **CELI** : 9 jambe(s) d'argent neuf · encaisse positive 9/9 · avec note 8/9 · appariées (partie double) 1/9
  motifs : <MOT> × 3 · <MOT> <MOT> × 2 · <MOT> D. <MOT> × 1 · <MOT> <MOT> <MOT> × 1 · <MOT> <MOT> <MOT> <MOT> <MOT> × 1 · (vide) × 1
- **CELIAPP** : 0 jambe(s) d'argent neuf · encaisse positive 0/0 · avec note 0/0 · appariées (partie double) 0/0
  motifs : (aucun)

## Avant/après : evenementsCeliNonExprimes (pipeline de production, par client, totaux seulement)

- événements CELI exprimés par la vue (rôles) : 10
- jambes titre CONSOMMÉES par la règle 2 (le correctif) : 1 — dont 1 comptée(s) « ambigu » avant, 0 « non-agrégé » avant
- **AVANT** : ambigus résiduels 10 · non-exprimés 96
- **APRÈS** : ambigus résiduels 9 · non-exprimés 96 · virements internes CELI (étape 4 à venir) 28
- types des non-exprimés RESTANTS (normalisés, avec leur nature) : valeur comptable (inconnu) × 59 · tvp (frais-impot) × 17 · tps (frais-impot) × 17 · cotisation (virement-interne) × 15 · frais de gestion (frais-impot) × 11 · transfert (virement-interne) × 11 · cotisation (cotisation) × 6 · frais (frais-impot) × 6 · depot (cotisation) × 1 · livraison (inconnu) × 1 · ajustement (inconnu) × 1 · fractionnement (inconnu) × 1

> Dérivation : la correction ne déplace QUE les jambes titre consommées, chacune depuis SON compteur d’origine.
