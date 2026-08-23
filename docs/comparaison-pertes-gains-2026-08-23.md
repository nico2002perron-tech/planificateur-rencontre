# Pertes vs gains — ce qui est vraiment commun

*Mesuré le 23 août 2026, après inspection des deux PDF réels.*

Le langage visuel « cinq étapes » a été conçu sur la cristallisation de **pertes**,
puis appliqué à la cristallisation de **gains**. Deux instances suffisent pour
classer, pas pour généraliser. Ce document classe chaque élément avant toute
factorisation — **aucun code n'a été factorisé dans le lot qui l'accompagne.**

Volumétrie : `page-cristallisation-pertes.tsx` 322 lignes,
`page-cristallisation-gains.tsx` 280 lignes,
`diagramme-avant-strategie-apres.tsx` 167, `parcours-gain-cristallise.tsx` 141.

---

## A. Générique tel quel — identique, sans une variante

| Élément | État aujourd'hui |
|---|---|
| `Etape` — pastille numérotée 19 pt + titre 10,5 pt | **défini deux fois, identique** |
| `Carte` — rayon 12, padding 10, bordure 1 pt | **défini deux fois, identique** |
| `Manque` — le repli gris qui *dit* ce qui manque | **défini deux fois, identique** |
| `ligne()` de l'étape 5 — libellé à gauche, montant à droite | **défini deux fois, identique** (depuis V19/PG15) |
| Bloc `AVANT D'EXÉCUTER` | exporté côté pertes, **recopié inline côté gains** |
| `argent()` | **recopié dans 4 fichiers** |
| `EnTeteSociete`, `CarteChiffre` | déjà partagés — mais **logés dans la page des pertes**, ce qui fait dépendre les gains des pertes |
| `LogoSocieteFiscal`, `mentionDate()` | déjà de vrais modules |
| Discipline des statuts dégradés (union discriminée + repli qui parle) | doctrine identique |
| `textesDe()` du harnais de test | **5 copies** |
| Listes d'interdits fiscaux dans les tests | quasi identiques |

**Preuve que la duplication coûte déjà :** le tiret « — » d'une valeur absente
sortait dans la couleur du chiffre qu'il remplace — vert côté gains, vert côté
pertes. Le même défaut a dû être corrigé **deux fois**, dans deux fichiers, et
verrouillé par **deux tests** (PG15 et V19).

## B. Générique avec variante — même structure, paramètre différent

| Élément | Pertes | Gains | Ce qui varie |
|---|---|---|---|
| Palette | rouge = action, bleu = fiscal | **vert = action**, bleu = cible | le *rôle*, pas la structure : on crée une perte, on réalise un gain |
| Carte d'action | `CarteAction` | `CarteActionGain` | anatomie **identique** (bandeau, en-tête société, quantité géante 28 pt, deux `CarteChiffre`, filet + objectif/écart, mention de date) ; seuls changent les libellés et **une ligne de précision en plus** côté gains |
| Libellé de l'écart | « Écart » | « Écart estimé » | mot |
| Squelette en cinq étapes | 5 étapes | 5 étapes | le squelette est commun, **aucun titre n'est partagé** |

## C. Spécifique métier — à ne pas factoriser

| Élément | Pourquoi il doit rester séparé |
|---|---|
| **Étape 4** — `DiagrammeAvantStrategieApres` vs `ParcoursGainCristallise` | trois barres sur une échelle commune racontent une **soustraction** ; trois jalons reliés dans le temps racontent une **séquence**. Les fusionner produirait un composant à deux modes qui ne partagerait que le mot « trois » |
| **Le 3ᵉ jalon non chiffré** | conclusion de l'audit PBR : le moteur ne connaît ni prix, ni quantité, ni date, ni frais d'un rachat qui n'a pas eu lieu. Aucun équivalent côté pertes |
| **Étape 5** | « réduction du gain net » ≠ « capacité encore disponible » |
| **Données** des validations avant exécution | la perte apparente n'existe pas côté gains |
| Vocabulaire de chaque étape | les pertes soustraient, les gains emploient une capacité qui dort |

---

## Trou constaté, commun aux deux

**Aucune des deux pages ne rend son propre titre ni son sous-titre.** Les deux
présentations les portent (`titre`, `sousTitre`), mais c'est le harnais d'aperçu
qui les affiche, chacun à sa façon. Un assembleur de document réel devra le
faire — et aujourd'hui **rien ne l'y force**. À traiter dans le lot d'extraction.

## Deux pages par stratégie, et le blanc qui suit

Les deux stratégies produisent **deux pages** : étapes 1→4 sur la première,
étape 5 + « avant d'exécuter » sur la seconde, qui reste alors remplie au quart.
Ce n'est pas un défaut de mise en page mais la conséquence d'un document
**mono-stratégie** : le blanc disparaîtra quand l'assembleur enchaînera
plusieurs stratégies dans un même flux. Les deux pages ont le même
comportement — donc le même remède, une seule fois.

---

## GO / NO-GO — design system fiscal

**GO partiel, en trois décisions distinctes.**

1. **GO immédiat sur la zone A**, dans un lot séparé : extraire un module
   `langage-fiscal.tsx` portant `Etape`, `Carte`, `Manque`, `LigneChiffree`,
   `EnTeteSociete`, `CarteChiffre`, `ValidationsAvantExecution`, `argent()`, plus
   l'en-tête de page manquant. **Aucune décision de design à prendre** : c'est du
   code identique en double, et le bug du tiret vert a déjà facturé le prix de
   l'inverse. Effet de bord utile : la page des gains cesserait d'importer depuis
   la page des pertes.

2. **NO-GO sur la zone B jusqu'à une troisième stratégie.** Paramétrer une
   palette sur deux exemples, c'est deviner : deux couples de teintes ont suffi
   ici, une troisième stratégie pourrait en demander trois ou aucun. La bonne
   abstraction se verra, elle ne s'anticipe pas.

3. **NO-GO définitif sur la zone C.** L'étape 4 reste deux composants. Un
   composant unique à deux modes serait un faux partage — et le premier
   raffinement fiscal le ferait diverger.

---

# Suite — l'extraction, exécutée

*Décision 1 appliquée le 23 août 2026. Décisions 2 et 3 respectées : rien de la
zone B ni de la zone C n'a été touché.*

## Ce qui a été extrait — `src/lib/pdf/langage-fiscal.tsx`

`argent()` · `Etape` · `Carte` · `Manque` · `LigneChiffree` · `EnTeteSociete` ·
`CarteChiffre` · `ValidationsAvantExecution` · `EnTeteStrategie` ·
`PageStrategieFiscale` · la palette **neutre** `NEUTRE` · les types
`EnteteStrategie` et `ValidationAvantExecution`.

Le harnais de test `textesDe` / `platDe` / `noeudsTexte`, qui existait en cinq
copies, vit dans `src/lib/pdf/__tests__/_texte-rendu.tsx`.

Les deux étapes 4 — restées **deux composants distincts** — consomment
désormais `argent()` et `Manque` au lieu de leurs copies locales.

## Ce qui n'a PAS été touché

Les deux palettes d'action (rouge côté pertes, vert côté gains), `CarteAction`
et `CarteActionGain`, `DiagrammeAvantStrategieApres`, `ParcoursGainCristallise`,
les deux étapes 5, et les validations propres à chaque stratégie.

## Le piège que la revue a attrapé : « identique » se vérifie, il ne se suppose pas

Le bloc « avant d'exécuter » **paraissait** identique. Il ne l'était pas : côté
pertes une pastille « confirmé » se peint en vert sur fond vert ; côté gains
elle restait grise quel que soit le statut. Extraire la version des pertes
imposait silencieusement son rendu aux gains — sur une branche qu'aucune
fixture n'emprunte, donc invisible à la comparaison au pixel près.

La structure est commune, la **teinte de sens reste à l'appelant**, via un
paramètre **sans valeur par défaut** : on peut choisir, on ne peut pas hériter
du voisin par inadvertance.

Deux teintes ont quitté la palette « neutre » du même coup : le vert
d'approbation et son fond n'y avaient rien à faire — une palette neutre qui
héberge une couleur de sens est une factorisation déguisée.

## Une garde qui manquait, trouvée en cherchant la règle plutôt que le symptôme

`LigneChiffree` était corrigée et verrouillée. Mais les deux pages écrivaient
encore `valeur={x === null ? '—' : argent(x)}` sur `CarteChiffre`, **avec une
couleur d'action** : une perte latente absente sortait en rouge, une perte
fiscale absente en bleu. Même défaut, autre composant, aucun test.

`CarteChiffre` prend désormais `number | null` : c'est le composant qui décide
du tiret et de sa couleur. Les pages ne peuvent plus fabriquer le tiret
elles-mêmes, et un test le vérifie sur leur source.

## Le trou titre / sous-titre, refermé

`EnteteStrategie` a **deux champs obligatoires**, `sousTitre` étant explicitement
`string | null` : on peut **refuser** un sous-titre, on ne peut pas l'**oublier**.
`PageStrategieFiscale` exige cet en-tête, et chaque page exporte sa forme
assemblée (`PageStrategieCristallisationPertes` / `…Gains`) qui porte son titre
elle-même. Les harnais d'aperçu n'en posent plus.

`strategies-visuelles.ts` est le registre que l'assembleur consommera. La
batterie `LF1`/`LF2` parcourt ce registre, exige que chaque en-tête déclaré soit
réellement rendu — y compris sous statut dégradé — et exactement une fois.
Le test est typé `Record<CleStrategieVisuelle, …>` : **ajouter une stratégie au
registre sans fixture d'assemblage ne compile pas.**

⚠ Décision laissée à Nicolas : la page des pertes n'a **pas** de sous-titre
aujourd'hui (`sousTitre: null`). En ajouter un décale toute la page de 13 pt —
un changement visuel, donc pas un choix d'implémentation.

## Ce que la factorisation a acheté, mesuré

Avant l'extraction, le défaut « un tiret peint de la couleur du chiffre qu'il
remplace » a dû être trouvé, corrigé et verrouillé **deux fois**. Après :
saboter `LigneChiffree` fait rougir **trois batteries d'un coup** — `LF3`,
`PG15` (gains) et `V19` (pertes).

## Non-régression visuelle

Six pages rastérisées avant et après l'extraction : **six hachages identiques**.
Aucun pixel n'a bougé.
