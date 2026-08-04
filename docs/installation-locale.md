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
    ├── transactions    │   └── Tremblay-Marc\           ← LE MÊME NOM que ses documents
    │       ├── 2026-08-04_brut.txt   chaque collage, tel quel, jamais modifié
    │       └── transactions.json     le grand livre cumulatif, dédoublonné
    └── profils        └── 4471.json                 le profil fiscal — SANS aucun nom

**Un seul nom commande tout.** Celui que vous saisissez au moment de produire
un rapport nomme le dossier de documents ET le dossier de transactions : dans
l'explorateur, « Tremblay-Marc » se retrouve à l'identique des deux côtés. Seul
le profil fiscal est rangé sous un pseudonyme — c'est le fichier qui porte les
données sensibles, il n'a pas à porter aussi le nom. La table
`correspondance.json` fait le lien, en local uniquement.

**Ce dossier est volontairement HORS du projet.** Le dépôt vit sous
« OneDrive - IA Private Wealth » : y ranger des documents clients les enverrait
se synchroniser chez Microsoft. La racine par défaut est donc un chemin neutre.

Pour la déplacer, ajouter dans `.env.local` (jamais commité) :

    BASE_LOCALE_RACINE=D:\mes-donnees-planificateur

Choisir un dossier **hors OneDrive, hors Google Drive, hors Dropbox**, et
**toujours un chemin ABSOLU**.

> ⚠ Un chemin relatif — ou un backslash perdu, comme `C:planificateur-donnees`
> au lieu de `C:\planificateur-donnees` — se résoudrait depuis le dossier du
> projet. Des documents et des profils clients atterriraient alors dans le
> dépôt, sous OneDrive. **Le code refuse désormais toute racine située sous le
> projet** et retombe sur le défaut en l'écrivant dans la console ; le
> `.gitignore` couvre aussi ce cas en dernier recours. C'est arrivé une fois,
> le 4 août 2026, pendant les essais.

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

---

## Lancer l'app d'un double-clic

Trois scripts à la racine du projet.

| Script | À quoi il sert |
|---|---|
| `creer-raccourci-bureau.bat` | **Une seule fois** : pose « Planificateur » sur le Bureau |
| `lancer-planificateur.bat` | Démarre le serveur et ouvre la fenêtre d'application |
| `arreter-planificateur.bat` | Arrête le serveur (port 3000) |

### Ce que fait le lanceur

1. Affiche la **branche courante** — et ne la change jamais. Aucun `checkout`,
   aucun `pull` : ce qui est sur le disque est ce qui tourne.
2. Vérifie que `node_modules` existe, sinon dit quoi faire.
3. Démarre le serveur dans une fenêtre minimisée, **s'il ne tourne pas déjà**.
4. Attend qu'il réponde — jusqu'à 90 secondes, le premier démarrage compile
   tout le projet.
5. Ouvre **Edge ou Chrome en mode application** : une fenêtre dédiée, sans
   barre d'adresse ni onglets. À défaut, le navigateur par défaut.

Relancer le raccourci pendant que le serveur tourne **rouvre simplement la
fenêtre** — rien n'est redémarré.

### L'icône

Le raccourci prend l'icône par défaut d'un fichier `.bat`. Pour mettre celle de
GFSF : déposer le fichier dans `public\planificateur.ico` et relancer
`creer-raccourci-bureau.bat`.

### Si le projet déménage

Relancer `creer-raccourci-bureau.bat` : le raccourci pointe vers un chemin
absolu, il ne suit pas le dossier.
