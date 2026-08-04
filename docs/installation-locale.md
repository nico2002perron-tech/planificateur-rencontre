# La base locale — installation et fonctionnement

> Mise en place le 4 août 2026 (phase 1). Ce document décrit ce qui existe
> aujourd'hui, pas ce qui est prévu.

## À quoi ça sert

Quand l'app tourne **sur ton poste**, chaque document généré est aussi rangé
automatiquement sur le disque, classé par client. Rien de tout ça n'existe sur
Vercel : le serveur d'hébergement ne peut pas écrire sur ta machine, et surtout
les données clients ne doivent jamais y monter.

## Où vivent les données

    C:\planificateur-donnees\
    ├── documents\
    │   └── Tremblay-Marc\
    │       ├── 2026-08-04_cours-cibles.pdf
    │       └── 2026-08-04_cours-cibles_2.pdf     (2e version du même jour)
    ├── profils\          (phase 2 — profils fiscaux)
    └── historiques\      (phase 2 — collages Croesus et grand livre)

**Ce dossier est volontairement HORS du projet.** Le dépôt vit sous
« OneDrive - IA Private Wealth » : y ranger des documents clients les enverrait
se synchroniser chez Microsoft. La racine par défaut est donc un chemin neutre.

Pour la déplacer, ajouter dans `.env.local` (jamais commité) :

    BASE_LOCALE_RACINE=D:\mes-donnees-planificateur

Choisir un dossier **hors OneDrive, hors Google Drive, hors Dropbox**.

## Comment les noms de dossiers sont formés

Le nom saisi au moment de générer, rendu utilisable par Windows tout en restant
lisible : accents retirés, ponctuation retirée, espaces en tirets.

| Saisi | Dossier créé |
|---|---|
| `Tremblay Marc` | `Tremblay-Marc` |
| `Bélanger-D'Amour, Jean` | `Belanger-DAmour-Jean` |
| `9175-2592 QUEBEC INC.` | `9175-2592-QUEBEC-INC` |

Deux documents du même type le même jour ne s'écrasent pas : le second devient
`_2`, le troisième `_3`.

## Ce qui est garanti

- **L'archivage ne peut jamais faire échouer une génération.** Disque plein,
  dossier en lecture seule : le PDF part quand même vers le navigateur.
- **Rien ne s'écrit sur Vercel.** La détection est faite côté serveur à
  l'exécution ; le navigateur ne peut pas la forcer.
- **Rien n'est versionné.** `donnees-locales/` et `output/` sont au `.gitignore`,
  et la racine par défaut est de toute façon hors du dépôt.

## L'écran Documents

Menu latéral → **Documents** (visible seulement en local). Liste les clients et
leurs documents. La page répond 404 hors exécution locale.

## Vérifier que tout marche

    npx vitest run src/lib/base-locale

19 tests couvrent la normalisation des noms, la traversée de chemin, le refus
d'écrire sur Vercel et la non-divulgation de l'inventaire.
