# Seed du référentiel de fonds (`fonds-initiaux.csv`)

Base **propriétaire** GFSF des fonds, alimentée **à la main** (aucune IA ne lit de
document). Chaque ligne est un fait vérifié et daté — c'est ce qui rend chaque
chiffre du rapport défendable.

## Colonnes

| Colonne | Obligatoire | Notes |
|---|---|---|
| `code` | oui | Ticker / code de fonds, ex. `XEQT`, `RBF460`. Insensible à la casse. |
| `nom` | oui | Nom du fonds. |
| `type` | oui | `fonds_commun` \| `fnb` \| `action` \| `obligation` \| `autre`. |
| `categorie` | oui | Ex. « Actions canadiennes », « Revenu fixe canadien ». Sert au calcul de la médiane. |
| `rfg` | oui | **En décimal** : `0.0225` = 2,25 %. Un seul chiffre publié par fonds. |
| `rfg_median_categorie` | non | Laisser **vide** : calculée par le moteur (médiane des RFG par `categorie`). |
| `source` | non | `manuel` par défaut. |
| `verifie_le` | non | Date de vérification (AAAA-MM-JJ). |

Les allocations géographiques/sectorielles et les `top_holdings` (chevauchement)
arrivent au **Sprint 2** — pas nécessaires pour remplir cette première liste.

## Composition des fonds (holdings + allocations) — pour le look-through et la géo

Deux CSV **optionnels**, chargés automatiquement par le même importeur s'ils existent.
Uniquement des données **publiées par le manufacturier** (fiches de fonds, CSV de FNB) —
sûr côté licence pour un outil public. Aucune API, aucune IA.

**`holdings-initiaux.csv`** — les principaux titres de chaque fonds (pour le chevauchement) :

| Colonne | Notes |
|---|---|
| `code_fonds` | doit exister dans `fonds-initiaux.csv` |
| `titre` | nom du titre (Banque Royale, Apple…) ; rapproché insensible à la casse entre fonds |
| `poids` | **poids du titre DANS le fonds**, en décimal (0.09 = 9 %) |

L'importeur garde les **10 plus gros titres** par fonds. Pour un FNB, tu peux souvent
adapter directement le fichier de holdings du manufacturier (il suffit de renommer les colonnes).

**`allocations-initiaux.csv`** — répartition géographique et sectorielle :

| Colonne | Notes |
|---|---|
| `code_fonds` | idem |
| `dimension` | `geo` ou `secteur` |
| `cle` | géo : `canada`,`usa`,`europe`,`asie_pacifique`,`marches_emergents`,`autre` — ou un secteur |
| `poids` | en décimal (0.95 = 95 %) |

## Rappel

⚠️ Les valeurs de tous ces fichiers sont des **exemples de format à vérifier / remplacer**
par tes chiffres à toi. Tant qu'un fonds n'a pas de holdings/allocations, le chevauchement
et la géographie s'affichent « indisponible » — honnêtement, jamais devinés.
