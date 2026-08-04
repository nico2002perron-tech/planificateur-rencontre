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
