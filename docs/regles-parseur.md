# Les règles du parseur Croesus

> Établies le 4 août 2026, à partir de mesures sur le livre réel (1 003 041
> lignes, 1998-2026). Chaque règle est née d'un écart mesuré, pas d'une
> intuition. **Elles doivent survivre à ce chantier** : si le parseur est
> réécrit, ces quatre règles restent vraies et leurs tests avec.

## Pourquoi ce document existe

Un export Croesus se lit mal naïvement. Quatre pièges produisent des chiffres
faux *qui ont l'air justes* — c'est ce qui les rend dangereux. Un montant de
cotisation CELI surestimé mène à un conseil de cotisation excédentaire, donc à
une pénalité fiscale pour le client.

---

## Règle 1 — L'échelle par 100 des obligations

**Le prix et le PBR unitaires d'une obligation sont exprimés pour 100 $ de
valeur nominale, pas par unité détenue.**

| Instrument | Quantité | PBR unitaire | Coût total | `coût ÷ q` |
|---|---|---|---|---|
| `IEI` (FNB) | 206 | 170,298 | 35 081,41 $ | **170,298** ✓ |
| `Q273A4` (obligation municipale) | 39 000 | 100,000 | 39 000,00 $ | **1,000** ⚠ |

Multiplier 39 000 × 100 donnerait 3,9 M$ pour une position de 39 000 $.

### La règle

> **Toujours dériver l'unitaire du total : `valeur ÷ quantité`. Ne jamais lire
> la colonne unitaire directement.**

Vrai pour le PBR (colonne 8 ÷ quantité) comme pour le prix (colonne 9 ÷
quantité). La division porte l'échelle en elle et fonctionne pour tous les
types d'instruments sans avoir à les distinguer.

### Mesure de couverture

Sur les relevés de positions complets : **83 positions sur 83 portent la valeur
comptable** — 50 actions et 8 fonds cohérents à l'unité, 25 obligations toutes
à l'échelle par 100. Aucune exception.

### Ce que ça a coûté avant d'être compris

Trois fois : une obligation valorisée 2 075 900 $ au lieu de 20 759 $ ; le
facteur d'échelle global du moteur ; et un portefeuille affiché à **21,9 M$**
pour une valeur réelle de 725 254 $.

---

## Règle 2 — La partie double des cotisations

**Une cotisation en nature s'écrit deux fois : une jambe argent et une jambe
titre, de montants opposés, même compte, même date.** Les additionner double le
montant.

Pire : une jambe argent appariée à une jambe titre **n'est pas de l'argent
neuf**. C'est un apport de titres — souvent un transfert de régime, qui ne
consomme aucun droit de cotisation.

```
2026-01-14   Cotisation   1CAD   total = +20 177,90     ← jambe argent
2026-01-14   Cotisation   TD     q=155  total = −20 177,90   ← jambe titre
```

### La règle

> **`cotisationsAnnee` ne compte que les jambes argent NON APPARIÉES** à une
> jambe titre de même compte, même date et montant opposé (tolérance 0,02 $).
> Une jambe appariée est un apport en nature : elle relève de la règle 4.

### Mesure sur le livre

| | Montant |
|---|---|
| Somme brute des jambes argent (comptes CELI) | 27 292 537 $ |
| dont **appariées** à une jambe titre | **12 677 663 $ (46 %)** |
| Cotisations en argent neuf | 14 614 875 $ |

**552 comptes CELI, dont 363 avec des apports en nature.**

### Le cas qui prouve la règle

Un compte CELI ouvert le **14 janvier 2026** affiche 300 221 $ de cotisations
brutes. Le plafond cumulatif à vie d'un CELI tourne autour de 102 000 $ : le
chiffre est impossible. Après appariement, il s'agit d'un transfert de régime.

Autre cas : un compte à 94 722 $ bruts dont 94 408 $ appariés — sa cotisation
réelle en argent neuf est de **314 $**.

---

## Règle 3 — Virement interne contre transfert externe

**Un transfert entrant peut venir d'un autre compte du même client (virement
interne) ou d'une autre institution (transfert externe).** Les deux s'écrivent
pareil, sauf que le virement interne porte une note d'appariement.

```
« ... ARTICLE 146(16) LIR TRSF I »      → apparié, virement interne
« TRANSFERE A 37-XXXX-S »               → apparié, virement interne
« VIRE DE 373CUVS »                     → apparié, virement interne
```

### La règle

> **Un transfert entrant dont la note désigne un autre compte du même client
> est un virement interne : il ne prouve rien sur l'existence d'un compte
> externe.** Motifs reconnus : `TRANSFERE A`, `VIRE DE`, `TRSF`, `ARTICLE
> 146(16) LIR`.

### Pourquoi c'est critique

Le schéma (section 2, règle des droits CELI) exige
`transfertEntrantDetecte = false` pour calculer les droits réels. Une détection
trop large rétrograderait en simple borne des clients dont les droits sont
parfaitement calculables.

### Le numéro de compte dans la note — ajouté le 4 août 2026

Le planificateur : « ça commence toujours par 37 normalement, et ceux qui font
genre 4A et 6A c'est les vieux numéros de compte ». Une note qui **nomme** un
compte désigne une contrepartie identifiée.

```
« A 37-AEF9-R - 146(16) »   « 4A-Y3VI-6 »   « 6A-CDTR-9 »
```

### Volontairement NON reconnus, malgré leur fréquence

| Note | Lignes | Pourquoi on la refuse |
|---|---|---|
| `TFR-146(16)` | 256 | L'article 146(16) autorise le transfert direct entre REER **y compris entre institutions** : le citer ne prouve rien |
| `TFR-146.3(2)(E)` | 78 | Idem, pour les FERR |
| `TRANSFERT DE FONDS` | 226 | Trop vague |
| `PAIEMENT RETRAITE` | 907 | Trop vague |

Accompagnés d'un numéro de compte, ils deviennent probants — et c'est alors le
motif du numéro qui tranche, pas l'article.

### Mesure

| | Lignes |
|---|---|
| Transferts entrants **reconnus** (avant le numéro de compte) | 5 069 / 18 001 — 28 % |
| Transferts entrants **reconnus** (après) | 6 625 / 18 001 — **37 %** |
| Gain | **+1 556 lignes** |

**Leçon à ne pas oublier** : ce gain de 1 556 lignes ne débloque que **6 comptes
CELI sur 267** (95 % → 93 % de comptes rétrogradés). Il suffit d'**un seul**
transfert orphelin pour bloquer un compte, et la plupart en ont plusieurs.
Affiner l'appariement ne remplacera donc **jamais** la résolution manuelle : le
vrai gain ici est 1 556 lignes de bruit en moins à trancher à la main.

---

## Règle 4 — Dans le doute, la borne

**Un transfert entrant non apparié est traité comme EXTERNE par défaut.**

### La règle

> **L'absence de preuve d'appariement n'est pas une preuve d'absence de compte
> externe.** Un transfert orphelin met `transfertEntrantDetecte = true`, donc
> les droits CELI sortent en **borne supérieure théorique**, statut
> `montant-a-confirmer`, jamais en montant calculé.

### Pourquoi cette asymétrie est voulue

Décision explicite du planificateur, 4 août 2026 :

> « Dans le doute on rétrograde vers la borne, jamais l'inverse, parce qu'un
> chiffre de droits CELI faux est pire qu'une borne prudente. »

Un droit surestimé mène à une cotisation excédentaire, donc à une pénalité de
1 % par mois pour le client. Une borne prudente ne coûte qu'une question de
plus en rencontre — et cette question est justement le produit (voir la section
« Angle mort » du schéma).

### Conséquence assumée

Une partie des clients verront leurs droits en borne alors qu'ils seraient
calculables. C'est le bon côté sur lequel se tromper.

---

## Règle 5 — un apport en nature est classé par son étiquette, pas par son appariement

**Le motif.** Une cotisation en titres est normalement étiquetée comme telle
dans Croesus. La règle 2 apparie les deux jambes et écarte la jambe titre du
total d'argent neuf — mais elle ne dit rien de ce que l'apport *est*. Or les
deux cas ne se ressemblent pas du tout :

- un client qui verse 12 000 $ de FNB dans son CELI **consomme ses droits** ;
- un client dont le CELI d'un autre courtier arrive en bloc **n'en consomme
  aucun ici** — il les a consommés là-bas, dans un historique que nous ne
  voyons pas.

**Ce que fait le parseur.** `etiquetteApportEnNature(note)` rend trois valeurs :

| Étiquette | Déclencheur | Conséquence |
|---|---|---|
| `transfert` | un numéro de compte est cité dans la note, ou la note dit « transféré de » | écarté des cotisations **et** versé dans les transferts à trancher |
| `cotisation` | la note dit franchement « cotisation » sans citer de compte | compté dans les cotisations, consomme des droits |
| `ambigu` | ni l'un ni l'autre | versé à trancher ; **aucun droit « calculé »** tant qu'il reste non classé |

**Le trou que ça comble.** Avant la règle 5, la détection d'origine externe ne
regardait que les transferts **en argent**. Une arrivée en nature — un régime
entier qui traverse en titres — passait inaperçue : le client apparaissait avec
un montant de droits calculé, alors que tout son historique de cotisations chez
l'autre courtier nous était invisible. Un transfert en nature est une preuve
d'origine externe exactement au même titre qu'un transfert en argent.

**Ce que ça a mesuré.** Sur un client témoin, 17 lignes de cotisation CELI
totalisant 57 773 $ d'« argent neuf ». La règle 5 en a reclassé 22 273 $ : la
note portait `CONTRIBUTION REF: <compte>`, le mot « contribution » masquant un
transfert. Argent neuf réel : **35 500 $**, soit 38 % de moins. Les 8 lignes
reclassées partent maintenant à trancher avec le client.

**Le piège de lecture.** Le numéro de compte cité l'est parfois **sans tirets**
(`6AAZCI0` pour `6A-AZCI-0`, `373CUVS` pour `37-3CUV-S`). La reconnaissance qui
n'acceptait que la forme à tirets voyait ces notes comme du texte libre et les
classait « cotisation ». C'est cette seule omission de format qui produisait
l'écart de 22 273 $.

---

## Les cas de test permanents

Ils vivent dans `src/lib/parseur-croesus/__tests__/`. Les fixtures reproduisent
fidèlement les motifs réels **avec des noms fictifs** — les tests sont
versionnés sur GitHub, aucun nom de client ne doit y apparaître.

| # | Cas | Ce qu'il prouve |
|---|---|---|
| 1 | Obligation à 39 000 nominal, PBR unitaire 100,000, coût 39 000 $ | Le PBR unitaire dérivé vaut 1,00 et non 100,00 |
| 1b | FNB `IEI`, 206 parts, coût 35 081,41 $ | Le même calcul donne 170,298 — une seule formule pour les deux |
| 2 | Cotisation 1CAD +20 177,90 appariée à une jambe titre −20 177,90 | `cotisationsAnnee` = 0, pas 20 177,90 |
| 3 | Transfert entrant avec note `TRANSFERE A <compte>` | `transfertEntrantDetecte` reste `false` |
| 4 | Transfert entrant sans note | `transfertEntrantDetecte` passe à `true` |
| 5a | Apport en nature, note `CONTRIBUTION REF: 6AAZCI0` | Étiquette `transfert` : écarté des cotisations, versé à trancher |
| 5b | Apport en nature, note `COTISATION EN TITRES` | Étiquette `cotisation` : consomme des droits |
| 5c | Apport en nature sans note | Étiquette `ambigu` : aucun droit « calculé » tant qu'il n'est pas tranché |
| 5d | Compte cité sans tirets (`373CUVS`, `6AAZCI0`) | Reconnu comme numéro de compte au même titre que `37-AEF9-R` |
| 6a | `canoniserCompte('6a-azci-0')` | `6AAZCI0` — tirets, espaces insécables et casse retirés |
| 6b | `memeCompte('', '')` | `false` — deux inconnus ne sont pas le même compte |
| 6c | `decomposerCompte('~E-0024I-0')` | bloc du milieu `0024I` : les tirets font foi |
| 6d | `compteCiteDansTexte('TRANSFERT SALAIRE DIVERS')` | `null` — le préfixe trie les 140 294 mots |
| 6e | Note `COTIS AU CELI 373B8VW` (PDF annuel) | CELI 13 035,20 $ et non 4 035,20 $ |

---

## Règles héritées du moteur du grand livre

Le parseur reprend aussi les règles déjà éprouvées sur le livre complet, dont
les trois qui touchent la lecture brute :

- **Antichronologie intra-journée** : à une date donnée, la première ligne vue
  porte le solde de fin de journée. L'export n'est pas trié comme on le croit.
- **Clé de position = symbole + devise** : le CDR canadien et l'action
  américaine partagent le même symbole (65 470 $ d'erreur avant correction).
- **Dédoublonnage multi-ensemble** : le maximum d'occurrences par fichier,
  jamais l'union — les exports se chevauchent et un vrai achat peut légitimement
  apparaître deux fois le même jour.

---

## Règle 6 — un identifiant de compte se compare TOUJOURS canonisé

**La règle générale**, dictée le 5 août 2026 après le défaut de la règle 5 :
toute comparaison d'identifiants de comptes passe par `canoniserCompte`
(tirets, espaces — y compris insécables — et casse retirés). Jamais deux
chaînes brutes. Le module `src/lib/parseur-croesus/identifiant-compte.ts` est
le seul endroit qui décide de ce qu'est un compte.

**Ce qui a été mesuré** sur le livre complet (1 072 383 lignes, 3 325 comptes
distincts) et qui justifie chaque constante :

| fait | valeur |
|---|---|
| la colonne du numéro de compte porte toujours des tirets | 3 325 / 3 325 |
| le bloc du milieu fait 4 caractères | 3 316 / 3 325 |
| l'exception : format `~E-0024I-0`, bloc de 5 | 9 comptes |
| préfixes réels | 13 : `37` (2810), `4A` (286), `6A` (66), `5A` (45), `00` (37), `36` (23), `34` (21), `6D` (9), `~E` (9), `5M` (8), `6M` (6), `6C` (4), `69` (1) |

**Dans les notes**, les jetons de 7 caractères filtrés par ces 13 préfixes :

| | occurrences |
|---|---|
| correspondent à un compte du livre | 31 750 |
| **absents du livre — les comptes externes** | **48 623** |
| rejetés par le préfixe | 140 294 |

Les 140 294 rejets sont **tous des mots** : `ARTICLE`, `SALAIRE`, `RETRAIT`,
`MALBAIE`, `DOLBEAU`, `PAYMENT`, `COMINAR`, `FORTIER`. C'est cette mesure qui
autorise à relâcher la reconnaissance : le préfixe seul sépare proprement les
comptes du texte français, là où un motif écrit à la main ne le faisait pas.

**Les tirets font foi quand ils sont là.** `decomposerCompte` découpe sur les
tirets en priorité, et ne tombe sur le découpage 2-4-1 que pour la forme
collée. C'est ce qui préserve le format aberrant à bloc de 5, et tout format
futur, sans avoir à le prévoir.

**Canoniser pour comparer, JAMAIS pour afficher.** Le numéro montré au
planificateur reste celui de ses écrans Croesus : `compteCiteDansNote` rend
`37-AEF9-R`, pas `37AEF9R`.

### Ce que la règle 6 a réparé, hors du chantier

`src/lib/portfolio/year-activity.ts` — le PDF d'activité annuelle. Le motif qui
lisait le compte de destination dans la note exigeait les tirets, un préfixe de
deux **chiffres** et un suffixe **lettre**. Sur la forme collée, la cotisation
repartait sur le compte de la **ligne** au lieu du compte de **destination**.
Mesuré sur la fixture réelle : le CELI affichait **4 035,20 $ au lieu de
13 035,20 $** — 9 000 $ imputés au mauvais régime. Le total, lui, ne bougeait
pas : c'est une répartition fausse, donc invisible.

**Précaution retenue** : cette fonction refuse désormais explicitement les
numéros VMBL. Sa table est celle des suffixes iA, où `R`/`S` sont **inversés**
par rapport à VMBL. L'élargir aux 424 comptes VMBL aurait échangé une erreur
connue contre une erreur neuve et silencieuse, sur précisément les comptes que
l'élargissement prétendait réparer.
