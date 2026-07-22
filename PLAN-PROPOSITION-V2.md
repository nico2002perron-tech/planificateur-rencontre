# PLAN V2 — Correctifs du module « Proposition de portefeuille »

> **Pour : Opus 4.8 (session Claude Code fraîche).**
> Ce plan est autoportant : tout le contexte nécessaire est ici. Exécute les lots DANS L'ORDRE.
> Les numéros de ligne sont indicatifs (état du working tree au 2026-07-22) — fie-toi aux ANCRES de code (chaînes exactes à chercher), jamais aux lignes seules.

---

## §0 — Mission et état des lieux

**Le module.** `/proposition` (entrée « Proposition » dans le Sidebar) permet à Nicolas (conseiller, Groupe Financier Ste-Foy) de bâtir un portefeuille NEUF de zéro pour un client : nom + montant → recherche de titres un à un → pondérations % → gain projeté 12 mois (consensus analystes) en direct → « Enregistrer au Journal des cibles » = chaque titre devient une prédiction datée (`price_target_snapshots`) taguée `entry_type='model_portfolio'`, nom du client chiffré côté navigateur (coffre AES-GCM, `useVault`). Objectif produit : **hyper simple, friendly, « méga sharp »**.

**Provenance des correctifs.** Une revue multi-agents (58 agents, 5 angles, vérification adversariale) a confirmé 53 défauts/frictions. Ce plan les couvre TOUS, dédupliqués en 26 correctifs traçables (IDs `H*`/`M*`/`L*`/`S*` = IDs de la revue).

**Fichiers du module (tous NON commités) :**
- `src/app/(dashboard)/proposition/page.tsx` — la page (≈420 lignes)
- `src/components/layout/Sidebar.tsx` — entrée `{ href: '/proposition', label: 'Proposition', icon: Briefcase }`
- `src/app/api/price-target-snapshots/route.ts` — POST modifié (accepte `entry_type` + boucle de repli)
- `src/app/(dashboard)/journal/page.tsx` — type `Snapshot.entry_type` + badge carte client
- `supabase/migration_snapshot_entry_type.sql` — migration **PAS ENCORE EXÉCUTÉE en BD**

**⚠️ Cohabitation git.** Le working tree contient AUSSI du travail non commité ÉTRANGER à ce module : le « cours cibles 1.2 » (`PretAColler.tsx`, `price-targets-template.tsx`, `reports/page.tsx`, `year-activity*.{ts,tsx}`, `YearActivityBuilder.tsx`, `sectors.tsx`), le retrait du check-in QR (`middleware.ts`, `checkin/page.tsx`, `api/qr/*`, `package.json`/lock), `transactions-du-jour/page.tsx`, `team-profile/public/route.ts`, `demarrer-localhost.bat`, `PLAN-PROPOSITION-V2.md` (ce fichier).
- **NE JAMAIS committer ces fichiers étrangers** avec les lots de ce plan.
- **Cas particulier `PretAColler.tsx`** : le correctif F2 (Lot 1) touche ce fichier, qui porte DÉJÀ le diff 1.2 non commité. On ne peut pas committer l'un sans l'autre. Règle : appliquer F2 quand même, mais **exclure PretAColler.tsx des commits des lots** — il partira avec le futur commit « cours cibles 1.2 ». Le signaler à Nicolas dans le récapitulatif.

**Discipline (non négociable) :**
1. Après CHAQUE lot : `npx tsc --noEmit -p tsconfig.json` (0 erreur) puis `npx next build` (exit 0). Si le build échoue avec `EPERM ... .next\static\...` : c'est un verrou OneDrive → `rm -rf .next` et relancer (ce n'est PAS une erreur de code).
2. Un commit par lot (messages en français, style du repo : `Proposition : <résumé>`). **Nicolas pousse lui-même** — ne jamais `git push` sans son accord explicite.
3. À la fin : revue adversariale (sous-agents) sur le module complet, corriger les CONFIRMED, re-typecheck/build.

---

## §1 — Prérequis BLOQUANT : la migration

Avant le Lot 1, demander à Nicolas d'exécuter dans le SQL editor Supabase :

```sql
ALTER TABLE price_target_snapshots
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'price_target';
```

Sans elle, F1 fera échouer (volontairement) tout enregistrement de portefeuille modèle avec un message clair — c'est le comportement voulu (plus jamais de perte silencieuse du tag).

**L10 (corriger en passant)** : l'en-tête de `supabase/migration_snapshot_entry_type.sql` dit « Nullable avec défaut » alors que le SQL est `NOT NULL DEFAULT` → corriger le commentaire : « NOT NULL avec défaut 'price_target' : les lignes existantes deviennent des cours cibles normaux. »

---

## §2 — Décisions d'architecture (ARBITRÉES — ne pas re-débattre)

| Sujet | Décision |
|---|---|
| Colonne absente + `entry_type='model_portfolio'` | **Échec explicite** (400) avec message actionnable. Le repli silencieux reste UNIQUEMENT pour `average_cost` et pour `entry_type` quand la valeur est le défaut `'price_target'` (le flux PDF/manuel existant ne doit pas casser). |
| Filtrage des lignes modèles (PDF, bilan) | **Côté client/consommateur** (`r.entry_type !== 'model_portfolio'`), tolérant à `undefined` (lignes pré-migration = cours cibles normaux). PAS de `.eq()` serveur sur `entry_type` (casserait si colonne absente). |
| Devise | Conversion **USD→CAD à la source** (page Proposition), via `useUsdCadRate()` (même hook que PretAColler — voir son import à l'ancre `const { rate: usdCadRate } = useUsdCadRate();`). Le Journal/cron restent 100 % CAD. |
| Doublons | **« La dernière proposition du jour remplace la précédente »** : dédup serveur sur `(advisor_id, name_idx, predicted_at=aujourd'hui, entry_type='model_portfolio')`, calquée sur le patron `price_targets_pdf` existant. |
| Brouillon | `localStorage` clé `proposition-draft-v1` — **SANS le nom du client** (posture de confidentialité du coffre : aucun nom en clair au repos). Le nom se retape, c'est voulu. |
| Langage visuel | Le style « candy » Duolingo des pages Modèles/PretAColler : bordures `border-[3px]`, ombres `0 4px 0 0 <dark>`, `rounded-2xl/3xl`, tokens `DUO` (dans `PretAColler.tsx` ancre `green: '#58CC02', greenDark: '#45a300'` — **`#45a300` EST le token établi**, ne pas le remplacer par `#46a302`), couleurs d'identité par étape : 1=`#1CB0F6` (bleu), 2=`#CE82FF` (mauve), 3=`#58CC02` (vert). |
| Contexte « Nouvel investisseur / d'ailleurs » | On le **persiste** : `account_type: 'Proposition'` + `account_label: 'Nouvel investisseur' | 'Transfert'` sur chaque ligne. (Vérifié : le Journal affiche `account_type` en préfixe de la ligne méta — « Proposition · cible 12 mois · date » — et n'affiche pas `account_label` : sans risque.) |

---

## §3 — LOT 1 : sécurité des données (6 correctifs) — commit `Proposition : sécurité des données (tag, PDF, devise, doublons, brouillon)`

### F1 — Plus JAMAIS de perte silencieuse du tag (H1/H8/H9/M10)
**Fichier :** `src/app/api/price-target-snapshots/route.ts`
**Ancre :** `while (error && guard < 2 && /(average_cost|entry_type)/i.test(error.message))`
**Modif :** dans la boucle, quand la colonne à retirer est `entry_type` ET que `entryType === 'model_portfolio'` → ne PAS retirer/réessayer ; retourner immédiatement :
```ts
return NextResponse.json({
  error: 'La colonne entry_type n’existe pas encore. Exécute supabase/migration_snapshot_entry_type.sql dans Supabase avant d’enregistrer un portefeuille modèle.',
}, { status: 400 });
```
Le repli reste intact pour `average_cost` (toujours) et pour `entry_type` quand `entryType === 'price_target'`.
**S4 (même fichier, en passant) :** à l'ancre `body.entry_type === 'model_portfolio' ? 'model_portfolio' : 'price_target'` — ajouter avant : si `body.entry_type != null` et n'est ni `'price_target'` ni `'model_portfolio'` → 400 `{ error: 'entry_type invalide' }`.
**Acceptation :** POST modèle sans colonne → 400 + 0 ligne insérée + message affiché par le toast d'erreur existant de la page. POST du flux PDF (sans `entry_type` dans le body) → inchangé, réussit même sans colonne.

### F2 — Le PDF client et le récap « rencontres » ignorent les propositions (H4/H5/H7/H10)
**Fichier :** `src/components/reports/PretAColler.tsx` (⚠️ porte le diff 1.2 — voir §0)
**Ancre :** le `useEffect` qui charge l'historique : `fetch(\`/api/price-target-snapshots?nameIdx=` … puis `setPriorSnapshots(`.
**Modif :** filtrer AVANT `setPriorSnapshots`. Shape VÉRIFIÉ : le GET renvoie un **tableau nu** (`return NextResponse.json(data ?? []);` dans route.ts) :
```ts
const rows = (Array.isArray(data) ? data : []).filter(
  (r: { entry_type?: string | null }) => r.entry_type !== 'model_portfolio'
);
```
(Un seul point d'étranglement : TOUT ce qui alimente `groupMeetings`/`buildEvolution`/l'encart « évolution » passe par `priorSnapshots`.)
**Type :** si `SnapshotRow` (dans `src/lib/journal/compare-meetings.ts`) n'a pas `entry_type`, ajouter `entry_type?: string | null` (optionnel, non cassant).
**Acceptation :** un client ayant UNIQUEMENT des lignes modèle → PretAColler se comporte comme « aucun historique » (pas de récap d'évolution, pas de fausse « dernière rencontre »).

### F3 — Conversion USD→CAD à la source (H6)
**Fichier :** `src/app/(dashboard)/proposition/page.tsx`
1. Étendre `type Position` avec `currency: 'CAD' | 'USD'`, déterminée à l'ajout dans `addPosition` depuis le résultat de recherche : CAD si `exchangeShortName ∈ {TSX, TSXV, CSE, NEO}` OU si le symbole matche `/\.(TO|V|CN|NE)$/i` ; sinon USD. (`InlineSymbolSearch.onSelect` doit passer `exchangeShortName` en 3e argument.)
2. Importer `useUsdCadRate` (même import que dans `PretAColler.tsx` — chercher `useUsdCadRate` dans son bloc d'imports).
3. Dans le `useMemo rows` : `const fx = p.currency === 'USD' && usdCadRate ? usdCadRate : 1;` puis `price = rawPrice * fx`, `target = rawTarget * fx`. TOUT en aval (alloc→qty, KPIs, `snapshotRows`) devient CAD automatiquement.
4. UI : sur les lignes USD, petit suffixe gris `US$ → CA$` sous le prix ; si `usdCadRate` indisponible ET qu'une position est USD → bannière ambre « Taux USD/CAD indisponible — les titres US sont exclus de l'enregistrement » et les exclure de `snapshotRows` (ne jamais enregistrer un montant USD non converti).
**Acceptation :** AAPL 228 US$ avec taux 1.37 → tableau affiche ≈312,36 $ ; la ligne du Journal reçoit `current_price`/`target_price` en CAD. Sans taux : AAPL exclu + bannière.

### F4 — Anti-doublons + état « Enregistré ✓ » (H2/M13/M15)
**Serveur** (`route.ts`) : calquer le bloc de dédup existant (ancre `if (sourceKind === 'price_targets_pdf')`) — ajouter :
```ts
if (entryType === 'model_portfolio') {
  await supabase.from('price_target_snapshots').delete()
    .eq('advisor_id', advisorId).eq('entry_type', 'model_portfolio')
    .eq('name_idx', nameIdx).eq('predicted_at', today);
}
```
(Sûr : grâce à F1, ce chemin n'existe que si la colonne existe.)
**Front** (`proposition/page.tsx`) : nouvel état `const [savedAt, setSavedAt] = useState<{ when: string; count: number } | null>(null)`. Au succès : `setSavedAt({ when: new Date().toLocaleTimeString('fr-CA'), count: data.inserted })`. La carte verte passe en mode « ✓ Enregistré au Journal (N titres) à HH:MM » avec : lien **« Ouvrir le Journal → »** (déplacé ICI — voir F5) + bouton « Nouvelle proposition » (reset complet du formulaire + brouillon). Toute modification (titre/poids/nom/montant) remet `savedAt` à null. Le bouton « Enregistrer » est masqué tant que `savedAt` est non nul.
**Acceptation :** double-clic « Confirmer » impossible (déjà `loading`), re-enregistrement le même jour → le lot du jour est REMPLACÉ (pas empilé) ; après succès l'UI dit clairement « fait ».

### F5 — Brouillon localStorage + retrait du lien piégé (H3)
**Fichier :** `proposition/page.tsx`
1. **Supprimer** le `<Link href="/journal">Ouvrir le Journal</Link>` du panneau de confirmation (ancre `Retrouvable dans le Journal avec le badge`) — il ne vit plus QUE dans l'état « Enregistré ✓ » (F4).
2. Brouillon : `useEffect` (debounce ~500 ms) qui écrit `{ context, amountStr, positions }` dans `localStorage['proposition-draft-v1']` ; au montage, restaurer s'il existe. **JAMAIS `clientName`** (voir §2). Vider le brouillon sur « Nouvelle proposition » et après enregistrement réussi.
**Acceptation :** bâtir 5 titres → naviguer vers /journal → revenir : titres/poids/montant restaurés, nom vide. Après succès : brouillon vidé.

### F6 — Le Bilan n'absorbe plus les propositions (M11, moitié de S5)
**Fichier :** `src/app/(dashboard)/journal/bilan/page.tsx`
**Modif :** au point d'entrée des données (le `useMemo`/fetch qui alimente hitRate/calibration/nuage — ancre vers `resolved_at`), filtrer par défaut `s.entry_type !== 'model_portfolio'`. Ajouter le type `entry_type?: string | null` au type local si besoin. (Le sélecteur 3 positions arrive au Lot 2 — F16.)
**Acceptation :** des lignes modèle résolues n'affectent plus le taux de réussite ni « prédit vs réalisé ».

---

## §4 — LOT 2 : friction UX (12 correctifs) — commit `Proposition : saisie des poids, recherche clavier, états d'erreur, Journal (badges, suppression par lot)`

### F7 — Champ Poids réécrit en texte contrôlé par chaîne (M8/M16/L1 — le bug « 0,5 → 5 % »)
`Position` gagne `weightStr: string` (source de vérité de l'input) ; `weight` devient DÉRIVÉ : `parseWeight(weightStr)` avec virgule acceptée (`'12,5' → 12.5`), vide/invalide → 0.
Input : `type="text" inputMode="decimal"`, `value={p.weightStr}`, onChange = set brut de la chaîne. `equalize`/`addPosition` écrivent `weightStr` (ex. `'6,3'` — format fr avec virgule, cohérent avec l'app).
**Acceptation :** taper `0,5` → 0,5 % ; taper `0` → le 0 reste affiché ; `12,5` accepté ; effacer → champ vide = 0 %.

### F8 — « Répartir également » somme EXACTEMENT 100,0 (M7)
Remplacer l'arrondi uniforme (ancre `Math.round((100 / prev.length) * 10) / 10`) par la distribution du résidu :
```ts
const base = Math.floor(1000 / n); // dixièmes de %
const extra = 1000 - base * n;     // nb de titres qui reçoivent +0,1
// titres 0..extra-1 → (base+1)/10 ; les autres → base/10
```
Appliquer la même logique dans `addPosition` (cas « poids tous égaux »).
**Acceptation :** n=16 → total 100,0 exactement (jamais 100,8) ; n=3 → 33,4/33,3/33,3.

### F9 — État immuable + intention explicite (L2/M9)
1. `addPosition` : ne plus muter (`next.forEach((p) => { p.weight = eq; })` → construire par `prev.map((p) => ({ ...p, ... }))`).
2. Remplacer l'heuristique `wasEqual` par un drapeau `const [customWeights, setCustomWeights] = useState(false)` : mis à `true` au premier `setWeight` manuel ; `addPosition` n'égalise QUE si `!customWeights` (sinon nouveau titre à 0 %) ; « Répartir également » remet `customWeights` à `false`.
**Acceptation :** ajuster un poids à la main → ajouter un titre → les poids manuels sont préservés.

### F10 — Recherche pilotable au clavier + composant partagé (M4/M18)
Extraire `InlineSymbolSearch` vers `src/components/models/SymbolSearchInline.tsx` avec : Enter = sélectionner le résultat actif (défaut : premier), ↑/↓ = naviguer (`activeIndex`), Échap = fermer, clic extérieur = fermer (listener `pointerdown` + ref), recherche dès 2 caractères. **Style : celui de compare** (`border-[3px] dashed`, hover `#1CB0F6`). Remplacer la copie locale de `models/compare/page.tsx` ET celle de `proposition/page.tsx` par cet import (compare garde exactement son rendu actuel).
**Acceptation :** tout au clavier ; compare visuellement inchangé.

### F11 — Pannes de données visibles (M5) + données stables (L6)
1. `src/lib/hooks/useQuotes.ts` et `usePriceTargets.ts` : retourner aussi `error` (ajout non cassant) et passer `keepPreviousData: true` aux options SWR des deux hooks.
2. Page : si `quotesError || targetsError` → bannière ambre « Données de marché indisponibles — réessaie dans une minute. » ; distinguer « … » (chargement) de « — » (échec/pas de donnée).
**Acceptation :** ajouter un titre ne fait plus « clignoter » les cibles déjà affichées ; une panne réseau s'affiche honnêtement.

### F12 — Plus d'états morts ni d'exclusions silencieuses (M2/M3/L5)
1. La carte 3 s'affiche dès `positions.length > 0` (retirer `&& amount > 0` de l'ancre `{positions.length > 0 && amount > 0 && (`) ; sans montant, les tuiles KPI affichent « — » et le message existant « Entre le montant à investir (étape 1) » devient ATTEIGNABLE.
2. Titres à 0 % : phrase d'avertissement calquée sur celle des sans-cible (« X titre(s) à 0 % ne seront pas enregistrés ») + poids affiché en ambre sur ces lignes.
**Acceptation :** avec titres mais sans montant, la carte 3 guide au lieu de disparaître ; un 0 % est signalé.

### F13 — Badges « Portefeuille modèle » dans le DÉTAIL du Journal (M6/M12/L8/L9)
**Fichier :** `journal/page.tsx`
1. Vue détail par symbole : chaque ligne/carte avec `entry_type === 'model_portfolio'` reçoit une petite chip verte « Modèle » (réutiliser le style du badge existant, ancre `Portefeuille modèle</span>`).
2. Carte client : badge en compteur — « N portefeuille(s) modèle(s) » ; `avgGain` calculé sur les seules lignes `entry_type !== 'model_portfolio'` (repli : toutes si aucune).
**Acceptation :** dans le détail, on distingue chaque prédiction « modèle » d'une vraie cible au premier coup d'œil.

### F14 — Supprimer un portefeuille modèle en UN clic (M14)
**Fichier :** `journal/page.tsx` (vue détail). Grouper les lignes modèle par `batch_id` ; afficher par lot un bouton « Supprimer ce portefeuille modèle (N titres) » → `DELETE /api/price-target-snapshots?batch_id=...` (existe déjà) → `confirm()` unique → recharger.
**Acceptation :** un lot de 8 titres se supprime en 1 clic + 1 confirmation (au lieu de 8).

### F15 — Le toggle contexte devient réel (M1)
`proposition/page.tsx` : dans `snapshotRows`, `accountType: 'Proposition'` et `accountLabel: context === 'new' ? 'Nouvel investisseur' : 'Transfert'`.
**Acceptation :** la ligne méta du détail Journal affiche « Proposition · cible 12 mois · <date> ».

### F16 — Sélecteur du Bilan (S5, complément de F6)
`bilan/page.tsx` : segmented control 3 positions « Cours cibles | Portefeuilles modèles | Tout » (défaut : Cours cibles), qui pilote le filtre de F6.

### F17 — Autocomplétion du nom depuis Clients (S1)
`proposition/page.tsx` : brancher `useClients()` (`src/lib/hooks/useClients.ts`) ; sous le champ nom, liste filtrée de suggestions cliquables (max 6) quand ≥2 caractères tapés ; texte libre toujours permis (prospects).
**Acceptation :** taper « Tremb » propose les clients existants ; en choisir un remplit le champ.

### F18 — Robustesse API (L11) + partage de `parseMoney` (S2)
1. `route.ts` : plafonner `rows` à 200 (`rows.slice(0, 200)` + champ `truncated` dans la réponse si dépassé), tronquer `symbol`/`name`/`target_source` à 120 caractères.
2. Créer `src/lib/money/parse-loose.ts` exportant la fonction de parsing de montants UI (celle de `proposition/page.tsx` `parseMoney`, identique à `parseOptionalMoney` de PretAColler au signe près — l'unifier avec option `{ allowNegative }`) ; l'importer dans les DEUX pages. **NE PAS toucher** aux parseurs Croesus (`year-activity.ts`, `croesus-parser.ts`) : sémantique différente, hors périmètre.

*(L7 — symboles sans historique Yahoo jamais résolus par le cron : NOTER en « plus tard » (§7), pas dans ce lot.)*

---

## §5 — LOT 3 : le « sharp » visuel (8 correctifs) — commit `Proposition : refonte visuelle dans le langage Duolingo de l'app`

Référence visuelle : `models/compare/page.tsx` + `PretAColler.tsx`. Tokens : dupliquer la constante locale `DUO` de PretAColler (ancre `green: '#58CC02', greenDark: '#45a300'`) OU l'extraire vers `src/lib/ui/duo.ts` et l'importer aux deux endroits (préférer l'extraction si simple).

### F19 — Langage « candy » sur toute la page (M17)
Sections en `rounded-3xl border-[3px]` avec couleur d'identité par étape : 1 = `#1CB0F6`, 2 = `#CE82FF`, 3 = `#58CC02` (bordure `<color>30`, ombre `0 3px 0 0 <color>20`, pastille numéro en fond plein de la couleur). En-tête de page : utiliser `PageHeader` (`src/components/layout/PageHeader.tsx`, cf. L13) en conservant la tuile-icône Briefcase via un wrapper flex.

### F20 — Logos de titres (M19)
`import { StockAvatar } from '@/components/models/simulation/StockAvatar';` (export vérifié : `StockAvatar({ symbol, size = 44 })`). L'ajouter en `size={28}` dans la première cellule du tableau, comme compare.

### F21 — Un seul système de boutons (M20)
Les deux CTA (« Enregistrer » et « Confirmer l'enregistrement ») deviennent le même patron Duolingo : `rounded-2xl`, fond `#58CC02`, `boxShadow: '0 4px 0 0 #45a300'`, `active:translate-y-[2px] active:shadow-none`, `disabled:opacity-50`. (Patron exact : chercher `boxShadow` + `DUO.green` dans PretAColler.)

### F22 — Coffre compact (M21)
`src/components/security/VaultGate.tsx` : ajouter la prop optionnelle `inline?: boolean` (défaut false → rendu actuel intact pour journal/reports). Si `true` : `SetupCard`/`UnlockCard` sans `max-w-* mx-auto mt-*` (les recevoir en prop ou wrapper conditionnel), spinner en `py-6` au lieu de `py-20`. La page Proposition l'utilise avec `inline`.

### F23 — Champ Poids confortable (M22)
(L'input est devenu texte au Lot 2/F7.) Largeur `w-[4.5rem]`, `py-2`, alignement droit, plus de spinners par construction.

### F24 — Formats de nombres fr-CA unifiés (L15)
Partout : `182,52 $` (suffixe, virgule — remplacer les `$${fmtDec(...)}`), `+15,1 %` (`toLocaleString('fr-CA')` + espace insécable ` %`), montants `250 000 $` (déjà OK via `fmtMoney`).

### F25 — Tableau qui ne replie jamais (L14)
`min-w-[640px]` sur la table + `whitespace-nowrap` sur toutes les cellules numériques (le conteneur `overflow-x-auto` existe déjà).

### F26 — Rythme 1-2-3 complet + états soignés (L16/L4/L3/L12)
1. Carte 3 : pastille « 3 » + titre « Le résultat » (même patron que 1 et 2).
2. Tuiles KPI : `flex flex-col justify-between` + hauteur de libellé fixe (alignement des valeurs).
3. Tuile « Gain projeté » : sous-texte « liquidités et titres sans cible comptés à 0 % » (L3).
4. Liquidités : masquer la ligne si le résidu < 0,25 % (artefact d'arrondi, L4).
5. État vide (aucun titre) : icône + phrase, calqué sur les états vides de compare.
6. Vérifier qu'aucun hex vert « inventé » ne subsiste : uniquement `#58CC02` / `#45a300` (L12).

---

## §6 — Vérification finale (après Lot 3)

1. `npx tsc --noEmit` → 0 erreur ; `npx next build` → exit 0 (route `/proposition` listée).
2. **E2E manuel (avec Nicolas, migration exécutée)** :
   - Bâtir : 2 titres CA (RY.TO, ENB.TO) + 1 US (AAPL) + montant `250 000` → prix CAD partout, gain projeté affiché.
   - Poids : taper `0,5` → 0,5 % ; « Répartir également » → 100,0 exactement.
   - Brouillon : aller au Journal, revenir → tout restauré sauf le nom.
   - Enregistrer (coffre) → état « ✓ Enregistré » ; re-enregistrer → le lot du jour est remplacé (compter les lignes au Journal).
   - Journal : badge sur la carte ET chips dans le détail ; « Supprimer ce portefeuille modèle » en 1 clic.
   - PretAColler : générer un PDF pour le MÊME client → aucun récap « évolution » issu de la proposition.
   - Bilan : les lignes modèle n'apparaissent que via le sélecteur.
3. **Revue adversariale finale** : sous-agents en 3 angles (correctness / intégration / design) sur le module complet + vérification sceptique ; corriger tout CONFIRMED ; re-typecheck/build.
4. Récapitulatif à Nicolas : liste des commits, rappel « PretAColler.tsx reste non commité (couplé au 1.2) », rappel de pousser lui-même.

## §7 — Hors périmètre (déjà arbitré, ne pas faire)
- L7 : validation « le symbole a un historique Yahoo » à l'ajout (backlog).
- Refonte des parseurs Croesus / unification au-delà de `parse-loose` (S2 étendu).
- L'épic complet « Proposition de portefeuille » 9 pages PDF (plan séparé fourni par Nicolas — maquette HTML manquante, phases 0-5).
- Tout ce qui touche le « cours cibles 1.2 » (autre chantier, autre commit).
