<!-- Mesure archivée le 2026-08-20 (lot « virements internes », §12). Instrument : scripts/mesurer-virements-internes.mjs sur instrument-commun — lecture seule, agrégats, montants en ordre de grandeur. La section finale lit l'état APRÈS branchement de l'étape 4. -->

# Mesure des virements internes CELI — 20 août 2026

> Source : base locale, 7 clients, 8590 lignes.
> Agrégats et vocabulaire de régimes seulement — aucun nom, aucun compte, montants en ordre de grandeur.

## 28 virement(s) interne(s) CELI

- types : cotisation × 15 · transfert × 11 · retrait × 2 · sens : entrée (+) × 15 · sortie (−) × 13 · devises : CAD × 28
- années : 2021 × 15 · 2019 × 11 · 2023 × 2 · ordres de grandeur : −~1e3 × 10 · +~1e3 × 10 · +~1e4 × 3 · −~1e4 × 2 · −~1e2 × 1 · +~1e1 × 1 · +~1e2 × 1
- **note citant un compte** : 28/28 · dont le régime du compte cité est PROUVÉ : 26/28
- régime nommé par la note : celi × 26 · (préfixe connu, régime non prouvé) × 2
- **contrepartie** (autre compte, signe opposé, même |montant|, même devise) : à J0 2/28 · dans ±3 jours 2/28 · **orphelins 26/28**
- **unicité à J0** : unique 2/28 · plusieurs 0/28
- la contrepartie trouvée est du régime que la NOTE nomme : 0/28
- notes normalisées : <MOT> <MOT>: <CPT> # × 7 · M# <CPT> <MOT> <MOT> <MOT> <CPT>/<CPT> <MOT> IK#/# × 5 · <MOT> <MOT> <MOT> <MOT> <MOT> <CPT>/<CPT> × 4 · <MOT> <MOT> <CPT>/<CPT> × 1 · <MOT> <MOT> <MOT> <MOT> <MOT> <MOT> <CPT>/<CPT> × 1 · RETRAIT <MOT> AU <CPT> × 1 · <MOT> <MOT> <MOT> RETRAIT <MOT> AU <CPT> × 1 · <MOT> CV <MOT> #.##%#JN# <MOT> <MOT>: <CPT> # × 1 · <MOT> <MOT> CV RD#.#%#DC# <MOT> <MOT>: <CPT> # × 1 · <MOT> CV RD#.##%#OC# <MOT> <MOT>: <CPT> # × 1

## Table croisée (type × sens × forme × régime nommé × contrepartie trouvée)

- cotisation (+) argent · note→celi · contrepartie J0→(aucune) → 8
- cotisation (−) titre · note→celi · contrepartie J0→(aucune) → 7
- transfert (+) argent · note→celi · contrepartie J0→(aucune) → 6
- transfert (−) titre · note→celi · contrepartie J0→(aucune) → 5
- retrait (+) titre · note→(préfixe connu, régime non prouvé) · contrepartie J0→non-enregistre → 1
- retrait (−) argent · note→(préfixe connu, régime non prouvé) · contrepartie J0→non-enregistre → 1

## Décidabilité — combien de cas par niveau de preuve exigé

- preuve FORTE (note et contrepartie unique concordantes) : 0/28
- preuve partielle (l'une des deux seulement) : 28/28
- **aucune preuve de destination** : 0/28
- effets possibles, si l'on retenait ces niveaux : CELI ← CELI (transfert direct) [preuve faible] × 14 · CELI → CELI (transfert direct) [preuve faible] × 12 · non-enregistré → CELI (cotisation) [preuve moyenne] × 1 · CELI → non-enregistré (retrait) [preuve moyenne] × 1

## Classement effectif par le moteur (relations de l’étape 4)

- relations créées : orpheline × 26 · appariée × 2 · effets : indetermine × 26 · cotisation-celi × 1 · retrait-celi × 1 · confiance : ambigu × 26 · eleve × 2
- rôles fiscaux CELI (cotisations et retraits, fermes ou à confirmer) : 37
- **impact des événements CELI** : aucun × 461 · peut-affecter-cotisation × 38 · peut-affecter-retrait × 30 · peut-affecter-les-deux × 28
- **bloquants** (vue fiscale) : 58 · **à impact** (signal de maximisation) : 85
