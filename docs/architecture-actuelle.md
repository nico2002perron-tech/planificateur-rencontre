# Architecture actuelle du planificateur de rencontre

**Date du relevé : 4 août 2026.** Document établi à partir de sept cartographies indépendantes du dépôt (génération PDF, données Croesus, identité et chiffrement, détection d'environnement, appels sortants, outillage, interface). Il sert à deux lectures : celle du planificateur, qui veut savoir ce que la machine fait de ses données, et celle du développeur, qui veut les points d'ancrage exacts.

Tous les chemins sont relatifs à la racine du dépôt :
`…\IA PublicQuébec\NICOLAS PERRON\Projet de Nicolas Perron\planificateur-rencontre`.

Quand deux cartographies ne disent pas la même chose, c'est écrit noir sur blanc sous l'étiquette **Divergence**. Rien n'a été tranché à l'aveugle.

---

## 1. Résumé exécutif

L'application est un poste de travail de conseiller bâti sur Next.js 16 (App Router, React 19) déployé sur Vercel, avec Supabase comme base de données et Croesus comme source de vérité, alimentée par collage manuel. Elle produit des documents de rencontre — le principal étant le PDF de cours cibles — à partir d'un collage de positions, enrichi par des services externes (Yahoo, FMP, Groq).

**Réponse à la question décisive : le PDF est généré à 100 % côté serveur.** Neuf routes API appellent `renderToBuffer` de `@react-pdf/renderer` dans un processus Node ; il n'existe aucune occurrence de `PDFDownloadLink`, `usePDF`, `BlobProvider` ou `PDFViewer` dans `src/`. Le navigateur ne fait que poster un corps JSON et recevoir un blob opaque (`src/components/reports/PretAColler.tsx:1492` et `:1503`).

Conséquence pour l'archivage local : les octets complets du document existent déjà dans le processus Node, au même endroit et au même instant que le nom du client (`src/app/api/exports/price-targets/route.ts:19` et `:41`). L'archivage est donc **un simple `fs.writeFile` dans la route**, sans API File System Access, sans consentement navigateur, sans aller-retour. Deux réserves : l'application n'écrit aujourd'hui **aucun** fichier (aucune trace de `writeFile`/`mkdir` dans `src/`), et il n'existe **aucune** détection « je tourne en local ou sur Vercel » — les deux briques sont à créer de zéro.

---

## 2. La génération PDF

### 2.1 Points d'entrée

Neuf routes API produisent un PDF. Toutes sont des routes App Router en runtime Node ; aucune server action (`'use server'` : zéro fichier dans `src/`) ; aucun composant client ne fabrique de PDF.

| # | Route | Verbe | Document | Session vérifiée | Nom du client disponible |
|---|---|---|---|---|---|
| 1 | `src/app/api/exports/price-targets/route.ts` (`:33`) | POST | **Cours cibles — le flux principal** | oui (`:14`) | oui, en clair (`:19`) |
| 2 | `src/app/api/proposition/pdf/route.ts` (délègue à `src/lib/pdf/proposition-report.tsx:665`) | POST | Proposition de portefeuille | oui | oui (`body.client`) |
| 3 | `src/app/api/reports/generate/route.ts` (`:513`) | POST | Rapport complet V2 (18 pages) | oui | oui, lu en base (`:44-49`) |
| 4 | `src/app/api/reports/[id]/download/route.ts` (`:101`) | GET | Re-rendu d'un rapport archivé | oui | oui — **seule route qui met le nom dans le nom de fichier** (`:106`) |
| 5 | `src/app/api/portfolio/pdf/route.tsx` (`:9`) | POST | `StrategyReport` | **non** | non |
| 6 | `src/app/api/rapport/route.ts` (`:17`) | GET/POST | Rapport diagnostic **public** | non (public assumé, `:10-11`) | non |
| 7 | `src/app/api/transition/generate-pdf/route.ts` (`:24`) | POST | Document de transition | oui | oui |
| 8 | `src/app/api/models/[id]/simulation/export/route.ts` (`:17`) | POST | Simulation | **non** | non |
| 9 | `src/app/api/events/[id]/tournament/pdf/route.ts` | GET | Feuille de tournoi | — | sans objet |

À ne pas confondre avec une génération : `src/app/api/fund-reports/[id]/download/route.ts:39` relaie un PDF **déjà stocké** dans Supabase Storage ; `src/app/api/exports/price-targets/html/route.ts` produit le « Rapport vivant » en HTML à partir du même pipeline de données (`enrichReportData`, `:50`) ; `src/app/api/events/[id]/tournament/bracket/route.tsx` produit une image PNG.

**Trois routes seulement** déclarent leur runtime : `proposition/pdf/route.ts:7-8` (`runtime='nodejs'`, `maxDuration=60`), `exports/price-targets/html/route.ts:10-11`, `events/[id]/tournament/pdf/route.ts:10-11`. La route principale des cours cibles ne le fait pas, alors qu'elle enchaîne enrichissement réseau, rendu et téléchargements Supabase.

### 2.2 Preuve du rendu serveur (cours cibles)

Trois preuves indépendantes et convergentes :

1. `src/app/api/exports/price-targets/route.ts:5` importe `renderToBuffer`, API Node inexistante dans un bundle navigateur, et l'appelle en `:33`.
2. `src/components/reports/PretAColler.tsx` est `'use client'` (`:1`) mais son `handleDownloadPdf` (`:1487`) se contente de `fetch` POST (`:1492`), `await res.blob()` (`:1503`) et d'un `<a download>` synthétique (`:1505-1514`).
3. Le gabarit est **physiquement inexécutable** dans un navigateur : `src/lib/pdf/price-targets-template.tsx:27` calcule `FONTS_DIR` depuis `process.cwd()` et `:32` fait un `fs.readFileSync` **au chargement du module** (constantes `LOGO_SRC`/`ICON_G_SRC`, `:35-36`). `next.config.ts:4` confirme : `serverExternalPackages: ['@react-pdf/renderer']`.

### 2.3 Mécanique d'assemblage

Deux étages, à ne jamais confondre.

**Étage 1 — react-pdf : un seul `<Document>` à `<Page>` conditionnelles.**
`PriceTargetsDocument` (`src/lib/pdf/price-targets-template.tsx:2094-2177`) lit `data.options` (`:2095`), en dérive des booléens (`:2096-2102`) et retourne un unique `<Document>` (`:2123`) dont chaque enfant est gardé par `{condition && <XxxPage/>}`. **L'ordre des pages du PDF est l'ordre du JSX** : Couverture → Activité annuelle → Déploiement → Sources de croissance → Répartition → Récapitulatif → Tableau actions → Détail des revenus → Tableau revenu fixe → Descriptions.

Chaque section est une fonction qui retourne **exactement une** `<Page size="A4" orientation={orientation} style={styles.page}>`. Certaines vivent dans le même fichier (`CoverPage:793`, `EquityTablePage:1060`, `FixedIncomeTablePage:1305`, `DescriptionsPage:1667`, `RecapPage:1734`, `IncomeDetailPage:1921`), d'autres dans des modules frères : `src/lib/pdf/year-activity-pages.tsx` et `src/lib/pdf/deployment-page.tsx`.

Le contrat d'activation est le type `PdfRenderOptions` (`price-targets-template.tsx:103-119`), un sac de booléens `include*` envoyé par le navigateur. **Convention en vigueur : `!== false`** — une section absente des options est donc **active par défaut** (`:2096`).

**Étage 2 — pdf-lib : agrafage en queue seulement.**
`src/lib/pdf/merge-fund-pdfs.ts:64` recharge le buffer rendu, puis `:69-71` copie et **ajoute** les pages des fiches de fonds téléchargées de Supabase. Aucune insertion au milieu, aucune fusion de plusieurs documents react-pdf.

### 2.4 Où insérer une nouvelle section

Trois points de touche, tous à l'étage 1 :

1. un drapeau dans `PdfRenderOptions` (`price-targets-template.tsx` ~`:119`) ;
2. un composant retournant une unique `<Page>` ;
3. une ligne conditionnelle dans le `<Document>`, entre `:2170` et `:2174`.

Deux conséquences structurelles : la nouvelle section se placera **toujours avant** les fiches de fonds (pdf-lib n'agrafe qu'en queue) ; et comme le `<Document>` est évalué **dans la route serveur**, le drapeau « local seulement » peut être **imposé par la route** plutôt que reçu du client — plus sûr, et cela évite de toucher à `PretAColler.tsx`.

### 2.5 Langage visuel

`src/lib/pdf/styles.ts` est la source unique des couleurs : `export const C` (`:4`) porte navy `#03045e` (`:6`), blue `#0077b6` (`:7`), cyan `#00b4d8` (`:8`), or `#c5a365` (`:11`) ; `styles.page` fixe Open Sans (`:64`) et `styles.sectionTitle` Montserrat 700 en navy (`:74-80`). **35 fichiers** importent `{ styles, C }` : une nouvelle section hérite gratuitement de la charte.

Deux fissures connues : `Font.register` est **dupliqué dans 8 gabarits** (dont `price-targets-template.tsx:38,46`), donc tout changement de chemin de polices se fait huit fois ; et le navy est écrit en dur, hors du jeton `C.navy`, dans `report-template.tsx` (4 fois), `pages/bonds.tsx`, `rapport-diagnostic.tsx`, `strategy-template.tsx`. `src/lib/pdf/tournament-sheet.tsx` est le seul gabarit hors du système commun (`StyleSheet.create` local).

Volumétrie : `src/lib/pdf/` ≈ 13 680 lignes, dont 2 177 pour `price-targets-template.tsx`. Cibler par numéro de ligne ; ne pas relire l'ensemble.

### 2.6 Ce qui n'existe pas

**Aucun PDF produit n'est persisté nulle part.** `reports/generate/route.ts:525-537` n'insère qu'une ligne de métadonnées ; `reports/[id]/download/route.ts:101` **re-génère** le document à la volée ; le bucket Supabase `fund-facts` ne contient que des documents d'entrée. L'archivage est donc une capacité entièrement neuve : rien à réutiliser, mais rien à préserver non plus.

---

## 3. Les données Croesus

### 3.1 Cinq points de parsing, dont un hors de l'application

| # | Module | Fonction | Objet | Appelants |
|---|---|---|---|---|
| 1 | `src/lib/parsers/croesus-parser.ts` | `parseCroesusData()` (`:691`) | **Positions** (1 007 lignes) | `PretAColler.tsx:3627`, `models/transition/page.tsx:436`, `models/rebalance/page.tsx:165`, via `smart-parser.ts:137` |
| 2 | `src/lib/portfolio/year-activity.ts` | `parseCroesusActivity()` (`:376`) | **Transactions** (18 colonnes) | `PretAColler.tsx:1228`, saisie dans `YearActivityBuilder.tsx:162-168` |
| 3 | `src/app/(dashboard)/transactions-du-jour/page.tsx` | `parsePastedRows` (`:127`) | Transactions du jour, **ordre de colonnes différent** (`:33-52`) | la page elle-même |
| 4 | `src/lib/parsers/bonds-excel-parser.ts` | `parseRepartitionExcel` (`:181`) | « Répartition d'actifs.xlsx » (Croesus mensuel iA) | `api/models/bonds/import/route.ts:14` |
| 5 | `EXECEL A PLANIF/moteur-book/moteur-livre.cjs` | script autonome Node | **Le grand livre** : 5 fichiers .txt ≈ 155 Mo, latin1, 832 142 lignes | aucun — lancé à la main |

Les deux premiers ne partagent que `ACCOUNT_TYPE_MAP` : ce sont deux parseurs indépendants.

### 3.2 Format des positions

- **Séparateur auto-détecté** (`croesus-parser.ts:254-265`) parmi tabulation, `;` et `,` ; la tabulation gagne les égalités et sert de repli.
- **En-têtes facultatifs** : mapping par expressions régulières FR/EN (`:112-131`) ou, à défaut, reniflage positionnel avec **six dispositions codées en dur** (`:756-842`) de 13, 12, 12, 11, 6 et 4 colonnes. Ordre canonique documenté en `:7-21`.
- **Un troisième format, vertical** (vue web Croesus), détecté avant le tabulaire (`:711`) et traité par `parseVerticalHoldings` (`:577`). Il ne fournit **ni valeur comptable ni coût** : `bookValue: 0, averageCost: 0` (`:634-635`).
- Coupon et échéance sont extraits de la description quand ils manquent (`extractBondDetails:367-437`).
- Le champ `sector` est **détecté mais jamais rempli** : il figure dans `ColumnMapping` (`:102`) et dans les motifs d'en-têtes (`:123`), mais aucune lecture dans la boucle (`:917-932`). Le secteur vient en réalité de Yahoo (`src/lib/pdf/fetch-sectors.ts`).
- Chaque `ParsedHolding` conserve `rawRow: string` (`:931`) — la ligne brute d'origine.

### 3.3 Format des transactions — et le piège 18 contre 20

`parseCroesusHistoryRow` (`year-activity.ts:333`) lit **18 colonnes positionnelles en dur**, jusqu'à `cells[17]`, **sans aucun contrôle de `cells.length`**. Séparateur : **tabulation uniquement** (`:383`).

Or l'en-tête réel des fichiers du book (`EXECEL A PLANIF/2020A2022.txt`) compte **20 colonnes** : les 18 attendues **précédées de `Ind. VM` et `Description`**. Le moteur hors application le sait (`moteur-livre.cjs:115` : `if (c.length < 20) continue;`) ; l'application, non. Un collage à 20 colonnes sans en-têtes décale tous les index **en silence**. Aucun test ne couvre ce cas : les fixtures de `src/lib/portfolio/__tests__/deployment.test.ts:9` empruntent toutes la voie **avec** en-têtes. `PLAN-GRAND-LIVRE.md:301` le dit déjà explicitement.

Deux champs sont lus mais jamais exploités : « Int. courus » (13) et « PBR manuel » (15).

Nuance à retenir : **le vrai type de compte est le suffixe du numéro** (`…-W` → CELI), pas le « Code CP » (`year-activity.ts:505-522`, `ACCOUNT_SUFFIX_MAP`).

### 3.4 Dédoublonnage et historique

**Dans l'application : rien.** L'identifiant d'une transaction est `${date}-${index}-${symbole||type}` (`year-activity.ts:310` et `:353`) — l'index est **la position dans le collage**, donc non reproductible d'une fois à l'autre. Le collage brut n'est jamais persisté : `activityPaste` est un simple `useState` (`PretAColler.tsx:529`), reparsé à chaque frappe ; le PDF ne reçoit que des agrégats (`:1427-1430`). Le seul dédoublonnage métier existant concerne les jambes miroir d'une cotisation en nature (`year-activity.ts:595-601`).

**Hors application : le travail sérieux est déjà fait.** `moteur-livre.cjs:119` utilise l'empreinte `compte|date|type|symbole|total|quantité|solde` avec **comptage d'occurrences par fichier et maximum entre fichiers** (`:120-124`) — jamais une union ensembliste. `PLAN-GRAND-LIVRE.md:310` explique pourquoi : la clé ensembliste naïve produit **3 892 collisions mesurées** sur 832 142 lignes (deux exécutions partielles du même ordre le même jour sont identiques). La colonne Solde a été ajoutée pour cette raison précise. La clé d'une position y est `compte|symbole|devise` (`:587`).

Les cinq pièges déjà payés sont listés dans `PLAN-GRAND-LIVRE.md:357`. Le cinquième — **la clé d'une position est symbole ET devise** — est **encore vivant dans l'application** : `src/lib/portfolio/deployment.ts:235` (`canonKey`) supprime le suffixe `.NE` et écrase donc un CDR sur son sous-jacent américain, et `src/lib/journal/compare-meetings.ts:153` indexe sur le seul symbole.

**Le seul historique cumulatif de l'application est `price_target_snapshots`** : écrit par `src/app/api/price-target-snapshots/route.ts:67`, dédoublonné par *delete-then-insert* sur `(advisor_id, source_kind, name_idx, predicted_at)` (`:149-157`), regroupé par `src/lib/journal/compare-meetings.ts`. Aucune table de transactions n'existe (`supabase/schema.sql`).

### 3.5 Types existants (à réutiliser plutôt qu'à recréer)

| Type | Emplacement | Contenu utile |
|---|---|---|
| `ParsedHolding` / `ParseResult` | `croesus-parser.ts:28` / `:56` | position parsée, avec `rawRow` |
| `AssetType`, `ACCOUNT_TYPE_MAP` | `croesus-parser.ts:26` / `:77` | A/E/W/S/T/Y/P/N/F → libellés |
| `CroesusActivityTransaction` | `year-activity.ts:9` | transaction complète |
| `PortfolioActivitySummary` | `year-activity.ts:61` | agrégat qui alimente le PDF |
| `DeploymentLine`, `GrowthFloor`… | `deployment.ts:33`, `:109` | parcours des dépôts |
| `Fiscalite`, `FISCALITE_PAR_CODE` | `src/lib/film/build-sections.ts:33`, `:62-72` | **`'abri' \| 'reporte' \| 'imposable' \| 'inconnu'` par code de compte** |
| `SnapshotRow` | `src/lib/journal/compare-meetings.ts:14` | capture de rencontre |

**Il n'existe aucun type « Compte » au sens d'un compte client réel, ni aucune transaction persistée.** Le compte n'est qu'un code lettre sur une position et une chaîne sur une transaction.

---

## 4. L'identité client et le chiffrement

### 4.1 Comment le nom entre

| Flux | Mode de saisie | Lien à la base |
|---|---|---|
| **Cours cibles / « Prêt à coller »** | texte libre (`PretAColler.tsx:284`, état `:3624`) | aucun |
| Rapport Prospect | texte libre (`ProspectReport.tsx:487`) | aucun |
| Transition, Courriel modèle | texte libre (`models/transition/page.tsx:382`, `models/email/page.tsx:60`) | aucun |
| **Proposition** | texte libre + autocomplétion depuis Supabase (`proposition/page.tsx:87`, `:172-179`) | **la suggestion n'injecte que la chaîne, jamais l'UUID** |
| **Rapport complet** | sélection d'un client Supabase (`reports/new/page.tsx:88`) → `client_id` (`:267`) | oui |

Deux mondes qui ne se parlent pas. Le flux qui produit réellement les PDF de rencontre est celui du texte libre.

### 4.2 Où le nom est déchiffré

Exclusivement **dans le navigateur**. `src/lib/crypto/clientVault.ts` : `deriveKeys()` (`:79-117`) fait PBKDF2-HMAC-SHA256 à 600 000 itérations puis HKDF vers deux sous-clés non exportables ; `decryptName()` (`:131-137`) applique AES-256-GCM. Preuve structurelle : le **seul** import de ce module dans tout `src/` est `src/components/security/VaultProvider.tsx:7`, et ce fichier est `'use client'`. Aucune route serveur ne l'importe. Les clés vivent en mémoire seulement (`VaultProvider.tsx:36`), avec auto-verrouillage après 15 minutes (`:30`).

`/api/vault` ne stocke que le sel PBKDF2 et un vérificateur chiffré (`route.ts:32`). La rotation de phrase de passe est **impossible** : `route.ts:63-65` refuse d'écraser un sel existant.

Point d'appel réel du déchiffrement : `src/app/(dashboard)/journal/page.tsx:163`. Chiffrement : `PretAColler.tsx:1542`, `proposition/page.tsx:287`, `journal/page.tsx:187`.

### 4.3 Ce qui est chiffré, ce qui ne l'est pas

**Chiffré** : `price_target_snapshots.name_enc` / `.name_idx` (`supabase/migration_client_vault.sql:25`) — et la route refuse toute écriture sans `nameIdx`, en écrivant `client_name: ''` (`api/price-target-snapshots/route.ts:91` et `:168`).

**En clair** :
- la table `clients` **entièrement** : `first_name`, `last_name`, `email`, `phone`, `notes` (`supabase/schema.sql:30-45`) ;
- `transition_history.client_name` (`schema.sql:503`) ;
- `analyse_leads.prenom/nom/courriel` (`supabase/migration_analyse_leads.sql:10-12`) ;
- `reports.title`, qui contient le nom complet (`reports/generate/route.ts:525`) ;
- **dans les captures chiffrées elles-mêmes** : `quantity` et `average_cost` restent en clair (`price-target-snapshots/route.ts:122-123`).

Une migration existe pour `meeting_notes` (`supabase/migration_meeting_notes_vault.sql`) mais **aucun code de `src/` ne lit ni n'écrit cette table** : la fonctionnalité n'existe pas dans ce dépôt.

### 4.4 Identifiant stable non nominatif

- `clients.id` (UUID, `schema.sql:31`) — propre, mais n'existe que pour les clients créés dans le module Clients. `price_target_snapshots` **n'a pas de `client_id`**.
- `price_target_snapshots.name_idx` — HMAC-SHA256 du nom normalisé, tronqué à 128 bits, en base64 (`clientVault.ts:140-146`). C'est le **vrai pseudonyme de l'application** : clé de regroupement du Journal (`journal/page.tsx:86`), de dédoublonnage et de recherche d'historique. Deux limites : il n'est calculable **que dans le navigateur, coffre déverrouillé**, et il est en **base64 standard** (`clientVault.ts:40`), donc il contient `/` et `+` — illégal comme nom de dossier Windows.
- `normalizeName()` (`clientVault.ts:64-71`) est pure, sans crypto : NFD, sans accents, minuscules, espaces réduits. C'est la fonction canonique réutilisable pour fabriquer un slug de dossier.

### 4.5 Le nom dans les documents produits

| Document | Où le nom apparaît |
|---|---|
| Cours cibles | couverture seulement (`price-targets-template.tsx:831-834`). **Aucune métadonnée** : `<Document>` (`:2123`) est sans `title` ni `author` |
| Proposition | métadonnée `title` (`proposition-report.tsx:314`), couverture (`:343`), clause de confidentialité (`:652`) |
| Rapport complet | métadonnée `title` (`report-v2.tsx:227`), couverture (`pages/cover.tsx:65`) |
| Transition | bandeau client (`transition-template.tsx:409`) |
| Rapport vivant HTML | `<title>` (`render-html.ts:133`) et deux affichages (`cover-html.ts:372`, `:440`) |

**Deux politiques de nom de fichier opposées cohabitent** : neutre pour les cours cibles, avec commentaire explicite (« le nom du client ne doit pas se retrouver en clair dans le dossier Téléchargements, souvent synchronisé OneDrive », `PretAColler.tsx:1507` et `api/exports/price-targets/route.ts:44`) ; **nominative** pour la Proposition (`proposition/page.tsx:344`, `api/proposition/pdf/route.ts:99-103`).

Enfin, une fuite existante à corriger indépendamment du chantier : `api/reports/generate/route.ts:546` renvoie l'en-tête HTTP `X-Report-Title` contenant le nom complet, dans la réponse même où le `Content-Disposition` a été soigneusement neutralisé (`:544`). Les en-têtes sont journalisables par la plateforme.

---

## 5. La détection d'environnement et les gardes existantes

### 5.1 Détection d'environnement : elle n'existe pas

Recherche exhaustive de `NODE_ENV`, `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` dans `src/` (456 fichiers) : **zéro résultat**. Aucune détection par hôte non plus (aucun `headers().get('host')`, aucun `nextUrl.origin`). `next.config.ts` (15 lignes) ne contient ni `redirects`, ni `rewrites`, ni `headers`, ni bloc `env`. `vercel.json` (20 lignes) ne contient que quatre tâches planifiées.

Le seul signal quasi environnemental est une série d'URL de repli codées en dur qui **présument la production** : `src/lib/email.ts:13` (`process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app'`), plus le même motif dans `src/lib/tournament/state.ts:234` et deux routes de tournoi.

`PLAN-GRAND-LIVRE.md:192` prescrit déjà une page « Atelier du book » gardée par `NODE_ENV !== 'production'`. **Ce n'est pas implémenté** : aucun `NODE_ENV` nulle part, aucun `notFound()` importé nulle part dans `src/`, aucun fichier contenant « atelier ».

**Divergence entre cartographies.** La cartographie « données Croesus » reprend la prescription du plan (`NODE_ENV !== 'production'`) ; les cartographies « environnement » et « appels sortants » la déconseillent formellement, pour une raison concrète : `npm run build && npm start` sur le poste de Nicolas met `NODE_ENV=production` et désactiverait toutes les fonctions locales. Elles recommandent l'**absence de `process.env.VERCEL`** (variable posée automatiquement par la plateforme sur tous ses environnements, y compris les prévisualisations) et/ou une variable d'adhésion explicite présente uniquement dans `.env.local`. Ce point doit être tranché par Nicolas avant l'écriture de la phase 1 — voir §10.

### 5.2 La seule garde : `middleware.ts`

45 lignes à la racine. Dans l'ordre :

1. **Liste blanche par préfixe** (`:7`, testée `:13`) : 15 chemins publics, dont `/api/portfolio`, `/analyse`, `/tournoi`, `/api/rapport`. Comparaison par `pathname.startsWith(p)` — **préfixe brut, pas segment**.
2. **Échappatoire statique** (`:18`) : `startsWith('/_next') || startsWith('/favicon') || pathname.includes('.')`.
3. **Authentification JWT** (`:22`) ; sans jeton → **redirection 302 vers `/login`**, pas un 401 JSON (`:27`).
4. Changement de mot de passe forcé (`:31`), puis rôle admin sur `/admin` (`:36`).

Le matcher (`:44`) est `'/((?!_next/static|_next/image|favicon.ico).*)'` : **toute future route `/api` sera interceptée**.

Deux pièges à connaître avant d'écrire quoi que ce soit :

- **`pathname.includes('.')` contourne l'authentification.** Une route d'archivage exposant `/api/archive/rapport.pdf` serait servie **sans aucune authentification, y compris en production**. Ne jamais mettre de point dans un chemin de route.
- **La liste blanche par préfixe fuit sur ses voisins.** Preuve vivante : `/api/portfolio` étant public, `/api/portfolios` **et** `/api/portfolio-history` traversent le middleware sans authentification. Le premier se rattrape avec `getServerSession` (`api/portfolios/route.ts:8`) ; **`src/app/api/portfolio-history/route.ts` n'a aucune vérification** — trou de sécurité existant, hors chantier mais à signaler.

Deuxième couche : `getServerSession(authOptions)` route par route (plus de 60 fichiers), session JWT de 8 heures (`src/features/auth/config.ts:48`). Troisième couche, motif réutilisable pour une garde locale : le jeton porteur des tâches planifiées — comparaison de l'en-tête `Authorization` à `Bearer` + `process.env.CRON_SECRET` (`api/cron/refresh-prices/route.ts:11`, et quatre autres routes).

Enfin, `middleware.ts` est compilé pour le **runtime edge** (confirmé par `.next/server/middleware-manifest.json`) : il ne peut ni utiliser `fs`, ni tester l'existence d'un dossier local.

### 5.3 Écritures disque : aucune dans l'application

Recherche de `writeFileSync|writeFile|mkdirSync|mkdir|createWriteStream|appendFileSync|rmSync|unlinkSync|readdirSync|existsSync` dans `src/` : **aucun résultat**. Trois fichiers seulement importent `fs`, et uniquement en **lecture** d'actifs de `public/` : `src/lib/pdf/price-targets-template.tsx:32`, `src/lib/pdf/proposition-report.tsx:25`, `src/lib/film/render-html.ts:70`.

Les écritures existent uniquement hors de Next : `scripts/` (29 fichiers, ex. `scripts/preview-pdf-cours-cibles.tsx:71` écrit vers `C:/tmp`) et `tools/`. **Attention : `scripts/` est ignoré par git** (`.gitignore:44`) — ces précédents n'existent pas dans un clone frais.

Sur Vercel, une écriture disque échouerait : le système de fichiers y est en lecture seule sauf `/tmp`, lui-même éphémère.

### 5.4 Variables d'environnement

Quinze noms distincts sont lus par le code : `GROQ_API_KEY` (14 usages), `NEXT_PUBLIC_SUPABASE_URL` (5), `CRON_SECRET` (5), `SUPABASE_SERVICE_ROLE_KEY` (4), `NEXTAUTH_URL` (4), `RESEND_API_KEY` (3), `PUBLIC_SITE_URL` (2), `NEXTAUTH_SECRET` (2), `JETON_SESSION` (2, scripts de développement), `FMP_API_KEY` (2), `EMAIL_FROM` (2), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `GEMINI_API_KEY`, `EODHD_API_KEY`.

Deux sources de documentation, **toutes deux incomplètes et divergentes** : `.env.example` (8 variables, versionné) et `README.md:501-522` (9 variables). Ni l'une ni l'autre ne mentionne `PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM` ni `JETON_SESSION`. Aucune validation de schéma au démarrage, alors que `zod` est déjà en dépendance — et `src/lib/supabase/server.ts:5-6` utilise l'assertion non nulle `!`, donc une variable manquante produit un plantage tardif et opaque.

### 5.5 Le lanceur existe déjà

`demarrer-localhost.bat` (21 lignes, racine) : `cd /d "%~dp0"`, vérification de `npm` avec message d'erreur en français, bandeau ASCII, `call npm run dev`, `pause`. Il n'ouvre **aucun** navigateur et pointe l'utilisateur vers `http://localhost:3000/reports` (`:15`). La phase 5 est une **extension**, pas une création. À noter : le fichier apparaît comme non suivi dans git.

---

## 6. Verdict sur les appels sortants (règle 6)

**Verdict : la règle 6 n'est pas respectée aujourd'hui.** Le nom du client est protégé ; le dossier ne l'est pas.

### 6.1 Ce qui est protégé — et c'est délibéré

Le nom réel du client **n'est jamais envoyé à Groq dans le rapport complet**. `src/lib/ai/prompts-v2.ts:139` écrit `CLIENT: Le client` en dur, avec un commentaire explicite en `:133-136`. Le câblage a été vérifié : `reports/generate/route.ts:493` appelle bien la V2, et `clientName` figure dans le type sans jamais être interpolé. Cette posture est réelle et pensée.

Les appels Yahoo sont propres : les 24 URL de `src/lib/yahoo/client.ts` sont des GET dont le seul paramètre variable est un ticker (`encodeURIComponent`), plus des bornes de dates. La seule quasi-exception (`:306`) envoie un **nom de compagnie** résolu depuis le ticker (`:300`), pas un nom de personne. **Yahoo ne reçoit que des symboles.** Idem pour `fetch-sectors.ts:42` et les logos FMP (`fetch-logos.ts:20`).

Les courriels (Resend) sont propres aussi : `src/lib/email.ts` (506 lignes) est 100 % événementiel et tournoi — prénom, courriel, téléphone, équipe, pointage. **Zéro montant, zéro titre, zéro portefeuille.** `src/lib/courriel/notification-lead.ts:32` prend même soin d'écrire que « le détail de son portefeuille est disponible dans *Analyses reçues* » plutôt que de le mettre dans le courriel.

### 6.2 Ce qui fuit quand même

| # | Fuite | Preuve |
|---|---|---|
| 1 | **Valeur totale du portefeuille**, positions, revenu annuel, valeurs Monte-Carlo en dollars et **objectifs en texte libre** vers Groq | `prompts-v2.ts:144`, `:146-147`, `:161`, `:157`, `:141` |
| 2 | **Collage brut du relevé** (100 premières lignes) vers Groq — et, en mode vision, **la capture d'écran entière encodée en base64** | `api/ai/parse-portfolio/route.ts:99` et `:77-88` |
| 3 | **La liste complète des titres de chaque client**, à chaque collage, **automatiquement, sans bouton ni réglage** | `PretAColler.tsx:628` et `:670`, deux `useEffect` qui partent au montage |
| 4 | **Le nom du client** vers Groq, via un champ que l'interface invite à remplir (« Ex : M. Untel ») | `api/models/email/route.ts:73`, `models/email/page.tsx:198-203` |
| 5 | Valeur totale + top 15 positions vers Groq | `api/transition/analyze/route.ts:60` et `:65` |
| 6 | **Noms de prospects et notes d'appel brutes** vers Google Gemini | `api/prospection/ai/summary/route.ts:26`, `ai/script/route.ts:37-40`, `ai/score/route.ts:31` |
| 7 | Dossier client complet **en clair chez Supabase** | `api/clients/route.ts:31-33` |

Trois précisions opérationnelles :

- **Les clés `GROQ_API_KEY` et `GEMINI_API_KEY` sont renseignées dans `.env.local`.** Tous ces appels partent **aussi en exécution locale**. Un lanceur en mode bureau ne coupe rien.
- Le garde-fou existant est partiel mais réel : `reports/generate/route.ts:490` conditionne l'IA du rapport à `config?.ai_enabled && process.env.GROQ_API_KEY`. C'est le patron de bascule à imiter.
- Le code **dégrade proprement sans clé** partout (`groq-client-v2.ts:26`, `describe-holdings.ts:56`, `email.ts:7` retournent `null` sans planter) : vider les clés est donc une option sûre et déjà testée par construction.

### 6.3 Le flux cours cibles en particulier

Bonne nouvelle : `PretAColler` **ne passe pas** par `parse-portfolio` — il parse localement avec `croesus-parser.ts`. Et le pipeline `enrichReportData` ne fait sortir que des symboles (logos, secteurs, dividendes, traduction du résumé Yahoo). Le nom du client et les montants s'arrêtent au serveur Next.

Mauvaise nouvelle : les deux `useEffect` automatiques (§6.2, ligne 3) sont **invisibles à l'usage**. Qui testerait « est-ce que ça sort ? » en regardant l'écran conclurait que non.

### 6.4 Deux surprises à ne pas manquer

- **`/api/portfolio/analyze` est publique et non authentifiée** : elle figure dans `publicPaths` (`middleware.ts:7`) et ne vérifie aucune session (`route.ts:158`), tout en appelant Groq, Yahoo et EODHD avec les clés du projet. « Cassée » ne veut pas dire « fermée ».
- **`src/lib/ai/groq-client.ts` (V1) est du code mort** : `generateReportAIContent` n'a aucun appelant. Corriger ce fichier en croyant sécuriser le rapport ne changerait rien.

### 6.5 Formulation honnête pour un régulateur

Un portefeuille de 42 titres, avec sa valeur exacte, son type de compte et les objectifs écrits du client, reste une donnée personnelle identifiable par recoupement, même sans le patronyme. **C'est un dossier pseudonymisé, pas anonymisé.** Et tant que Supabase héberge les noms, courriels et téléphones en clair, dire « aucune donnée client ne sort » resterait faux même en coupant Groq à 100 %.

---

## 7. Outillage, conventions et gardes du projet

### 7.1 Tests

Vitest 4.1.10, une seule configuration (`vitest.config.ts`, 14 lignes) : environnement `node`, alias `@` répliqué, `include: ["src/**/*.test.ts", "scripts/**/*.test.{ts,mjs}"]`. **Aucun fichier de setup, aucun mock global, aucun jsdom, aucune mesure de couverture.** Scripts : `npm test` (`vitest run`) et `npm run test:watch`.

**15 fichiers de test, 205 cas, 53 blocs `describe`.** Les plus gros : `src/lib/film/__tests__/build-film-data.test.ts` (59 cas), `src/lib/portfolio/__tests__/deployment.test.ts` (45 cas), `src/lib/film/__tests__/build-sections.test.ts` (28 cas).

Conventions : dossier `__tests__/` frère du module ; fixtures dans `__tests__/fixtures/` (« fonds FICTIFS mais réalistes, aux chiffres ronds pour la validation à la main ») ; import explicite de `{ describe, it, expect }` ; **libellés en français**, avec le calcul en commentaire au-dessus de l'assertion ; aucun `vi.mock`, aucun `it.skip`. Les fixtures de collage Croesus ne contiennent **aucun nom de client**.

**Conséquence directe** : aucun test de composant React n'est possible aujourd'hui. Toute logique de calcul (fiscal, archivage, grand livre) doit vivre dans un `.ts` pur pour être testable ; le `.tsx` de rendu restera non couvert, comme les gabarits actuels.

### 7.2 Les deux gardes maison

**`npm run check:literals`** → `node tools/check-literals.js` sur `src/lib/film/cover-css.ts` et `client-script.ts`. Il vérifie qu'un littéral de gabarit exporté ne contient ni accent grave résiduel, ni `${`, ni **barre oblique inverse isolée**. Le bug d'origine est raconté en tête de fichier : `\s` n'étant pas une séquence d'échappement, JavaScript la réduisait à `s`, ce qui effaçait toutes les lettres « s » d'un base64 de neuf mille caractères. **Règle : dans ces littéraux, toute barre oblique inverse doit être doublée.** La forme du module est contrainte — `export const x =` suivi d'un accent grave, du contenu, puis d'un accent grave et de `.trim();` — sinon le garde échoue avec « littéral non trouvé ».

**`npm run check:glyphes`** → `node tools/check-glyphes.mjs [cible]`. Il appelle **python + fontTools** pour extraire le `cmap` des quatre woff2 de `public/fonts/web/`, puis vérifie que chaque caractère non ASCII du HTML produit existe dans au moins une famille. Règles connues : **ne jamais employer `≈` (U+2248) ni `✓` (U+2713)** ; les flèches `→ ← ↑ ↓` n'existent que dans Montserrat (`src/lib/film/render-html.ts:20`).

**Limites de ces gardes** : `check:glyphes` ne sait lire que du HTML et sa cible par défaut est `C:/tmp/rapport-vivant.html`, hors du dépôt ; il exige python et fontTools, non déclarés dans `package.json`. **Aucun des deux ne regarde le PDF** — `PLAN-GRAND-LIVRE.md:345` le dit explicitement. Une nouvelle section PDF ne sera donc protégée par rien.

### 7.3 Rien ne s'exécute tout seul

`.git/hooks/` ne contient que les 14 exemples livrés par git. Pas de `.husky/`, pas de `lint-staged`, **pas de `.github/` donc pas d'intégration continue**. `npm test`, `npm run lint`, `check:literals` et `check:glyphes` sont **100 % manuels**. Si le plan veut qu'ils tournent, il doit les nommer dans les critères d'acceptation de chaque lot.

### 7.4 Conventions de code

- **Nommage bilingue par génération.** Le code récent est **entièrement en français**, jusqu'aux noms de fonctions et de champs : `src/lib/moteur/` (`executerDiagnostic`, `analyserFrais`, `borner`, `arrondir`), `src/lib/securite/`, `src/lib/contre-proposition/`, `src/lib/film/`, `src/lib/courriel/`, `src/config/`, `src/supabase/requetes/`. Le code hérité est en anglais : `src/lib/portfolio/`, `src/lib/pdf/`, `src/lib/parsers/`, `src/lib/analytics/`. **Un domaine neuf suit le français.**
- **Pureté.** `src/lib/moteur/index.ts` énonce le contrat : « Cœur du diagnostic — 100 % pur : positions + catalogue → Diagnostic. Aucune I/O, aucun accès réseau/DB. » Modèle minimal : `src/lib/moteur/communs.ts` (22 lignes, zéro import). Modèle « pur mais gros » : `src/lib/portfolio/deployment.ts`.
- **Seuils centralisés.** `src/config/seuils.ts` : « TOUS les seuils du moteur, au même endroit : la source unique de vérité. Aucune valeur magique ne doit vivre en dur dans un axe. » `src/config/constantes.ts` porte les URL et limites, jamais un seuil de calcul.
- **Échec explicite.** `src/lib/moteur/frais.ts:48` : « Aucune donnée de frais : échec EXPLICITE, jamais un score silencieux » (`disponible: false` + constat rédigé).
- **Frontière serveur.** `import 'server-only'` en première ligne dans 10 fichiers (`fmp/client.ts`, `pdf/fetch-sectors.ts`, `supabase/requetes/diagnostics.ts`…).
- **Imports** : 776 via l'alias `@/` contre 369 relatifs. `@/` pour traverser les domaines, relatif entre frères.
- **Style** : aucun Prettier, aucun `.editorconfig`. Guillemets doubles dans `moteur`/`securite`/`config`, simples dans `portfolio`/`film`/`pdf`. **Ne reformater aucun fichier existant.** `package.json` n'a pas `"type": "module"` : un outil `.js` est CommonJS, un `.mjs` est ESM.
- **Commentaires** : toujours en français, style « documentaire du pourquoi », avec le récit des bugs déjà vécus.

### 7.5 `.gitignore` et l'état de l'arbre

Le précédent exact pour les données sensibles existe déjà (`.gitignore:48-50`) :

> `# Donnees clients — historique de transactions Croesus (noms en clair). NE JAMAIS VERSIONNER.` puis `EXECEL A PLANIF/`

Trois choses à savoir avant de toucher au dépôt :

1. **`output/` n'est PAS ignoré** et contient déjà des PDF de validation. Un `git add .` les commiterait.
2. **`scripts/` est ignoré** (`.gitignore:44`), donc les 7 cas de test de `scripts/__tests__/` ne sont dans aucun clone frais — alors que `vitest.config.ts` les inclut. Contradiction vivante : ne rien mettre d'important dans `scripts/`.
3. **`tools/` n'est ni ignoré ni suivi** (non suivi dans git) : les deux gardes n'existent que sur ce disque, tout comme `public/fonts/web/`. Et **l'arbre de travail est très sale** : environ 65 entrées dans `git status`, dont des dossiers entiers non commités qui contiennent justement le code exemplaire (`src/lib/moteur/`, `src/lib/film/`, `src/lib/securite/`, `src/config/`, `src/types/`, `tools/`).

Convention de message de commit observée : « Domaine : phrase en français ».

---

## 8. Interface et navigation

### 8.1 Structure des routes

Trois layouts seulement, 54 pages, environ 190 gestionnaires d'API. **Aucun `loading.tsx`, `error.tsx`, `template.tsx` ni `not-found.tsx` nulle part.**

1. `src/app/layout.tsx` — racine, enveloppe tout dans `<SessionProvider><ToastProvider>` (`:19`).
2. Groupe `(auth)` — pas de layout propre : `/login`, `/change-password`.
3. Groupe `(dashboard)` — `src/app/(dashboard)/layout.tsx:10` monte `VaultProvider > Sidebar + Header + main(Breadcrumbs + children)`. 44 pages.
4. Segments publics hors groupe : `src/app/analyse/` a **son propre layout et sa propre feuille de style** (`analyse/layout.tsx:4`) — c'est le précédent exact d'un écran qui vit hors du châssis ; `/tournoi/[id]`.

### 8.2 La barre latérale

`src/components/layout/Sidebar.tsx` : un tableau constant au niveau module, `const navItems` (`:26-42`), 15 entrées `{ href, label, icon }`, rendu par `.map()` (`:76-95`) **sans aucune condition**. Pas de filtre par rôle, pas de drapeau, pas de lecture d'environnement.

Preuve par l'absurde : l'entrée « Administration » (`:41`) est affichée à **tous** les utilisateurs ; c'est `middleware.ts:36-38` qui redirige après le clic. Le dépôt a donc déjà accepté qu'une entrée visible mène à une redirection. Le filtrage par rôle existe, mais **dans les pages** (`events/page.tsx:548` : `session?.user?.role === 'admin'`).

Coût d'ajout d'une entrée : deux lignes (un import d'icône, un objet).

**Piège** : le fil d'Ariane est un **second dictionnaire indépendant**, `src/components/layout/Breadcrumbs.tsx:7-26`, non synchronisé avec la barre latérale. Neuf segments existants n'y figurent pas et s'affichent en slug brut (`:36`). **Tout nouvel écran doit être déclaré aux deux endroits.**

### 8.3 Le parcours « Cours cibles », étape par étape

| Étape | Où | Ce qui se passe |
|---|---|---|
| 0. Hub | `src/app/(dashboard)/reports/page.tsx:23` | `activeTab` à `null` → deux grosses cartes. **Aucun changement d'URL** : pas de query, pas de sous-route |
| | `:189-196` | « Prospect » exige le coffre (`<VaultGate>`) ; **« Prêt à coller » est monté nu**, avec le commentaire « la génération locale du PDF reste accessible sans mot de passe » |
| 1. Coller | `PretAColler.tsx:229-370` | trois cartes pédagogiques, champ « Nom du client (apparaîtra sur le PDF) » (`:283`), zone de dépôt, bouton « Analyser les positions » (`:354`) |
| 2. Parser | `:3626-3629` | `parseCroesusData(text)` → bascule vers `ResultsView` dès une position |
| 3. Résultats | `ResultsView` (`:475`, ~3 100 lignes) | tableau, corrections manuelles, « Charger les cours cibles » (`:2878`) → Yahoo, IA, fiches de fonds, historique du Journal |
| 4. **Composeur PDF** | « Préparer le rapport PDF » (`:3575`) → panneau « Composez votre rapport » (`:2913`) | **c'est ici que se greffe une nouvelle section** |
| 5. Générer | « Générer le PDF » (`:3527`) → `handleDownloadPdf` (`:1487-1563`) | POST → blob → `<a download>` → `toast('success', 'PDF téléchargé')` (`:1516`) → puis, en silence, envoi au Journal si le coffre est déverrouillé (`:1538-1554`) |

L'état du composeur est un objet unique (`PretAColler.tsx:515-525`) : `includeCover`, `includeYearActivity`, `includeDeployment`, `includeEquities`, `includeFixedIncome`, `includeDescriptions`, `includeIncomeDetail`, `fundCodesToInclude`, `orientation`. Chaque section est une carte-bouton qui bascule un booléen (ex. `:2921`). Le panneau contient aussi l'interrupteur « enregistrer au Journal » (`:3402-3418`), le champ nom requis seulement dans ce cas (`:3422-3435`), une note de conviction et un compteur « ~N pages estimées » (`:3499-3503`) — **compteur à mettre à jour si une section s'ajoute**.

Parcours secondaire : `/reports/new` n'est **pas** accessible depuis le hub ; on y arrive depuis `clients/[id]/page.tsx:90` et `portfolios/[id]/page.tsx:124`.

### 8.4 Style

Tailwind v4 via PostCSS, **sans fichier `tailwind.config.*`**, **aucun CSS module** dans le dépôt. Les jetons vivent dans `src/app/globals.css` : bloc `:root` (`:4-35`) avec `--brand-primary:#00b4d8`, `--brand-dark:#03045e`, `--sidebar-width:260px`, `--header-height:64px` ; bloc `@theme inline` (`:37-52`) qui les expose en utilitaires (`bg-brand-dark`, `text-text-muted`…).

Troisième couche, **non tokenisée** : une palette « Duolingo » redéclarée en dur dans 14 fichiers (`const DUO = { green:'#58CC02', blue:'#1CB0F6', … }`, ex. `reports/page.tsx:13-18`), appliquée en styles en ligne avec bordures 3D. C'est le langage visuel réel des écrans récents : **tout nouvel écran greffé dans `/reports` devra le recopier à la main.**

Composants réutilisables : `src/components/ui/` (Button, Card, Input, Badge, Modal, Table, Tabs, DataTable…) et `src/components/layout/PageHeader.tsx`.

### 8.5 Notification discrète : elle existe déjà

`src/components/ui/Toast.tsx` : contexte React, `useToast()` (`:20`), quatre types, conteneur `fixed bottom-4 right-4 z-50 max-w-sm` (`:54`), effacement automatique après 4 000 ms (`:42-44`). Monté dans le layout **racine** (`src/app/layout.tsx:20`), donc disponible partout. Déjà consommé dans 27 fichiers, et **déjà au bon endroit** dans le flux cours cibles (`PretAColler.tsx:1516`).

Limites : `message` est une chaîne pure (donc **pas de lien cliquable ni de bouton « Ouvrir le dossier »** sans modifier le composant), largeur 384 px en `text-sm` (un chemin Windows long passera sur plusieurs lignes), pas d'`aria-live`, pas de file d'attente.

---

## 9. Ce que ça change au plan

Chaque point ci-dessous est un ajustement à porter au plan des phases 1 à 5, avec sa justification.

1. **Phase 1 — l'archivage se branche côté serveur, pas côté navigateur.** Point d'insertion unique : `src/app/api/exports/price-targets/route.ts`, entre `:41` (`finalPdfBytes` prêt) et `:49` (la réponse). *Justification* : à cet endroit précis on a simultanément les octets complets et `clientName` (`:19`). Toute variante navigateur (File System Access, dossier Téléchargements) est plus complexe pour un résultat inférieur.

2. **Phase 1 — écrire un helper unique, pas neuf greffes.** Un module du type `src/lib/archive/…` marqué `import 'server-only'`, appelé depuis les routes. *Justification* : neuf routes produisent des PDF, mais **seules trois portent un nom de client exploitable** (`exports/price-targets:19`, `proposition/pdf` (`body.client`), `reports/generate:44-49`). Décider explicitement si l'archivage est universel ou limité à ces trois.

3. **Phase 1 — le classement par nom de client contredit une décision de confidentialité écrite.** Deux commentaires disent l'inverse du chantier : `api/exports/price-targets/route.ts:44-46` et `PretAColler.tsx:1507-1510` (« le nom du client ne doit pas se retrouver en clair dans le dossier Téléchargements, souvent synchronisé OneDrive »). *Justification* : ce n'est pas un oubli, c'est un choix documenté. Il doit être **révoqué consciemment et les commentaires réécrits**, sinon un futur relecteur le « corrigera » en sens inverse. Noter aussi que la Proposition applique déjà la politique opposée (`proposition/page.tsx:344`).

4. **Phase 1 — le répertoire d'archivage doit être configurable et pointer hors de OneDrive par défaut.** *Justification* : le dépôt lui-même vit sous `OneDrive - IA Private Wealth`. Toute archive écrite sous `process.cwd()` serait synchronisée vers le nuage corporatif — l'exact opposé de « local uniquement ». Le code connaît déjà ce piège (`price-targets-template.tsx:29` : « avoid path issues with spaces/OneDrive »).

5. **Phase 1 — ne pas faire dépendre l'archivage du coffre.** *Justification* : le flux principal est monté **sans** `VaultGate` (`reports/page.tsx:195`). Au moment de générer, le coffre peut être verrouillé : pas de `name_idx`, pas de pseudonyme. Un archivage qui en dépendrait raterait silencieusement une partie des PDF. Si un dossier non nominatif est souhaité, prévoir `normalizeName()` (`clientVault.ts:64-71`, pure et sans crypto) côté serveur — et **pas `name_idx` tel quel**, qui est en base64 standard et contient `/`.

6. **Phase 1 — prévoir la divergence archive / Journal.** *Justification* : le Journal fait *delete-then-insert* par jour (`api/price-target-snapshots/route.ts:149-157`). Régénérer un PDF deux fois le même jour donnerait deux archives disque mais une seule capture. Décider laquelle des deux fait foi.

7. **La garde « local seulement » est un préalable commun aux phases 1, 2 et 4 — et elle n'existe pas.** Zéro occurrence de `NODE_ENV`/`VERCEL` dans les 456 fichiers de `src/`. *Justification* : trois cartographies convergent, la brique est à créer de zéro. Elle doit être un helper unique et unique-source, pas un test dispersé. Et le mécanisme doit être tranché : `NODE_ENV` (prescrit par `PLAN-GRAND-LIVRE.md:192`) casse dès que Nicolas teste un build de production en local ; l'absence de `process.env.VERCEL` ou une variable d'adhésion explicite est plus robuste. **Voir §10, question 1.**

8. **Toutes phases — toute nouvelle route `/api` sera interceptée par le middleware.** *Justification* : le matcher (`middleware.ts:44`) attrape tout, et l'absence de session donne une **redirection 302 vers `/login`, pas un 401 JSON** : un `fetch` qui attend du JSON recevra du HTML. Deux règles absolues à ajouter au plan : **jamais de point dans un chemin de route** (`middleware.ts:18` contourne l'authentification pour tout chemin en contenant un) et **ne jamais ajouter de préfixe court à `publicPaths`** (`:13` compare par préfixe brut ; `/api/portfolio` rend déjà `/api/portfolio-history` public et non authentifié).

9. **Phase 2 — le vocabulaire fiscal existe déjà, ne pas en créer un deuxième.** `Fiscalite` (`'abri' | 'reporte' | 'imposable' | 'inconnu'`) et `FISCALITE_PAR_CODE` dans `src/lib/film/build-sections.ts:33` et `:62-72`, dérivés des codes de compte Croesus. *Justification* : deux tables divergentes sur la même donnée est le scénario de bug classique.

10. **Phase 2 — la clé de jointure d'un profil fiscal est le problème central, et il n'est pas résolu.** *Justification* : le flux qui produit les PDF de rencontre ne connaît aucun `client_id` ; `price_target_snapshots` n'en a pas non plus. Deux options seulement : indexer sur `normalizeName(clientName)`, ou ajouter un sélecteur de client (comme la liste de `proposition/page.tsx:172-179`) qui, cette fois, **retienne l'UUID**. Attention : `normalizeName` écrase accents et casse, donc **deux clients homonymes partageront le même dossier et le même profil** — aucun garde-fou n'existe.

11. **Phase 2 — si les profils restent strictement locaux, ils ne peuvent pas passer par Supabase, même chiffrés.** *Justification* : la cible est donc un fichier sur disque, ce qui suppose `fs`, donc une route Node gardée — la même garde qu'au point 7. Et le patron de chiffrement existant ne chiffre que l'identité en laissant `quantity`/`average_cost` en clair (`price-target-snapshots/route.ts:122-123`) : pour un profil fiscal, il faudra chiffrer le bloc entier.

12. **Phase 3 — ce n'est pas un chantier vierge, c'est un portage.** `EXECEL A PLANIF/moteur-book/moteur-livre.cjs` (140 Ko) est un moteur v2 déjà validé, avec typologie, dédoublonnage multi-ensemble et registre de prix. *Justification* : c'est exactement le lot 0 de `PLAN-GRAND-LIVRE.md:305`. Ne pas réécrire ; ne surtout pas réinventer la clé de dédoublonnage `compte|date|type|symbole|total|quantité|solde` avec comptage d'occurrences (`:119-124`), qui a été payée par 3 892 collisions mesurées.

13. **Phase 3 — poser une garde d'arité AVANT d'écrire une ligne.** *Justification* : l'application lit 18 colonnes en dur sans contrôle de longueur (`year-activity.ts:333-374`), les fichiers réels en ont 20. Rejouer le parseur applicatif sur un fichier du book décalerait tous les index **en silence**. Exiger les en-têtes ou tester `cells.length` est un préalable, pas une amélioration.

14. **Phase 3 — trois ordres de colonnes concurrents coexistent.** `year-activity.ts` (No de compte en dernier), `transactions-du-jour/page.tsx:33-52` (No de compte en **premier**), et le book (`Ind. VM` + `Description` en tête). *Justification* : toute normalisation qui suppose « le » format Croesus se trompera sur au moins deux des trois.

15. **Phase 3 — capter le texte brut au point d'entrée, pas le reconstituer.** *Justification* : `rawRow` existe sur chaque position (`croesus-parser.ts:931`) mais est jeté à la construction du payload PDF. Le collage complet est disponible en `PretAColler.tsx:3626` (positions) et `:1228` (transactions). Prévoir aussi un identifiant de collage (date, empreinte du texte) distinct de la clé de transaction : l'`id` actuel contient l'index de ligne (`year-activity.ts:310`) et n'est pas reproductible.

16. **Phase 3 — fixer l'encodage.** Le book est en latin1 (`moteur-livre.cjs:107`), un collage navigateur est en Unicode. *Justification* : sans conversion à la lecture, les accents des descriptions divergeront entre deux sources de la même transaction.

17. **Phase 3 — réutiliser `canonKey` réintroduirait un défaut déjà payé.** `deployment.ts:235` supprime le suffixe `.NE` et écrase un CDR sur son sous-jacent ; `compare-meetings.ts:153` indexe sur le seul symbole. *Justification* : la clé d'une position est **symbole ET devise** (5e piège, `PLAN-GRAND-LIVRE.md:357`).

18. **Phase 4 — l'insertion est simple et bien balisée, mais le drapeau ne doit pas venir du client.** Trois points de touche (§2.4). *Justification* : le `<Document>` étant évalué dans la route serveur, **la route peut forcer le drapeau elle-même** selon la détection locale. C'est plus robuste (personne ne peut réclamer la section depuis Vercel) et cela évite de modifier `PretAColler.tsx`.

19. **Phase 4 — choisir `=== true` plutôt que la convention `!== false`.** *Justification* : la convention en vigueur (`price-targets-template.tsx:2096`) rend active par défaut toute section absente des options. Pour une section locale et sensible, l'inverse s'impose : **inactive sauf demande explicite**.

20. **Phase 4 — la section fiscale se placera forcément AVANT les fiches de fonds.** *Justification* : pdf-lib n'agrafe qu'en queue (`merge-fund-pdfs.ts:70`). Si elle doit clore le document, il faut la faire porter par pdf-lib — deux mécaniques à ne pas mélanger.

21. **Phase 4 — décider du sort du « Rapport vivant » HTML dans le même lot.** *Justification* : `enrich-report-data.ts:10-13` a été écrit précisément pour empêcher que les deux formats « racontent deux histoires différentes ». Ajouter une section au seul PDF crée exactement cette divergence.

22. **Phase 4 — préférer l'import dynamique si la section vit dans un module séparé.** *Justification* : `price-targets-template.tsx` exécute `fs.readFileSync` **au chargement du module** (`:30-36`). Toute branche qui l'importe, même sans l'utiliser, paie ces lectures et échoue si un fichier manque.

23. **Phase 4 — la section n'est protégée par aucun garde existant.** *Justification* : `check:glyphes` ne lit que du HTML et `check:literals` ne surveille que deux fichiers ; `PLAN-GRAND-LIVRE.md:345` le note déjà. Prévoir une vérification de glyphes adaptée si le texte fiscal utilise `‰`, `≤`, `≥`, `×` — et **ne jamais employer `≈` ni `✓`**.

24. **Phase 5 — le `.bat` doit positionner le répertoire courant sur la racine du dépôt.** *Justification* : les polices et logos sont résolus via `process.cwd()` **au chargement du module** (`price-targets-template.tsx:27`, `:31-36`). Un répertoire courant erroné fait échouer l'import lui-même, avant la première requête, avec une erreur obscure. `demarrer-localhost.bat` le fait déjà (`cd /d "%~dp0"`) : ne pas régresser.

25. **Phase 5 — le mode bureau ne coupe rien du tout.** *Justification* : `GROQ_API_KEY` et `GEMINI_API_KEY` sont renseignées dans `.env.local` ; tous les appels IA partent exactement comme sur Vercel. Si l'intention est « rien ne sort », il faut soit vider ces clés dans un `.env` dédié au lanceur, soit ajouter un interrupteur d'egress global. Le code dégrade proprement sans clé partout.

26. **Nouveau point à ajouter au plan — couper les deux appels IA automatiques du flux cours cibles.** `PretAColler.tsx:628` et `:670` partent au montage, sans bouton ni réglage, et envoient la liste des titres du client à Groq. *Justification* : tant qu'ils sont là, chaque collage archivé s'accompagne d'un envoi vers un tiers. C'est le point le plus directement contraire à la règle 6, et il est invisible à l'usage.

27. **Nouveau point à ajouter au plan — un interrupteur d'egress unique plutôt que treize gardes.** *Justification* : il existe 13 sites d'appel Groq et aucune couche commune (`groq-client.ts` et `groq-client-v2.ts` instancient chacun leur SDK, et trois routes font du `fetch` direct). Le patron de bascule existe déjà : `reports/generate/route.ts:490`.

28. **Toutes phases — `.gitignore` dans le même lot que le code, jamais après.** *Justification* : il n'existe **aucun** crochet git, aucune intégration continue, aucun analyseur de secrets. La seule défense est un `.gitignore` écrit à la main, et `output/` n'y est pas alors qu'il contient déjà des PDF. Suivre le style de `.gitignore:48-50`.

29. **Toutes phases — ne rien mettre dans `scripts/`.** *Justification* : le dossier est ignoré par git (`.gitignore:44`) ; tout outillage d'archivage ou d'import qui y vivrait disparaîtrait avec la machine, sans être relu ni sauvegardé. `tools/` est le bon endroit — mais il faut d'abord **le faire suivre par git**, il ne l'est pas aujourd'hui.

30. **Toutes phases — documenter chaque nouvelle variable aux deux endroits.** `.env.example` **et** `README.md:501-522`. *Justification* : les deux sources divergent déjà, et quatre variables utilisées par le code ne sont documentées nulle part.

31. **Interface — déclarer tout nouvel écran dans deux dictionnaires.** `Sidebar.tsx:26-42` **et** `Breadcrumbs.tsx:7-26`. *Justification* : ils ne sont pas synchronisés, et un segment non déclaré s'affiche en slug brut. Si l'écran ne doit apparaître qu'en local, prévoir la condition dans la barre latérale : **aucun mécanisme de masquage n'existe** aujourd'hui, le rendu est un `.map()` sans condition.

32. **Interface — mettre à jour le compteur de pages et copier la palette à la main.** *Justification* : `PretAColler.tsx:3499-3503` additionne les sections cochées et deviendrait faux ; et la palette « Duolingo » est redéclarée en dur dans chaque écran, sans jeton central.

33. **Tests — extraire toute logique de calcul dans un `.ts` pur.** *Justification* : l'environnement Vitest est `node` seul, sans jsdom ni bibliothèque de test React. Un composant `.tsx` n'est pas testable dans ce dépôt. Le modèle à imiter est `src/lib/moteur/` : entrée injectée, sortie déterministe, fixtures fictives aux chiffres ronds.

34. **Nommage — le domaine fiscal est neuf, donc il s'écrit en français.** *Justification* : convention observée sur tout le code récent (`moteur`, `securite`, `contre-proposition`, `courriel`, `config`). Les seuils fiscaux vont dans `src/config/`, à côté de `seuils.ts`, avec justification par borne — jamais en dur dans un module de calcul.

---

## 10. Questions ouvertes pour Nicolas

1. **Quel signal doit décider que « je tourne en local » ?** Le plan du grand livre dit `NODE_ENV !== 'production'` ; deux cartographies démontrent que cela casse dès qu'on teste un build de production sur le poste. L'alternative est l'absence de `process.env.VERCEL`, ou une variable d'adhésion explicite dans `.env.local`. C'est un choix à faire une seule fois : il conditionne les phases 1, 2 et 4.

2. **Les dossiers d'archives portent-ils le nom du client en clair, oui ou non ?** Deux commentaires du code l'interdisent explicitement, la Proposition fait déjà l'inverse. Si oui, ces commentaires doivent être réécrits dans le même lot. Si non, il faut un pseudonyme calculable côté serveur — `normalizeName()` convient, `name_idx` non (base64 avec `/`).

3. **Où exactement, sur le disque ?** Le dépôt vit sous OneDrive d'entreprise : écrire les archives sous la racine du projet les synchroniserait vers le nuage corporatif. Quel chemin, hors OneDrive, et qui le configure ?

4. **L'archivage est-il universel ou limité aux cours cibles ?** Neuf routes produisent des PDF, trois seulement portent un nom de client. Et deux d'entre elles (`api/portfolio/pdf`, `api/models/[id]/simulation/export`) n'ont **aucune vérification de session** : y brancher une écriture disque créerait une écriture de fichier déclenchable à distance.

5. **Sur quoi s'indexe un profil fiscal ?** Sur le nom normalisé (simple, mais deux homonymes partagent le même dossier), ou sur l'UUID d'un client Supabase (propre, mais il faut ajouter un sélecteur au flux « Prêt à coller », qui aujourd'hui ignore la base) ?

6. **Coupe-t-on les appels IA automatiques du flux cours cibles ?** `classify-holdings` et `extract-maturities` partent seuls à chaque collage et envoient la liste des titres du client. Les couper dégrade la classification automatique des titres et l'extraction des échéances d'obligations : est-ce acceptable, et si oui remplace-t-on par un bouton explicite ?

7. **La règle 6 s'applique-t-elle au rapport complet et à la prospection, ou seulement au nouveau chantier ?** Aujourd'hui, la valeur du portefeuille et les objectifs en texte libre partent chez Groq, et des noms de prospects avec leurs notes d'appel partent chez Google. Nettoyer ces flux est un chantier distinct, à cadrer.

8. **Que fait-on du « Rapport vivant » HTML ?** Il partage le même pipeline de données que le PDF, précisément pour que les deux racontent la même histoire. La section fiscale doit-elle y figurer aussi ?

9. **Quand commite-t-on l'arbre de travail ?** Environ 65 entrées en attente, dont des dossiers entiers non suivis (`src/lib/moteur/`, `src/config/`, `tools/`) et un `output/` non ignoré contenant des PDF. Démarrer un chantier d'archivage sur cet arbre, c'est prendre le risque d'un `git add .` qui emporte tout.

10. **Trou de sécurité existant, hors chantier mais à arbitrer :** `src/app/api/portfolio-history/route.ts` n'a aucune vérification d'authentification et est rendu public par la fuite de préfixe du middleware ; `/api/portfolio/analyze` est publique, non authentifiée, et appelle Groq, Yahoo et EODHD avec les clés du projet. On corrige maintenant ou on ouvre un lot distinct ?
