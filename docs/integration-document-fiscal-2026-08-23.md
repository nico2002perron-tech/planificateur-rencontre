# Intégrer les pages de stratégie au document client

*Mesuré le 23 août 2026. Les trois contrats sont réglés ; le branchement est **bloqué** par une quatrième condition qui ne figurait pas à la liste.*

---

## 1. Le titre — propriétaire : `PageStrategieFiscale`

Le document parent ne connaît pas le nom d'une stratégie ; le registre, si. Le
parent fournit **le cadre** (format, fond, pied), **jamais le titre**.

`EnTeteStrategie` adopte la grammaire de `SectionHeader` de la page de synthèse :
16 pt Montserrat sur bleu nuit, filet de 1,5 pt, sous-titre gris — avec, comme
filet, **l'accent propre à la stratégie** (rouge pour les pertes, vert pour les
gains). Le titre était en 13 pt sans filet : cohérent avec son aperçu isolé,
étranger au document réel. `accent` est **obligatoire** dans `EnteteStrategie`.

## 2. Le format — A4, explicitement

`page-fiscale.ts` porte `FORMAT_PAGE_FISCALE = 'A4'`. Les pages de stratégie
étaient en LETTER parce que **leur aperçu** l'était. A4 est **17 pt plus étroit
et 50 pt plus haut** : la conversion **reflue** le contenu, elle ne le met pas à
l'échelle. Regardée sur PDF — les étapes 1 à 4 tiennent toujours sur la première
page des deux stratégies, avec plus d'air qu'en LETTER.

Un test refuse tout `size="A4"` ou `size="LETTER"` écrit en dur dans la famille.

## 3. Le fond — `#fffdf9`, en contrat et non en override

Le blanc chaud est l'identité du document client. Le `#f8fafc` des pages de
stratégie était une décision d'aperçu. `STYLE_PAGE_FISCALE` est **le** style de
page ; la synthèse et les stratégies le partagent. Un test refuse tout
`backgroundColor: '#fffdf9'` écrit en dur.

Regardé : les cartes en gris ardoise froid tiennent très bien sur le blanc chaud
— elles s'en détachent mieux que sur `#f8fafc`.

## 4. Le pied de page — posé par la page, pas par l'appelant

Les pages de stratégie sortaient **sans pied ni pagination** pendant que la
synthèse affichait « 3 / 7 ». `PageStrategieFiscale` pose maintenant
`PageFooterV12` lui-même, avec `LIBELLE_PIED_FISCAL` — le défaut de
`PageFooterV12` est « Analyse des cours cibles 1.2 », le nom d'un autre rapport.

---

# ⛔ Le branchement est bloqué : DEUX moteurs répondent à « combien vendre »

| | carte de synthèse | page en cinq étapes |
|---|---|---|
| moteur | `planifierRecolte` (strategies.ts) | `meilleurPlanMonoTitre` (quantite-a-vendre.ts) |
| portée | **multi-titres** | **mono-titre**, refuse sinon |
| unité | **dollars**, lignes partielles | **unités entières**, granularité par instrument |
| tri | densité (\|gain\| / valeur marchande) | plus petit écart à la cible |

Mesuré sur un même dossier fictif, trois cibles, statut `calcule` dans tous les cas :

| cible | carte de synthèse | page en cinq étapes | ce que le client lirait |
|---|---|---|---|
| **9 000 $** | AAA 12 400 $ + BBB 1 035 $ | **aucune proposition** | la page dit « à confirmer » sur un constat **chiffré** |
| **5 000 $** | AAA 7 209 $ *(en partie)* | AAA **180 actions = 7 200 $** | même titre, **deux montants** |
| **1 500 $** | **AAA** 2 163 $ | **CCC** 362 actions | **deux titres différents** |

Et côté gains, sur le dossier de référence : cible 12 000 $, la carte propose
DDD + EEE ; la page en cinq étapes ne propose **rien**, parce que le plus gros
gain latent d'un seul titre vaut 11 985 $ — **15 $ sous la cible**. Les mêmes
15 $ que toute la page raconte.

**Aucune de ces trois divergences n'est un défaut de mise en page.** Ce sont deux
réponses légitimes à deux questions légèrement différentes, et un document client
ne peut pas porter les deux.

## La condition manquante

À la liste — titre unique, format cohérent, fond cohérent, pagination inspectée —
il faut ajouter :

> **une seule réponse à « combien vendre »**

Trois façons de l'obtenir, par ordre de coût :

1. **La carte de synthèse cesse de chiffrer** et renvoie à la page de détail
   (« voir page 4 »). Le moins de code, mais la synthèse perd son tableau.
2. **`meilleurPlanMonoTitre` devient multi-titres.** C'est le chantier
   explicitement reporté depuis le début (« aucun cas réel observé ») — et la
   mesure ci-dessus montre qu'il est en réalité le cas **courant**.
3. **La carte de synthèse consomme le moteur de la page.** Alors le tableau
   passe en unités entières et perd le multi-titres : le cas A n'a plus de
   réponse du tout.

Aucune n'est une décision d'implémentation.

## La pagination : le blanc ne disparaît pas

Hypothèse à vérifier : « le blanc de page 2 pourrait disparaître naturellement
quand les stratégies s'enchaînent ». **Non.** Chaque stratégie ouvre son propre
`<Page>` ; la suivante ne peut pas remonter dans l'espace laissé libre. Mesuré
sur le document assemblé : page 5 (étape 5 des pertes) est remplie au tiers,
page 7 (étape 5 des gains) aussi.

Le blanc ne disparaîtrait qu'en faisant des stratégies des **sections d'un flux
continu** plutôt que des pages. Ce qui rouvre la règle « aucune coupure au milieu
d'une étape » — une étape de 280 pt ne peut pas toujours tenir dans ce qui reste.
C'est un arbitrage, pas un réglage.

## Ce qui a été produit

`src/lib/pdf/__tests__/document-integre.test.tsx` assemble la page de synthèse
réelle **suivie** des deux pages de stratégie, dans le format de production, et
écrit `C:/tmp/integre/document.pdf` (7 pages). C'est le harnais qui validera le
branchement le jour où la quatrième condition sera levée.

⚠ Les pages de stratégie y sont alimentées par leurs **fixtures**, pas par le
profil : le pont profil → présentation n'existe pas, et le construire supposerait
justement de choisir un moteur.
