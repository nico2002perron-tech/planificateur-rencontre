# planificateur-rencontre — instructions pour Claude Code

## ⛔ CONFIDENTIALITÉ — règle absolue, avant tout le reste

Tout ce que Claude lit (fichiers, sorties de terminal, captures d'écran) transite
par l'API de son fournisseur. En conséquence, dans toute session ouverte dans ce
dépôt :

- **Aucune donnée client réelle ne s'affiche, ne se sauvegarde, ne se recopie.**
  Ni nom, ni prénom (enfants compris), ni numéro de compte, ni relevé collé.
- **Les sondes et scripts de mesure impriment des agrégats, des comptages et des
  motifs — jamais d'exemples nominatifs.** Une note qui peut contenir un nom se
  compte, elle ne s'imprime pas.
- **Les sorties d'API locales se mappent en initiales AVANT affichage.**
- **Toute démo, épreuve ou capture d'écran se fait sur des clients FICTIFS**,
  supprimés ensuite (dossiers, profil ET entrée de correspondance).
- **Diagnostic sur données réelles** : seulement si indispensable, au minimum
  nécessaire, nom caviardé par Nicolas avant collage.
- Accès au dossier `EXECEL A PLANIF` (exports Croesus réels, jamais versionné) :
  mesures en **comptages et motifs seulement**.
- Les artefacts temporaires (C:\tmp, scratchpad, profils de navigateur des
  captures) se nettoient en fin de tâche — les caches de navigateur gardent des
  copies des pages visitées.

## Conventions du projet

- **Domaine fiscal et base locale : code et commentaires en FRANÇAIS.** Le
  schéma (`docs/schema-profil-fiscal-v1.md`) fait foi ; aucun champ improvisé.
- **Rien n'est deviné.** Une donnée manquante reste `null` et se déclare ; une
  règle naît d'une mesure sur le livre, et se rejette si la mesure la contredit.
- **Verrou fiscaliste** (`revisionFiscalisteRequise` dans
  `src/lib/profils/strategies.ts`) : tant qu'il tient, les documents fiscaux
  portent leurs mentions ; ne le lever que sur instruction explicite de Nicolas.
  Périmètre du mandat : section 8 du schéma.
- **Sorties réseau** : avant d'ajouter tout appel sortant, lire et mettre à jour
  `docs/sorties-reseau.md` — écrire ce que l'appel TRANSPORTE, pas seulement
  vers qui il va. La couche `reformuler()` reste débranchée sans feu de la
  conformité iA.
- **Git : Nicolas pousse lui-même**, sauf instruction explicite. Jamais de
  données dans le dépôt (`planificateur-donnees/`, `EXECEL A PLANIF/` sont
  ignorés — le rester).
- Tests : `npx vitest run` (Node pur, pas de jsdom ; les `.tsx` admis servent au
  rendu réel des pages PDF). Les fixtures utilisent des noms fictifs — elles
  partent sur GitHub.
- Rendu PDF : 100 % serveur. Pas de « ≈ » ni « ✓ » (glyphes absents des polices
  embarquées) ; toute nouvelle page se **rastérise et se regarde** avant d'être
  déclarée finie.
