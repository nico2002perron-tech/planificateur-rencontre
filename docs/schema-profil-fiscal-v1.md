# Moteur fiscal — schéma de profil et stratégies v1

Version de travail — 4 août 2026. À faire réviser par un fiscaliste avant tout usage client.

---

## 1. Principes hérités du moteur corpo

1. **Aucune devinette payante.** Toute donnée absente ou partielle produit un statut, jamais un chiffre inventé. Statuts possibles d'un constat : `calcule` | `montant-a-confirmer` | `indisponible` | `non-applicable`.
2. **Niveau de confiance propagé.** Chaque donnée porte une `portee` (`complete` | `interne-seulement` | `declaree` | `inconnue`). Un constat hérite de la portée la plus faible de ses intrants.
3. **La visibilité partielle est un constat en soi.** Quand `comptesExternes ≠ non`, le moteur génère une section « Angle mort » listant ce qu'il ne peut pas optimiser — c'est l'argumentaire de consolidation, généré client par client.
4. **Aucun taux fiscal codé en dur.** Les taux, seuils et plafonds vivent dans `config/parametres-fiscaux.csv` (année, juridiction, valeur, source) révisable sans toucher au code.

---

## 2. Schéma du profil client (`profils/<id>.json`)

```jsonc
{
  "id": "4471",                          // pseudonyme — jamais de nom ni de numéro de compte réel
  "dateMiseAJour": "2026-08-04",
  "version": 3,                          // incrémenté à chaque rencontre

  "demographie": {
    "age": 58,
    "etatCivil": "marie",               // celibataire | marie | conjoint-de-fait | veuf | divorce
    "province": "QC",
    "conjoint": {
      "age": 55,                         // null si inconnu
      "trancheRevenu": "50-100k"         // null si inconnu
    }
  },

  "revenus": {
    "trancheRevenu": "150-200k",         // tranches : 0-50k, 50-100k, 100-150k, 150-200k, 200k+
    "source": "declare",                 // declare (dit en rencontre) | document (avis de cotisation)
    "dateDonnee": "2026-08-04"
  },

  "consolidation": {
    "comptesExternes": "inconnu",        // oui | non | inconnu — LA question de rencontre n° 1
    "historiqueExterne": "inconnu",      // jamais | deja-eu | inconnu — a-t-il DÉJÀ eu des comptes ailleurs (même fermés)? Requis pour le calcul des droits CELI réels
    "detailsExternes": null,             // texte libre si oui ("CELI Banque X ~40k")
    "dateConfirmation": null,

    // AJOUT DU 4 AOÛT 2026 — RÉSOLUTION MANUELLE DES TRANSFERTS ORPHELINS.
    // La règle 4 du parseur présume EXTERNE tout transfert entrant non apparié :
    // mesuré sur le livre, cela rétrograde 75 % des comptes CELI en borne. Le
    // planificateur peut lever le doute un transfert à la fois, après en avoir
    // parlé au client. C'est le levier principal pour faire fondre ces 75 %,
    // avant même d'affiner la reconnaissance des notes d'appariement.
    "transfertsResolus": [
      {
        "cle": "37-3CTN-W|2021-03-15|40000.00",  // compte|date|montant — identifie le transfert
        "compte": "37-3CTN-W",
        "date": "2021-03-15",
        "montant": 40000,
        "resolution": "interne",                  // interne | externe
        "dateConfirmation": "2026-08-04",         // OBLIGATOIRE : une résolution non datée ne vaut rien
        "note": "confirmé en rencontre : venait de son REER"
      }
    ]
  },

  "droits": {                            // source autoritaire : avis de cotisation / Mon dossier ARC
    "reerInutilises":        { "montant": null, "dateDonnee": null },
    "celiInutilises":        { "montant": null, "dateDonnee": null },
    "celiConjointInutilises":{ "montant": null, "dateDonnee": null },
    "pertesCapitalReportees":{ "montant": null, "dateDonnee": null }
  },

  "cotisationsAnnee": {                  // dérivé automatiquement des transactions Croesus
    "reer": 0,
    "celi": 4000,
    "portee": "interne-seulement"        // devient "complete" si comptesExternes = non
  },

  "comptes": [                           // dérivé automatiquement de l'export positions
    {
      "type": "non-enregistre",          // reer | celi | cri | ferr | non-enregistre | corpo | reee
      "titulaire": "client",             // client | conjoint | conjoint-commun | societe
      "positions": [
        {
          "symbole": "XIU",
          "categorie": "actions-ca",     // repris des profils-instrument du moteur corpo
          "valeurMarchande": 84200,
          "valeurComptable": 59700,      // = PBR ; null si absent de l'export → gains latents indisponibles
          "revenuAnnuel": 1980           // colonne Croesus, même convention que le moteur corpo
        }
      ]
    }
  ],

  "transactionsAnnee": {                 // dérivé automatiquement des transactions Croesus
    "gainsRealises": 32400,
    "pertesRealisees": 3100,
    "retraitsReer": 0,
    "retraitsCeli": 0,
    "portee": "interne-seulement"
  },

  "historiqueVie": {                     // dérivé de l'import « historique complet depuis l'ouverture » (copier-coller)
    "celi": {
      "dateOuverture": "2015-03-12",
      "cotisationsTotales": 62000,
      "retraitsAnneesPassees": 8000,     // les retraits de l'année courante ne redonnent des droits que l'an prochain
      "transfertEntrantDetecte": false,  // true = preuve d'un compte externe passé → calcul des droits rétrogradé en borne
      "dateImport": "2026-08-04",
      "portee": "interne-seulement"
    },
    "reer": {
      "dateOuverture": null,
      "cotisationsTotales": null,
      "transfertEntrantDetecte": null,
      "dateImport": null,
      "portee": "interne-seulement"      // utile en contexte; ne permet JAMAIS de calculer les droits REER (revenus + FE requis)
    }
  },

  "intentions": {                        // 5 questions en rencontre, 2 minutes
    "ageRetraiteVise": null,
    "donsAnnuelsMoyens": null,
    "venteEntreprisePrevue": null,       // oui | non | null
    "achatImmobilierPrevu": null,
    "testamentAJour": null
  }
}
```

**Champs auto-remplis** (export Croesus) : `comptes`, `cotisationsAnnee`, `transactionsAnnee`, une partie de `demographie`.
**Champs auto-remplis par import manuel** (écran « Importer l'historique complet » — copier-coller du texte brut, parsé par le moteur) : `historiqueVie`.
**Champs de rencontre** (saisie manuelle, jamais bloquants) : `consolidation`, `droits`, `revenus`, `conjoint`, `intentions`.

### Règle du calcul des droits CELI réels

Le moteur peut calculer les droits CELI réels — plafond théorique selon l'âge (via `parametres-fiscaux.csv`) − `cotisationsTotales` + `retraitsAnneesPassees` — **uniquement si les trois conditions sont réunies** :
1. `historiqueVie.celi` importé et couvrant depuis `dateOuverture`;
2. `consolidation.historiqueExterne = "jamais"` (confirmé par le client, daté);
3. `historiqueVie.celi.transfertEntrantDetecte = false`.

Trois conditions réunies → constat `calcule`, portée `complete`. Sinon → affichage de la **borne supérieure théorique** seulement, clairement étiquetée comme borne, statut `montant-a-confirmer`, avec la question de rencontre correspondante. Rappel à imprimer avec la question : le chiffre CELI de Mon dossier ARC n'est mis à jour qu'une fois l'an et n'inclut pas les cotisations récentes.

**Effet des transferts résolus manuellement** (ajout du 4 août) : la condition 3
se lit sur les transferts **encore douteux**, pas sur les transferts détectés.
Un transfert orphelin marqué `interne` par le planificateur cesse de compter ;
un transfert marqué `externe` fixe définitivement `historiqueExterne` à
`deja-eu`. Un compte dont tous les transferts orphelins ont été résolus
`interne` redevient donc calculable — c'est le chemin prévu pour sortir de la
borne sans jamais relâcher la prudence par défaut.

Les droits REER ne sont **jamais** calculables à l'interne (historique de revenus et facteur d'équivalence requis) : avis de cotisation seulement.

---

## 3. Les 5 stratégies v1

| # | Stratégie | Intrants requis | Intrants bonus | Sortie si intrant manquant |
|---|-----------|-----------------|----------------|----------------------------|
| 1 | **Cristallisation de pertes (tax-loss harvesting) datée** | `transactionsAnnee.gainsRealises`, positions avec `valeurComptable < valeurMarchande` en non-enregistré | `droits.pertesCapitalReportees` | Sans `valeurComptable` : `indisponible`. Si `comptesExternes ≠ non` : `montant-a-confirmer` (coordination externe impossible) |
| 2 | **Localisation d'actifs** (intérêts/dividendes étrangers hors du non-enregistré) | `comptes` (types + catégories + `revenuAnnuel`), `revenus.trancheRevenu` | `droits.celiInutilises` | Sans droits CELI : constat `montant-a-confirmer` — recommande le principe, pas le montant à déplacer |
| 3 | **CELI du conjoint** | `demographie.conjoint.trancheRevenu`, `droits.celiConjointInutilises`, revenu de placement non enregistré du client | — | Sans données conjoint : `indisponible` + question de rencontre générée |
| 4 | **Don de titres avec gain latent** | `intentions.donsAnnuelsMoyens > 0`, position non enregistrée avec gain latent | `revenus.trancheRevenu` (valeur du crédit) | Sans intention de don : `non-applicable` (jamais suggéré de donner pour donner) |
| 5 | **Ordre de vente optimal vers le portefeuille cible** | paramètre `portefeuilleCible` (du planificateur), `valeurComptable` par position, `transactionsAnnee.gainsRealises` | `droits.pertesCapitalReportees`, `revenus` | Sans cible fournie : `non-applicable`. Sans PBR : `indisponible` |

Règle transversale de sécurité : **aucune stratégie ne recommande un montant de cotisation précis quand les droits sont inconnus ou que `comptesExternes ≠ non`** (risque de pénalité pour cotisation excédentaire). Le constat sort avec statut `montant-a-confirmer`.

---

## 4. Section « Angle mort » (l'argumentaire de consolidation)

Générée automatiquement quand `comptesExternes ∈ {oui, inconnu}`. Contenu :

- Liste des constats **dégradés** par le manque de visibilité, avec ce qu'ils deviendraient si les comptes étaient consolidés :
  - « Cristallisation de pertes : coordonnée sur les comptes iA seulement — les positions détenues ailleurs ne peuvent pas être incluses dans l'ordre de vente. »
  - « Suivi de cotisation CELI : 4 000 $ vus chez iA — montant total inconnu, plafond non vérifiable. »
- Une phrase de synthèse factuelle : « X constats sur Y sont limités par des données hors iA. »

Ton : factuel, jamais vendeur. La liste EST l'argument.

---

## 5. Contrat d'interface avec planificateur-rencontre

```ts
analyser(
  profil: ProfilClient,
  portefeuilleCible: PortefeuilleCible | null,   // sortie existante du planificateur
  date: string                                    // "2026-08-04" — imprimée sur le document
): {
  constats: Array<{
    strategie: string;            // identifiant du catalogue
    statut: "calcule" | "montant-a-confirmer" | "indisponible" | "non-applicable";
    portee: "complete" | "interne-seulement" | "declaree" | "inconnue";
    montantEstime: number | null; // null sauf si statut = calcule
    recurrence: "annuel" | "unique";
    explication: string;          // générée par le LLM à partir des chiffres du moteur — jamais l'inverse
    donneesManquantes: string[];  // alimente la liste de questions de rencontre
    sources: string[];            // ex. ["profil v3", "parametres-fiscaux 2026", "regles v1.0"]
  }>;
  angleMort: { constatsLimites: number; total: number; details: string[] } | null;
  questionsRencontre: string[];   // agrégat des donneesManquantes, dédupliqué et ordonné par impact
}
```

Le planificateur consomme ce JSON et le met en page (navy/cyan/or) comme une section datée du PDF. Zéro logique fiscale dans le planificateur ; zéro mise en page dans le moteur.

---

## 6. Vérifications avant de coder

1. **L'export positions contient-il la valeur comptable (PBR)?** Détermine si les stratégies 1, 4 et 5 partent en v1 ou attendent.
2. **L'export transactions distingue-t-il les types d'opérations** (achat, vente, cotisation, retrait, dividende, transfert entrant/sortant)? Requis pour dériver `cotisationsAnnee`, `transactionsAnnee` et `historiqueVie` automatiquement — la détection des transferts entrants est critique pour la règle des droits CELI.
   2b. **L'historique complet depuis l'ouverture** (accessible par copier-coller) a-t-il le même format que l'export annuel? Si oui, un seul parseur sert aux deux; réutiliser les règles de lecture déjà rodées (antichronologie intra-jour, clé symbole+devise, dédoublonnage).
3. **Réponse de la conformité iA** sur l'hébergement des données clients (dossier déjà ouvert pour le moteur corpo — même socle).
4. **Révision fiscaliste** du catalogue et de `parametres-fiscaux.csv` avant toute version remise au client. La version conseiller peut vivre sans, la version client non.

---

## 7. Amendements datés au schéma

Le schéma fait foi ; ces amendements en font partie. Chacun est né d'une
mesure ou d'un défaut constaté, jamais d'une préférence.

### 5 août 2026 — `comptes[]` ne peut pas être un champ auto-rempli

Le document rangeait `comptes` dans les « champs auto-remplis (export
Croesus) » tout en donnant `titulaire` comme champ de rencontre. Les deux ne
pouvaient pas être vrais. La mise à l'épreuve du raccordement a montré que
trois des quatre champs de `Compte` sont **insatisfiables sans deviner** :

| champ | ce que le relevé en dit | décision |
|---|---|---|
| `numero` | rien — le relevé ne porte que le **suffixe** | `string \| null` + `suffixe` + `provenanceNumero` |
| `type` | rien — la table des suffixes est celle d'iA | `TypeCompte \| 'reer-conjoint' \| null` |
| `titulaire` | rien — aucune des 13 colonnes | `Titulaire \| null`, champ de **rencontre** |
| `positions` | tout sauf la catégorie | `categorie` reste `null` |

**Pourquoi le numéro ne peut pas être deviné.** 65 clients du livre ont deux
comptes finissant par la même lettre. Remplir `numero` dans ce cas exigerait de
choisir un candidat — c'est-à-dire d'écrire une invention dans la clé durable
dont tout le reste dépend ensuite. `provenanceNumero` porte donc cinq valeurs :
`livre` (candidat unique), `confirme` (tranché en rencontre), `ambigu`,
`absent`, et `non-jointable`.

**`non-jointable` mérite son nom.** Chez VMBL le dernier caractère du numéro
est un **chiffre** (`4A-Y3VI-6`) alors que la colonne 4 d'un relevé porte une
lettre : les deux ne se comparent pas. Ça touche 424 comptes VMBL plus les
9 comptes `~E`, soit **433 sur 3 325 — 13 % du livre**. Les confondre avec un
compte inconnu ferait disparaître l'écart au lieu de le montrer.

**Pourquoi le type ne peut pas venir du suffixe seul.** `TYPE_PAR_SUFFIXE` est
la table iA, et rien dans un relevé ne dit de quelle convention relève le
compte. Le cas qui tranche : suffixe `Q` → la table iA dit `celiapp`. Or VMBL a
10 comptes en `Q` ouverts en 2009, et le CELIAPP date de 2023. Un type déduit
du suffixe inventerait un régime qui n'existait pas à l'ouverture du compte —
et le CELIAPP entraîne des conseils de cotisation.

### 5 août 2026 — deux champs ajoutés, deux erreurs évitées

- **`Position.devise`** — la règle héritée du grand livre est formelle :
  « clé de position = symbole + devise ». Le CDR canadien et l'action
  américaine portent le même symbole ; les confondre a coûté 65 470 $ d'erreur
  avant correction. La devise était lue par le parseur puis jetée.
- **`Compte.encaisse[]`** — sans elle, une marge débitrice (le cas réel des
  tests : −160 675,63 $) disparaissait du profil et le compte paraissait plus
  riche qu'il n'est.
- **`Compte.dateReleve`** — sans elle, deux comptes datés de deux mois
  différents s'additionnent en un total qui n'a existé à aucune date.

### 5 août 2026 — `comptes` est DÉRIVÉ à la lecture, pas figé dans le JSON

Même raison que `historiqueVie` : un profil écrit avant un changement de règle
porterait un chiffre périmé sans que rien ne le signale. Ce qui est persisté,
c'est **le relevé brut horodaté** et **les tranchages datés** ; `comptes` se
reconstruit à chaque affichage. Le jour où la jointure s'améliore — ou le jour
où la mesure ci-dessous est faite — tous les profils se réparent d'un coup.

### 17 août 2026 — `Compte.presence` : les comptes vus au livre seulement

**Demande de Nicolas** : « par les transactions et les positions collés des
cours cibles je veux qu'il arrive à faire des liens selon le type de compte
existant, etc. les comptes qui ont été fermés (sans compter ceux de chez
VMBL) ».

**Ce qui manquait.** `deriverComptes()` ne parcourait que le RELEVÉ : un compte
présent dans l'historique des transactions mais absent du relevé du jour
n'était émis nulle part. Ses **lignes** n'étaient pas perdues — les dérivations
de régime lisent le livre entier, donc les cotisations d'un CELI fermé
comptaient déjà dans les droits — mais il n'existait aucune **entité** : pas de
type affiché, pas de dernière activité, rien à l'écran.

**Le champ.** `Compte.presence`, deux valeurs :

| valeur | sens |
|---|---|
| `au-releve` | le compte porte des positions (ou une encaisse) dans le relevé du jour |
| `livre-seulement` | le compte apparaît dans les transactions, mais plus dans le relevé |

**`livre-seulement` NE VEUT PAS DIRE « FERMÉ ».** On observe une absence, pas
une fermeture : le compte peut être fermé, transféré ailleurs, ou simplement
vidé. Le mot « fermé » serait une déduction, et le schéma en interdit une de
plus. L'écran et le document disent « plus de position aujourd'hui ».

**Pourquoi un champ à part de `provenanceNumero`.** Les deux axes sont
orthogonaux : `provenanceNumero` dit la confiance dans le NUMÉRO, `presence`
dit si le compte détient encore quelque chose. Un compte venu du livre a un
numéro certain (`livre`) et une présence nulle (`livre-seulement`).

**Les comptes VMBL sont EXCLUS de cette passe**, sur consigne du 12 août
(« fie-toi aux comptes qui commencent par 37 »). Attention : ce qui les tenait
à l'écart jusqu'ici n'était pas une règle mais un accident — leur suffixe est
un chiffre, celui du relevé une lettre, donc les clés ne se croisaient jamais.
Une passe inverse sans filtre explicite ferait apparaître **~424 comptes VMBL**
comme absents du relevé. D'où le prédicat `estCompteIA()`, écrit pour cette
passe et appelé par elle.

### 18 août 2026 — `demographie.anneeNaissance` : la voie rapide

**Demande de Nicolas** : « je veux que ce soit extrêmement friendly, marquer la
date de naissance de façon super vite ».

**Le fait qui la rend possible** : pour le plafond CELI cumulatif, seule
l'ANNÉE compte — c'est l'année des 18 ans qui fixe le départ du cumul. Quatre
chiffres donnent donc un résultat **exact**, pas approché ; une date complète
ne dirait rien de plus pour ce calcul.

| champ | usage |
|---|---|
| `dateNaissance` | la date exacte — prioritaire quand elle existe |
| `anneeNaissance` | l'année seule, saisie en quatre frappes |

L'ordre de dérivation est : date exacte, puis année seule, puis `age` saisi.
Ce n'est pas un doublon : c'est un raccourci qui rend le même chiffre.

**Le moteur la RÉCLAME quand elle change le résultat, et seulement là.** Sans
elle, `plafondCeliCumulatif` suppose 18 ans en 2009 et prend le plafond
maximal, ce qui **surestime** l'espace. `SignauxLivre.plafondParDefautMaximal`
porte l'information jusqu'à la stratégie 8, qui l'ajoute alors à ses données
manquantes — et le détecteur la classe naturellement en tête, puisqu'elle est
la moins chère du catalogue.

### 19 août 2026 — la ligne du temps des flux : étapes 0 à 2

**Ce qui est tranché (étape 0).**

- **`Q` = CELIAPP**, confirmé par Nicolas. `TYPE_PAR_SUFFIXE` le disait déjà ;
  `ACCOUNT_TYPE_MAP` ne connaissait pas Q et l'a reçu le même jour (lot des
  tables de régimes, verrouillé par `tables-de-regimes.test.ts`) ; un cahier des
  charges le donnait comme CELI. C'est le cahier qui se trompait.
- **La date fiscale : incohérence DOCUMENTÉE, comportement INCHANGÉ.** Le modèle
  `LigneTransaction` porte deux dates — `date` (colonne « Transaction ») et
  `dateReglement` (colonne « Traitement »). Le commentaire du type déclare
  `dateReglement` comme « l'axe fiscal ». Or **tout `deriver.ts` attribue une
  ligne à une année par `date`**, jamais par `dateReglement` (5 occurrences :
  `l.date.slice(0, 4)`, `l.date.startsWith(annee)`). Et la démarche D3 remise
  au client dit : « c'est la date de règlement, pas la date de l'ordre, qui
  détermine l'année fiscale ». Les trois ne peuvent pas être vrais ensemble.
  Cas concret : une vente ordonnée le 30 décembre, réglée le 2 janvier, change
  d'année selon la convention. **Décision de Nicolas : on ne change rien tant
  que ce n'est pas tranché** — c'est une question pour le fiscaliste (ajoutée
  en Q6, section 8.1), pas un correctif à faire à l'aveugle.

**Ce qui est ajouté (étapes 1 et 2) — ADDITIF, aucun chiffre existant ne bouge.**

| Ajout | Où | Ce que c'est |
|---|---|---|
| `sousTypeCompte(noCompte)` | `parseur-croesus/types.ts` | `{ lettre, regime, sousType, devise, table }` ou `null`. Invariant testé : `regime` est TOUJOURS égal à `typeDeCompte(noCompte)`, et `null` exactement quand lui. Nouveau : le sous-type (`comptant`, `marge`, `revenu`…) et la devise du compte (`A`→CAD, `B`→USD, `E`→CAD, `F`→USD, `J`→CAD ; `null` pour les régimes enregistrés, dont la lettre ne porte pas la devise). `table` dit la TABLE lue (`suffixe-ia` / `lettre-vmbl`), pas l'institution prouvée — c'est `estCompteIA()` qui prouve. ⚠ `ACCOUNT_TYPE_MAP` libelle F « Devise » ; le sous-type `marge USD` est une déclaration de Nicolas, NON MESURÉE — à harmoniser après la mesure E/F. |
| `suffixesJumeauxDevise(a, b)` | `parseur-croesus/types.ts` | vrai pour A/B et E/F (deux faces CAD/USD d'un même sous-type). Lien E/F déclaré, non mesuré, réservé à l'étape 3. |
| `classerLigne(ligne)` | `profils/flux.ts` (nouveau) | une nature PROVISOIRE par ligne, tirée d'une **liste blanche de libellés** Croesus. Un libellé jamais vu → nature `inconnu`, et il est COMPTÉ et NOMMÉ dans le diagnostic. Jamais rangé par défaut. |
| `diagnostiquerClassification(lignes)` | `profils/flux.ts` | comptages par nature et par confiance, libellés inconnus nommés (normalisés ; tout libellé non textuel replié sous une seule clé, pour qu'un collage décalé ne fasse jamais sortir un numéro de compte), LIGNES dont le compte est sans régime prouvé comptées — des AGRÉGATS, jamais une ligne. |

**Ce que l'étape 2 ne fait PAS, à dessein** : aucun rapprochement (partie
double, conversion, virement à deux jambes, renversement). Ces natures sont
déclarées dans le vocabulaire (`conversion-devise`, `annule`…) mais aucune ligne
ne les reçoit encore. C'est l'étape 3, qui exige d'abord une MESURE sur le
livre (comptages seulement) du ratio E/F des conversions.

**Trouvaille en chemin, hors périmètre, à ne pas perdre** : `TYPE_PAR_LETTRE_VMBL`
rend `'reer-conjoint'` pour la lettre VMBL `S`, valeur que `TypeCompte` ne
connaît pas mais que `Compte.type` tolère déjà explicitement. Ce qui est nouveau :
`pourRegime()` et toutes les signatures `regime: TypeCompte` de `deriver.ts` ne
peuvent pas la demander, donc les REER de conjoint VMBL n'entrent dans aucune
dérivation. Pré-existant, non touché ici — à trancher avec la ligne du temps.

**Contre-expertise du 19 août** (5 lentilles adverses, 30 trouvailles confirmées
sur 31) : toutes corrigées avant cette livraison — voir l'en-tête de `flux.ts` et
la règle 7 de `docs/regles-parseur.md`.

### 19 août 2026 (soir) — `ligneDuTemps` : la comptabilité événementielle, EN PARALLÈLE

**Champ ajouté** : `ProfilClient.ligneDuTemps?` — OPTIONNEL, dérivé À LA LECTURE
par `hydraterProfil()` (même doctrine que `comptes`), JAMAIS persisté dans le
JSON du profil. `undefined` sans livre.

**Ce qu'il contient** (`src/lib/profils/ligne-du-temps.ts`) : chaque ligne du
livre devient UN événement (nature, confiance, motif, source) ; les événements
s'agrègent par année × régime × devise, chaque agrégat gardant les ids de ses
sources ; les conversions FX-1/FX-2 paraissent comme telles (flux externe nul) ;
ambigus, inconnus et virements internes sont des collections séparées ; les
cumulatifs comptent depuis le début de l'HISTORIQUE DISPONIBLE — jamais le
dossier ARC. Un invariant de partition (testé) garantit qu'aucune ligne ne
disparaît : lues = conversions + agrégés + hors-flux + virements + ambigus +
inconnus + non-agrégés.

**CE QUE PERSONNE NE CONSOMME ENCORE** : strategies.ts, le PDF et les
dérivations historiques (`deriverCotisationsAnnee`, `deriverCeliParAnnee`,
`cotisationsReeeParEnfant`) sont INCHANGÉS. Les deux systèmes vivent en
parallèle, comparés par `parite-derivations.test.ts`, qui documente quatre
divergences VOULUES (retraits notés = virements internes ; retraits en titres
déclarés plutôt que sommés ; REEE sans bénéficiaire gardé sous « (inconnu) » au
lieu d'être jeté ; conversions nommées au lieu d'ignorées). La bascule des
consommateurs vers la timeline est une décision à part, pas un effet de bord.

**Extensions additives des primitives, pour la traçabilité** :
`separerCotisations()` rend en plus `lignesArgentNeuf` (les jambes argent
comptées — somme exacte de l'argent neuf) ; `beneficiaireReeeDeLaNote()` est
extraite de `cotisationsReeeParEnfant` (MÊME regex, comportement identique,
9 tests inchangés).

### 20 août 2026 — bascule contrôlée : la maximisation CELI lit la timeline

**Ce qui a basculé** : `signauxDuLivre` (hydrater.ts) alimente
`analyserMaximisation` par `vueCeliParAnnee(timeline)` au lieu de
`deriverCeliParAnnee`. C'est le SEUL consommateur qui change. Les DROITS CELI ne
passent pas par là (`deriverHistoriqueRegime`, chaîne intacte) ; REER, REEE,
FERR, stratégies et PDF : inchangés.

**D5 tranché** : une cotisation ou un retrait CELI en devise étrangère n'est
plus fondu au nominal dans les dollars canadiens. Aucun taux n'est inventé :
le montant est exclu des nombres CAD et DÉCLARÉ dans
`completude.deviseEtrangere` — son équivalent CAD fiscal est « à confirmer ».
Le calcul exact des droits avec conversion viendra d'une donnée structurée
future, pas d'une approximation.

**D1 documenté, pas tranché** : un retrait dont la note cite un compte (ou en
titres) est « à confirmer » — Croesus seul ne dit pas si l'argent a quitté
l'abri (vrai retrait) ou changé de CELI (aucun droit recréé). La vue expose
`retraits = fermes + àConfirmer` : une BORNE SUPÉRIEURE, le côté sûr pour la
preuve « depasse-cumul » (sous-compter fabriquerait une fausse accusation — le
défaut du 12 août). Le futur lot des droits consommera `retraitsFermes` +
résolution manuelle, jamais la borne.

**`deriverCeliParAnnee` reste comme TÉMOIN de parité** (défaut D5 intact, à
dessein) — sa retraite est une décision du prochain lot.

### 20 août 2026 (soir) — le signal de maximisation dit ses limites

**Ce qui change** : `analyserMaximisation` reçoit désormais la **vue entière**
(`VueCeliParAnnee`), plus jamais deux dictionnaires nus — impossible de lui
passer les nombres sans la complétude qui les qualifie. Le signal rapporte
`limites` (structuré : `limitations[]` en ordre fixe + devises, total à
confirmer, ambigus, portée), et la stratégie `droits-cotisation` GÉNÈRE le
texte d'écran depuis ces limitations — même limitation, même phrase, et chaque
cause chiffrable devient une donnée manquante classée par l'écran des manques.

**La matrice de prudence** (dans `signaux-livre.ts`, chaque case argumentée par
sa direction d'erreur) :

| Limite | maximise / sous-plafond | depasse-cumul |
|---|---|---|
| Cotisations étrangères | → indéterminé (un « au plafond » pourrait être l'inverse : un depasse-cumul caché) | TIENT (exclure des cotisations réduit le total vu — preuve a fortiori) |
| Retraits étrangers | tiennent (aucun test par année ne lit les retraits) | → indéterminé (seuil d'accusation artificiellement bas — le défaut du 12 août) |
| Événements ambigus | → indéterminé | → indéterminé (direction inconnue : cotisation cachée OU renversement) |
| Sorties à confirmer | tiennent | TIENT (elles GONFLENT le seuil : une preuve qui tombe malgré la borne tient quelle que soit leur résolution) — mais l'écran dit : calcul prudent ≠ montant fiscal confirmé |
| Portée | déclarée, aucune rétrogradation (« vu d'ici » a toujours été la condition du signal) | idem |

**Ce que ce lot ne touche pas** : le calcul des droits CELI
(`deriverHistoriqueRegime`, `calculerDroitsCeli`), toute conversion USD→CAD,
REER/REEE/FERR, les autres stratégies, le PDF (il reçoit le même texte de
constat, sans code modifié). Les champs chiffrés du signal (depuis,
totalCotise, anneesSousPlafond…) restent des faits exacts sur le périmètre CAD
déclaré partiel — jamais effacés, jamais extrapolés.

### 20 août 2026 (nuit) — la couche « montant fiscal CAD » du CELI

**Le lot** (`src/lib/profils/vue-fiscale-celi.ts`, ADDITIF — rien ne le
consomme encore, aucun droit calculé, `deriverHistoriqueRegime` intacte) :
chaque événement CELI (cotisation, retrait ferme, sortie à confirmer) porte un
`MontantFiscalCad` — montant original + devise + équivalent CAD **ou null** +
source + confiance + taux/date + motif + événements fondateurs. Un `number` nu
ne peut plus faire disparaître la provenance.

**Les sources, de la plus forte à l'absence** : `resolution-manuelle`
(grandeur CAD confirmée à la main, datée, événement source intact — devise
étrangère seulement) → `transaction-cad` → `taux-explicite-croesus` (la note
de la ligne MÊME, mot-clé seulement via `tauxExplicitesDansNote`, convention
directe mesurée, **USD seulement**, confiance `eleve` jamais `confirme` — rien
ne valide ce taux par un ratio, contrairement à FX-1 ; deux taux différents =
contradiction → null) → `conversion-fx-rapprochee` (**réservée, jamais émise**
— aucune règle mesurée ne relie une paire FX à un flux CELI, et la proximité
n'est pas une relation) → `inconnue` (null + motif ; jamais 1:1, jamais un
taux de marché — `useUsdCadRate` reste un outil d'affichage portefeuille).

**L'identité stable** : `cleEvenementFiscal(compte, date, devise, montant)` —
le miroir de `cleTransfert`, plus la devise (GARDÉE : trois lettres ou
`(devise-invalide)` — la leçon de la colonne « type »). Les résolutions
manuelles (`ResolutionMontantFiscalCad`) visent cette clé, ne modifient JAMAIS
la transaction historique, et TOUT refus (sans cible, clé partagée, événement
déjà en CAD, hors de portée de la vue, contradictions, grandeur non positive,
résolution suivant une refusée) est déclaré dans `resolutions.ignorees` —
champ d'écran interne, PAS un diagnostic : les `diagnostics` de la vue restent
des comptages seulement, par doctrine. Rien n'est persisté : le schéma ne
change pas dans ce lot — l'écran et le rangement (probablement
`consolidation`) sont une décision future.

**Les gardes de la contre-expertise du 20 août** (5 chercheurs adversariaux,
9 défauts sérieux corrigés) : frontière gauche des mots-clés de taux
(« CAPITAUX 5,000.00 » fabriquait un taux de 5 — corrigé dans la regex
partagée, le FX en profite) ; « @ » sans vocabulaire de conversion = un PRIX,
pas un taux ; « EN USD » refusé (convention jamais mesurée — seule « EN CAD »
directe l'a été) ; arrondi au cent SYMÉTRIQUE (la grandeur ne dépend plus du
signe) ; et surtout `completude.evenementsCeliNonExprimes` : les événements
CELI que la vue ne sait pas exprimer (virements internes en attente de
l'étape 4, « Dépôt » que la règle 2 ne voit pas, libellés inconnus) BLOQUENT
les trois drapeaux — un Transfert noté ou un Dépôt laissaient un faux vert
intégral. Le motif du null est le vrai motif : une note qui contient un
nombre-candidat non reconnu le dit, au lieu de jurer « sans taux ».

**Signalé, pas corrigé (décision requise)** : ① la jambe TITRE d'une partie
double CELI tombe en `ambigu` résiduel — le même apport est compté (jambe
argent) ET déclaré ambigu ; `retraitsNatureConfirmee` et la limitation
`evenements-ambigus` du signal de maximisation restent donc au rouge sur tout
dossier à apports en nature (~46 % des cotisations mesurées sont appariées).
Faux rouge conservateur, jamais un montant faux — mais le lever exige de
rendre visibles les jambes consommées par la règle 2 (retour additif de
`separerCotisations`) : un lot à part. ② « Dépôt » CELI : la règle 2
doit-elle le voir ? À mesurer sur le grand livre. ③ Les clés d'agrégats de la
timeline portent la devise BRUTE (non gardée) — surface pré-existante. ④ Le
taux FX à 0 en note : motif corrigé (« inexploitable » au lieu d'« écart
Infinity % »), comportement inchangé.

**Les deux questions d'un retrait ne se confondent jamais** : montant CAD
(question A, cette couche) ≠ nature vrai-retrait/virement (question B, D1/D2).
`retraitsCadConfirmes` exige les DEUX ; un montant résolu sur une sortie à
confirmer va dans `retraitsCadAConfirmer`.

**La complétude** (`vueFiscaleCeli(timeline, resolutions, options)`) :
`toutesCotisationsEnCadFiscal` / `tousRetraitsEnCadFiscal` (STRICTS : confiance
`confirme` ; vrais à vide — toujours croiser avec `portee`),
`retraitsNatureConfirmee` (aucune sortie à confirmer NI ambigu résiduel),
`activiteExterneConfirmeeAbsente` (fournie par l'appelant depuis la
consolidation, jamais devinée). Le critère de GO de la future migration des
droits : ces préconditions, pas un lot de plus de chiffres.

### 20 août 2026 (nuit, lot 2) — parties doubles expliquées, et le verdict « Dépôt »

**① Le faux rouge est levé.** La jambe TITRE d'un apport en nature COMPTÉ était
consommée par `separerCotisations` (un `splice` interne) sans que personne, au
dehors, ne puisse le savoir : la timeline la retrouvait à l'étape 3 et la
classait « ambigu » (montant négatif, note non concluante). La complétude et la
limitation `evenements-ambigus` du signal de maximisation rougissaient donc
au-dessus d'un apport parfaitement compris.

Correction, sans deuxième règle : `separerCotisations` rend désormais
`pairesArgentNeuf` (additif — jambe argent ↔ jambe titre, pour les apports
étiquetés « cotisation », donc COMPTÉS ; ceux à trancher restent dans
`apportsATrancher`, une attente réelle). La timeline pose une disposition
`consommee-partie-double`, garde la ligne VISIBLE (`consommesPartieDouble`,
`partiesDoubles`, motif réécrit : « consommée, le montant est porté par la
jambe argent #N »), et la vue fiscale l'exclut des non-exprimés tout en
ajoutant la jambe titre aux `sources` du montant. **Aucun montant ne change** —
seule la disposition bouge.

**L'invariant d'unicité** (§6 du lot) est testé de l'extérieur : sur un lot
mélangé, agrégats / conversions FX / consommées / ambigus / inconnus /
virements sont deux à deux DISJOINTS, et Σ dispositions = lignes lues. Aucune
collision FX possible par construction (jambes FX = Transfert/Réception, jambes
règle 2 = Cotisation, et le groupement exclut toute ligne déjà disposée).

**② « Dépôt » : NO-GO mesuré** — voir `docs/mesure-depot-celi-2026-08-20.md`
(instrument `scripts/mesurer-depot-celi.mjs`, lecture seule, agrégats
seulement, masque d'identité + garde anti-fuite automatique ; base locale,
8 590 lignes, 7 clients).

| Régime | Lignes « Dépôt » | Ce qu'elles sont |
|---|---|---|
| CELI | **1** (2009, 152,38 $, note « FRAIS DE … », contrepartie interne le même jour) | un remboursement de frais — pas une cotisation ; seau « indécidable » |
| CELIAPP | **0** | rien à décider (le régime n'existe que depuis 2023) |

Comparaison : l'argent neuf CELI reconnu par la règle 2 = 9 jambes, **toutes**
en encaisse positive. Une occurrence unique, qui ressemble de surcroît à un
remboursement de frais, ne fonde aucune règle : `Dépôt` **n'entre pas** dans
l'argent neuf CELI/CELIAPP. Il reste DÉCLARÉ dans `evenementsCeliNonExprimes`
— le NO-GO n'est pas un silence. (Le REEE garde SA règle historique, où
« Dépôt » compte : mesuré là-bas, pas ici.) À re-mesurer sur le grand livre.

**Avant/après des non-exprimés CELI** (base locale) : jambes titre consommées
**1** — comptée « ambigu » avant. Donc ambigus résiduels **9 → 8**,
non-exprimés **178 → 178** (cette base ne porte qu'un seul apport en nature
CELI ; l'effet est structurel, pas volumétrique ici). Les 178 restants, par
type : `valeur comptable` 59, `tvp` 17, `tps` 17, `remboursement` 17,
`cotisation (virement-interne)` 15, `echange` 11, `frais de gestion` 11,
`transfert (virement-interne)` 11, `frais` 7, `cotisation` 6, `expiration` 2,
`depot` 1.

**Ce que ce reste révèle** (signalé, non corrigé) : la moitié de ces types —
`valeur comptable`, `tps`, `tvp`, `frais`, `frais de gestion`, `échange`,
`expiration` — sont des lignes d'inventaire, de taxes ou de frais que
l'instrument de mesure du 19 août classait déjà « pas un flux de capital »,
mais que la liste blanche de `flux.ts` ne connaît pas : elles sortent donc
`inconnu`. Les élargir est une décision de classification à part (mesure +
barème), pas un effet de bord de ce lot. Les 26 `virement-interne` attendent
l'étape 4 (double lecture E→W), et les 6 `cotisation` sont des jambes que la
règle 2 n'a pas retenues comme argent neuf.

### 20 août 2026 (lot 3) — « hors flux » devient une classification POSITIVE

**Le problème** : 178 événements CELI « non exprimés » bloquaient la
complétude, dont ~124 lignes de frais, de taxes et d'opérations sur titre que
le moteur ne comprenait pas *faute de mesure* — pas parce qu'elles étaient
douteuses. Un faux rouge, aussi trompeur qu'un faux vert.

**La mesure d'abord** (`docs/mesure-types-hors-flux-2026-08-20.md`,
instrument `scripts/mesurer-types-hors-flux.mjs`) : chaque type profilé sur 14
dimensions, CELI et CELIAPP séparément.

| Type | Mesure (CELI) | Décision |
|---|---|---|
| TPS · TVP | 17 + 17 lignes, **toutes** négatives, en encaisse, quantité nulle ; accompagnées d'un frais le même jour sur le même compte **17/17**, au taux exact de la taxe (**5,0 %** et **10,0 %**) | → `frais-impot` |
| Frais de gestion · Frais | 11 + 7 lignes, négatives, en encaisse, notes « FRAIS GEST. … » (1 seul « Frais » positif, note citant deux comptes) | → `frais-impot` (le positif reste **ambigu**) |
| Échange | 11 lignes, toutes en titres, 10 à total nul, **0/11** d'impact sur l'encaisse, 11/11 appariées le même jour | → `operation-titre` |
| Expiration | 2 lignes, en titres, total nul, quantité non nulle, **0/2** d'impact encaisse | → `operation-titre` |
| Remboursement | 17 lignes, **toutes** en titres, positives, **0/17** d'impact encaisse, **15/17** accompagnées d'« Intérêts » le même jour — le capital d'un titre à échéance | → `operation-titre` |
| **Valeur comptable** | 59 lignes. L'hypothèse « écriture d'inventaire » **testée et REFUSÉE** : par compte-jour, le net vaut ≈ 0 dans **3 groupes sur 4**, mais le 4ᵉ laisse **−9 000,00 $** | **reste `inconnu`** |
| TVH | **0 occurrence** | reste `inconnu` (entrera à sa première occurrence) |
| Livraison | 1 ligne CELI à −152,38 (2009) — le **miroir exact** du « Dépôt » de +152,38 du lot précédent : un virement interne, étape 4 | reste `inconnu` |

**La distinction qui compte** (§5-§6 de la consigne, et la raison d'être de la
nature `frais-impot`) : des frais SORTENT de l'argent du CELI — mais ce n'est
PAS un retrait du titulaire, et **aucun droit de cotisation n'est recréé**
l'année suivante. « Total négatif → retrait » n'a jamais été une règle ici ;
c'est maintenant verrouillé par un test nommé « FAUX RETRAIT ».

**Effet mesuré** : non-exprimés **178 → 96**, ambigus résiduels **8 → 9** (le
« Frais » positif, désormais compris comme douteux au lieu d'inconnu). Restent :
59 `valeur comptable`, 27 virements internes (étape 4), 6 cotisations ambiguës,
et 4 singletons (`depot`, `livraison`, `ajustement`, `fractionnement`). **Aucun
montant fiscal ne change** — invariant testé.

**Une seule source** (§19) : toutes les règles vivent dans `classerLigne()` ;
`NATURES_HORS_FLUX` est exportée de `vue-fiscale-celi.ts` et consommée par les
instruments — la copie locale que l'instrument gardait s'était désynchronisée
le jour même où `frais-impot` est entré, ce qui a servi de démonstration.

**Ce que la contre-expertise adversariale a fait corriger** (5 lentilles,
43 allégations, 13 confirmées par reproduction, le reste réfuté) :

1. **LA NOTE PRIME, MÊME HORS FLUX.** Les branches hors flux rendaient AVANT
   que la note ne soit lue : un « Frais » de −25 000 $ noté « VIRE DE 37FICTE »
   sortait `frais-impot`/`confirme` → hors flux → **invisible**, et les trois
   drapeaux passaient au vert. De l'argent quittait un CELI vers un compte
   NOMMÉ, déclaré « taxe du service ». La classe d'entrée est mesurée : la
   seule ligne « Frais » à note citant des comptes ne s'en sauvait que par son
   signe. Désormais : `ambigu` (pas `virement-interne` — une note de frais peut
   nommer le compte facturé, et envoyer l'étape 4 chercher une jambe
   inexistante serait une autre invention). Périmètre : les libellés de ce lot ;
   `Achat`/`Vente`/`Dividendes` gardent le comportement du 19 août.
2. **L'instrument était circulaire** : il cessait de profiler un type dès qu'il
   était classé — l'archive perdait donc la preuve qui avait fondé la règle.
   Les types sous revue sont maintenant nommés et profilés quoi qu'il arrive.
3. **Le petit `n` est une fuite** : `min · p25 · médiane · p75 · max` sur une
   seule valeur, ce sont cinq copies du montant exact d'une transaction réelle.
   Les archives en portaient six. Sous 5 valeurs, seul l'ordre de grandeur sort.
4. **Le masque et la garde** : le préfixe de compte `~E` n'était jamais masqué
   (`\b` ne peut pas s'amorcer sur `~`) — les préfixes viennent désormais de
   `PREFIXES_CONNUS` ; la garde ne cherchait que la forme accentuée des noms de
   dossiers alors que le seul canal qui peut en émettre **désaccentue** ; la
   rareté se comptait en lignes et globalement (un seul client bavard rendait
   « public » le nom de son notaire) — elle se compte maintenant en **clients**.
5. **Le verrou « étape 3 » mentait** : il rangeait `frais-impot` parmi les
   natures jamais produites, et restait vert parce que son balayage ne contenait
   aucun libellé de frais. Balayage étendu (8 160 combinaisons) + contre-épreuve
   qui prouve qu'il atteint la règle qu'il verrouille.
6. **L'en-tête de `flux.ts`** promettait encore une non-régression « mécanique »
   parce que « rien ne consomme ce module » — faux depuis la bascule du 20 août.

**⚠ RISQUE RÉSIDUEL À ARBITRER** (confirmé, non corrigé — il touche un lot déjà
validé) : `inconnu` ne bloque PAS le signal de maximisation, `ambigu` le bloque
entièrement. Les formes non canoniques des nouveaux libellés passent de
`inconnu` à `ambigu` : **une seule ligne** — un « Frais » de +57,33 $ — suffit
désormais à rétrograder un « maximisé » en « indéterminé » dans le document
remis au client. La classification est plus juste ; le gradient de prudence,
lui, est incohérent depuis le lot « complétude » et devra être tranché avec les
droits CELI.

### 20 août 2026 (lot 4) — étape 4 : les virements internes, et le gradient d'impact

**① LA MESURE COMMANDE LA PRUDENCE** (`docs/mesure-virements-internes-2026-08-20.md`) :
**28** virements internes CELI (pas 27 — le compte précédent oubliait un
`Retrait`). **28/28 citent un compte** dans leur note, **26** nomment un CELI
au régime prouvé — mais **2/28 seulement** ont une contrepartie dans le livre,
et élargir la fenêtre à ±3 jours n'en ajoute **aucune**.

**La décision centrale** : une note qui nomme un CELI ne prouve PAS un
transfert direct. Elle prouve qu'un compte CELI est impliqué — pas qu'il
appartient au **même titulaire**. Or CELI → CELI du titulaire = transfert
direct (aucun droit touché), tandis que CELI → CELI **du conjoint** = RETRAIT
suivi d'un don (les droits reviennent l'année suivante). Croesus n'écrit jamais
à qui appartient le compte cité ; le seul fait qui tranche est la présence de
l'autre jambe **dans le livre du client** — notre livre étant par client, une
contrepartie appariée prouve le même titulaire.

D'où `src/lib/profils/virements-internes.ts` : ferme seulement si les DEUX
jambes sont là (autre compte, signe opposé, |montant| égal, même devise, J0,
unique **des deux côtés**) ; sinon relation **orpheline**, `indetermine`, avec
le régime nommé conservé pour que le planificateur sache quoi demander.
Résultat mesuré : **2 appariées** (1 cotisation ferme, 1 retrait ferme),
**26 orphelines**. Inventer le lien aurait fabriqué 26 transferts directs —
donc 26 fois « aucun droit recréé » — sur des mouvements dont certains sont
peut-être de vrais retraits.

**Les effets** (§2, la double lecture) : `cotisation-celi` (non-enregistré →
CELI), `retrait-celi` (CELI → non-enregistré), `transfert-direct-celi`
(**jamais** retrait + cotisation, §3), `transfert-regime` (CELI ↔ CELIAPP/REER
— **Q = CELIAPP**, ce n'est pas un CELI), `indetermine`. Nouveau rôle fiscal
`cotisation-a-confirmer` : une ENTRÉE dont la nature n'est pas tranchée va
dans `cotisationsCadAConfirmer`, jamais dans le ferme — l'orthogonalité
montant/nature du §19 vaut dans les deux sens.

**② LE GRADIENT D'IMPACT** (§13-§15) — `ImpactCompletude` sur chaque ligne :
`aucun` / `peut-affecter-cotisation` / `peut-affecter-retrait` /
`peut-affecter-les-deux` / `inconnu`. **Ce qui bloque un chiffre, c'est ce qui
peut le modifier** — plus le nom de la catégorie. Conséquences :

- un **inconnu** porteur d'un montant BLOQUE désormais (les 59 « Valeur
  comptable », dont le net inexpliqué de −9 000 $, ne passent plus sous le
  radar du signal de maximisation) ;
- une ligne à **montant nul** ne bloque plus, quel que soit son libellé — un
  zéro ne peut modifier aucune somme ;
- un ambigu **hors CELI** ne bloque pas le CELI ;
- ⚠ `inconnu` n'est JAMAIS inoffensif par défaut : seul un montant nul, ou une
  nature prouvée hors flux, l'exempte.

⚠ **Piège payé pendant ce lot** : `impactDe` exemptait d'abord les natures
« fermes » (cotisation/retrait à confiance élevée). Or une ligne lue SEULE ne
sait pas si elle a été comptée : un « Dépôt » CELI sort `cotisation/eleve` et
la règle 2 le rejette ensuite — il devenait invisible ET inoffensif, le faux
vert que le lot précédent venait de supprimer. C'est à l'appelant, qui sait ce
qui a été agrégé, d'exclure les rôles ; ce qui reste hors de tout agrégat bloque.

**Chiffres sur la base réelle** : rôles fiscaux CELI **10 → 37** ; non-exprimés
**96 → 69** ; bloquants (vue fiscale) **58** ; à impact (signal de
maximisation) **85** — contre 9 « ambigus » auparavant. Impacts des 557
événements CELI : aucun 461, cotisation 38, retrait 30, les deux 28.

### 20 août 2026 (lot 5) — « Valeur comptable » : une preuve d'INNOCUITÉ

**La mesure d'abord** (`docs/mesure-valeur-comptable-2026-08-20.md`, **244**
occurrences, tous régimes : REER 113, CELI 59, FERR 33, non-enregistré 24,
REEE 15 — le motif est général, pas propre au CELI).

**Deux hypothèses du cahier, RÉFUTÉES par les chiffres** :
- « chaque écriture est annulée par son opposée » → **0 sur 169** lignes à
  montant non nul trouvent une contrepartie de même symbole et de montant
  opposé, ni à J0, ni à ±1, ni à ±2 jours ;
- « une opération sur titre voisine explique le montant » (le motif
  « Valeur comptable −9 000 + Remboursement +9 000 ») → **0 sur 169**. À J0,
  une « Valeur comptable » n'a pour voisines que d'autres « Valeur comptable ».
- Le PBR n'est pas vérifiable non plus : les **166 lignes en titres n'ont aucun
  prix**, donc `|total| = quantité × prix` est intestable.

**Ce qui est vrai, et mesuré** : la forme est d'une régularité frappante — en
titres, quantité > 0 avec total **négatif** (83) ou quantité < 0 avec total
**nul** (75) ; en encaisse, quantité 0 avec total **positif** (73). Et surtout :
**15 des 17 groupes (compte × jour) nettent à zéro**.

**LA RÈGLE, et rien de plus** (`src/lib/profils/ecritures-comptables.ts`) :
quand les écritures « Valeur comptable » d'un compte, un jour donné, s'annulent
entre elles (±0,02 $), **aucune valeur n'est entrée ni sortie** — elles ne
peuvent modifier ni cotisation ni retrait, donc leur `impactCompletude` tombe à
`aucun` et elles cessent de bloquer. Quand le groupe ne s'annule pas, le résidu
est un mouvement réel que personne n'explique : il reste `inconnu` **et
bloquant**.

⚠ **Ce que cette règle ne dit PAS** : ce que « Valeur comptable » signifie. Le
libellé reste hors de la liste blanche, la nature reste `inconnu` — seul
l'IMPACT change. C'est une preuve d'innocuité, pas une compréhension, et c'est
exactement ce dont la complétude a besoin. (Les deux groupes non équilibrés
restent visibles : un REER, et le CELI au net de **−9 000 $**.)

**Effet mesuré sur la base** : lignes « Valeur comptable » bloquantes du CELI
**59 → 26** (précisément les 26 du groupe à −9 000 $) ; non-exprimés
**69 → 36** ; bloquants de la vue fiscale **58 → 35** ; à impact pour le signal
de maximisation **85 → 62**. Aucun montant fiscal ne change.

### 20 août 2026 (lot 6) — migration contrôlée des droits CELI, EN PARALLÈLE

**La nouvelle chaîne** (`src/lib/profils/droits-celi-fiscal.ts`) :
`historique Croesus → LigneDuTemps → vueFiscaleCeli → deriverHistoriqueCeliFiscal
→ droits`. Elle ne relit **aucune transaction** ; elle consomme la vue, où
chaque montant porte déjà devise, source, confiance et nature.

**Elle ne décide encore rien.** `verdictCeliDuLivre` — le point unique du
verdict — la calcule à côté de l'ancienne, sur les mêmes entrées, et expose
`fiscal` + `divergences`. La bascule sera un changement d'une ligne, à un seul
endroit ; `deriverHistoriqueRegime` reste le témoin.

**Ce que le ferme utilise** : `cotisationsCadConfirmees` et
`retraitsCadConfirmes` **seulement**. Les « à confirmer » vivent dans une
borne, jamais dans un droit. La règle du retrait reporté est **préservée
telle quelle** (années strictement antérieures).

**Les bornes, dans la direction connue de l'incertitude** — droit = plafond −
cotisations + retraits, donc une cotisation de plus pousse le **minimum**, un
retrait de plus pousse le **maximum** :
`droitMinimum = plafond − cotisationsMax − potentielCotisation + retraitsMin`,
`droitMaximum = plafond − cotisationsMin + retraitsMax + potentielRetrait`.
Elles valent `null` dès qu'une devise n'est pas résolue : on ignore alors
complètement la valeur CAD, et une borne inventée serait un chiffre faux.

**⚠ LA COMPARAISON A ATTRAPÉ UNE VRAIE RÉGRESSION** — la valeur du §16
(« une divergence sur un cas propre est une régression jusqu'à preuve du
contraire »). Le premier passage sur la base réelle a sorti **1 divergence
`regression`** sur `cotisationsTotales`. Diagnostic : une ligne dont le libellé
dit « **Retrait** » mais dont le montant est **positif**, appariée à une
contrepartie non enregistrée, devenait une **cotisation FERME**. Le libellé
disait sortie, le montant disait entrée, et le nouveau code choisissait le
montant — alors que `classerLigne` traite exactement cette ligne comme un
renversement quand aucune note ne la couvre. Correctif : `SENS_ANNONCE` — une
ligne qui se contredit elle-même reste `indetermine`, même appariée.
**Après correction : parité 8/8, zéro régression.**

**État sur la base réelle** (`docs/parite-droits-celi-2026-08-20.md`) :
4 dossiers portant un CELI · divergences **toutes `parite`** ·
statut de la nouvelle chaîne : 1 `calcule`, 3 `montant-a-confirmer` ·
bornes chiffrées sur 1, `null` sur 3 (devises non résolues).

### 20 août 2026 (lot 7) — PHASE TÉMOIN : le nouveau observe, l'ancien décide

**Le principe** : la nouvelle chaîne fiscale calcule en parallèle, ses écarts
sont classés et journalisés, et **rien de ce qu'elle produit n'atteint le
client**. `verdictCeliDuLivre` — le point unique — rend toujours l'ancien
verdict, et expose `temoin` à côté. Un *shadow calculation* dont la seule
production est de la preuve.

**Pourquoi** : un seul passage sur des dossiers réels a suffi à révéler une
régression que 1 000 tests synthétiques n'avaient pas vue (le « Retrait »
positif). Ce genre de défaut ne s'invente pas au clavier — il se rencontre.

**Les six classes**, avec `non-classee` comme filet : un écart qu'aucune
explication connue ne couvre **bloque la bascule au même titre qu'une
régression**. La gravité la plus haute d'un dossier commande son classement.

**Le journal est non nominatif par construction** (`src/lib/profils/temoin-celi.ts`) :
identifiant = condensé SHA-256 tronqué (stable, non réversible) ; **les
montants n'apparaissent que sur les lignes divergentes** — une parité n'a rien
à dire ; motifs normalisés ; aucune écriture disque dans le chemin de
production (le journal est une VALEUR, l'instrument décide de l'imprimer).

**Premier passage** (`docs/temoin-celi-2026-08-20.md`) : 4 dossiers portant un
CELI · **1 parité, 3 `ambiguite-volontaire`, 0 régression, 0 non-classée** ·
taux de parité 25 %. Les seuls champs divergents sont
`borneAncienne_vs_droitMaximum` (le nouveau refuse une borne quand une devise
n'est pas résolue) et `nbDonneesManquantes` (il pose des questions que l'ancien
ne posait pas). Statuts et montants : identiques partout.

**Seuil de bascule proposé** : aucune régression, aucune non-classée, parité
exacte sur **tous** les dossiers propres, et au moins **deux dossiers propres**
plus **un dossier de chaque famille** (USD résolu, virement apparié, virement
orphelin, inconnu à impact). L'échantillon actuel n'a qu'**un** dossier propre
et **aucun** dossier où une résolution manuelle a été appliquée : c'est ce qui
manque, pas la qualité du code.

### ⚠ UNE MESURE À FAIRE, qui débloque 433 comptes

Ouvrir un relevé de positions pour un client porteur d'un compte `4A`/`6A` et
regarder ce que contient la **colonne 4** : le chiffre final du numéro, ou la
lettre de régime du bloc du milieu ? Cette seule observation décide si les
433 comptes VMBL sont joignables. Tant qu'elle n'est pas faite, ils sortent
`non-jointable`, ce qui est honnête mais coûteux.

---

## 8. Périmètre du mandat au fiscaliste (5 août 2026)

Le verrou `revisionFiscalisteRequise` couvre **cinq fichiers**, pas trois. Les
deux derniers portent des règles fiscales écrites avant que le verrou n'existe,
et il serait facile de les manquer.

| # | Fichier | Ce qu'il faut valider |
|---|---|---|
| 1 | `src/lib/profils/strategies.ts` | Les 5 stratégies : conditions de déclenchement, nature de chaque montant, règle transversale « aucun montant à cotiser quand les droits sont inconnus » |
| 2 | `config/parametres-fiscaux.csv` | Les plafonds CELI 2009-2026. **2026 est marqué `a-confirmer`** |
| 3 | `src/lib/profils/demarches.ts` | Chaque phrase remise au client, une par une. Contient des règles de délai : date de règlement en fin d'année, perte apparente de 30 jours, pénalité de 1 % par mois |
| 4 | `src/lib/profils/droits-celi.ts` | **La formule des droits CELI** : `borne = plafond − cotisations + retraits des années passées`, et les trois conditions qui autorisent un montant plutôt qu'une borne |
| 5 | `src/lib/profils/deriver.ts` | **La règle du retrait** : un retrait de l'année courante ne redonne des droits qu'au 1er janvier suivant, donc il est exclu du calcul. C'est la ligne qui empêche de surestimer les droits |

**Hors mandat, mais à savoir** : `src/lib/film/build-sections.ts` classe les
comptes par nature fiscale (`abri` / `reporte` / `imposable`) à partir de leur
suffixe, et cette classification paraît dans le **Rapport vivant HTML**, qui
circule déjà. Elle est antérieure au chantier fiscal et n'est pas sous verrou.
Si le fiscaliste a dix minutes de plus, c'est le meilleur endroit où les mettre.

### 8.1 · Questions ouvertes, formulées pour le fiscaliste (19 août 2026)

Le tableau ci-dessus dit QUELS FICHIERS relire. Celui-ci dit QUOI DEMANDER. Ce
sont des questions auxquelles le dépôt ne peut pas répondre par une mesure sur
le livre, parce qu'elles portent sur le droit et non sur les données.

| # | Question | Où ça mord | Ce que le code fait en attendant |
|---|---|---|---|
| Q1 | **Le prix de base d'un titre acheté en deux fois** : les deux achats forment-ils un seul bien à coût moyen, ou deux positions au prix payé de chacune ? | `planifierRecolte()` — la dernière ligne du plan de récolte est PARTIELLE, et suppose que la part vendue porte la même part du gain | Le plan reste partiel, mais le document ne l'affirme plus comme un fait ; la note au client dit « le montant exact se confirme au relevé » |
| Q2 | **Deux lignes du même symbole** dans un même compte : le plan de récolte les traite comme deux positions indépendantes. L'une en perte et l'autre en gain sortiraient chacune leur montant. Est-ce juste ? | Même fonction. Rien ne regroupe par symbole | Rien — aucun regroupement. À trancher avant de lever le verrou |
| Q3 | **La tolérance de 95 %** : une année CELI compte comme « au plafond » dès que les cotisations atteignent 95 % du plafond de l'année. Le seuil est une invention du dépôt | `analyserMaximisation()` (`signaux-livre.ts`) — décide du verdict « maximisé » vs « sous-plafond », donc de la question posée en rencontre | Le seuil de 0,95 est en dur, et l'en-tête du fichier le déclare heuristique |
| Q4 | **Le plancher REEE** : le moteur calcule 30 % (20 % SCEE + 10 % IQEE) sur la tranche annuelle subventionnée restante. Il ignore les droits reportés, les majorations selon le revenu familial, les plafonds à vie et les règles de 16-17 ans | `strategieReee()` — le montant chiffré remis au client | Le montant est présenté comme un PLANCHER, et la phrase le dit. À confirmer que les quatre omissions ne peuvent QUE l'augmenter ou l'annuler |
| Q5 | **Trois stratégies attendaient encore leurs démarches** : `droits-cotisation`, `subvention-reee`, `localisation-actifs` | `demarches.ts` | ✅ RÉGLÉ le 19 août : les 3 gabarits sont écrits (12 nouvelles phrases, D20 à D36), et `couverture-demarches.test.ts` empêche le trou de se rouvrir. **Ces 12 phrases n'ont encore été relues par personne** — voir docs/mandat-demarches-fiscaliste.md §3 |
| Q6 | **La date qui fait l'année fiscale** : le code range une transaction dans l'année de sa `date` (colonne « Transaction ») ; la démarche D3 dit au client que c'est la date de RÈGLEMENT. Laquelle vaut, pour une vente de fin décembre réglée en janvier ? | `deriver.ts` (5 des 7 mentions de `l.date` rangent par année : l. 58, 116, 151, 155, 173 ; aucune lecture de `dateReglement`) et `demarches.ts` D3 | Rien n'est changé (décision du 19 août). Le modèle déclare `dateReglement` comme « l'axe fiscal » et ne s'en sert pas |

**Ce que le mandat NE couvre pas, à dessein** : la logique de parseur
(`regles-parseur.md`), qui relève de la lecture des exports Croesus et non du
droit fiscal.
