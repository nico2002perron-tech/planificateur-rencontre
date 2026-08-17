# Ce qui quitte le poste — inventaire des sorties réseau

Mis à jour le **7 août 2026**. À relire avant tout ajout d'appel sortant.

> **Ce document devait tenir en une ligne après le retrait de Groq.** Il n'y tient
> pas : Groq n'était pas dans trois fichiers mais dans **quinze**. Le retrait
> demandé — la route `parse-portfolio` et ses deux appelants — est fait, et il
> supprimait la pire sortie. Les autres restent, et la liste ci-dessous est là
> pour qu'on décide de chacune en connaissance de cause plutôt que de croire le
> problème réglé.

---

## 1. Le volet fiscal — une seule sortie, sur les dossiers FICTIFS

> **Corrigé le 17 août 2026.** Cette section affirmait « AUCUNE sortie » et
> décrivait `reformuler()` comme débranchée, « aucun appelant n'en fournit ».
> C'était vrai le 7 août et **faux depuis le 11** : la route `rapport-fiscal`
> branche l'IA d'essai. Le document a même été retouché après le branchement
> sans que cette ligne soit corrigée. L'inventaire de gouvernance décrivait donc
> un système qui n'existait plus — exactement ce que la règle de la section 4
> existe pour empêcher.

| Module | État |
|---|---|
| `src/lib/profils/*` (moteur, stratégies, démarches) | TypeScript pur, aucun accès réseau |
| `src/lib/profils/reformuler.ts` | **branchée par un seul appelant**, sous trois conditions cumulatives (voir ci-dessous). Sans `appelLLM`, elle rend toujours le texte source — le repli reste le gabarit déterministe. |
| `POST /api/base-locale/rapport-fiscal` → Groq (11 août 2026) | **Ce qui part** : pour chaque constat chiffré, sa référence (montants, libellés de catalogue, plan, échéance) et son `texteSource`, **après masquage par jetons** — symboles de positions → `<<TITRE_n>>`, prénoms d'enfants → `<<ENFANT_n>>`. **Jamais** le nom du client, jamais un numéro de compte. **Trois verrous** : `estLocal()`, `profil.fictif === true` (marqueur manuel), et `GROQ_API_KEY` présente. **Vérification aval** : toute réponse où un identifiant réel réapparaît, ou qui porte un nombre non autorisé, est rejetée et remplacée par le gabarit. |

**Levée du verrou « fictifs seulement »** : une seule condition à retirer dans
`iaEssaiPermise()` (`appel-llm-essai.ts`) — à ne faire que sur feu de la
conformité iA.
| `src/app/api/base-locale/*` | lecture/écriture disque local, 404 hors localhost |
| `POST /api/exports/price-targets`, champ `collages` (12 août 2026) | les textes BRUTS collés dans les cours cibles (relevé de positions, transactions — numéros de comptes inclus) voyagent navigateur → serveur pour nourrir la base locale. **Double barrière** : le navigateur ne joint le champ qu'en localhost (`estLocalNavigateur`), et le serveur ne l'écrit qu'en local (`estLocal()` dans `nourrirBaseLocale`). Depuis Vercel : champ absent ET no-op. Rien ne quitte le poste. |

La charge est protégée par deux barrières : `referencePour()` ne construit que
sept champs de chiffres et de libellés de catalogue, et `masquerIdentifiants()`
remplace les symboles de positions et les **prénoms d'enfants** par des jetons
avant l'envoi. La vérification aval refuse toute sortie où un identifiant réel
réapparaît.

> **Défaut corrigé le 7 août 2026.** La référence était propre, mais la charge
> transporte aussi `texteSource` — l'explication du constat — et celle-là n'avait
> jamais été auditée. Elle contenait des symboles de positions et, dans la
> stratégie REEE, **les prénoms des enfants**. Le module se documentait comme
> « pseudonymisé par construction » : c'était vrai de la référence, faux du
> texte. Une garantie à moitié vraie est pire qu'aucune.

---

## 2. Retiré le 7 août 2026

| Ce qui partait | Vers | Décision |
|---|---|---|
| `POST /api/ai/parse-portfolio` — **le texte brut collé** (100 premières lignes : positions, quantités, valeurs marchandes, suffixes de comptes) et, en mode vision, **une image du relevé** | Groq | **route supprimée** |
| `ImportModal` — repli automatique au premier format non reconnu, sans bouton ni réglage | Groq | appel retiré, message de repli manuel |
| `ProspectReport` — même repli | Groq | appel retiré, message de repli manuel |

Le parseur déterministe reste : il lit les exports Croesus, qui sont le format
réel. Pour tout autre format, la saisie à la main — plus lente, et qui ne fait
sortir aucune donnée.

---

## 3. Ce qui sort ENCORE, et ce que ça transporte

### 3a. Identité de client — PLUS AUCUNE (fermé le 11 août 2026)

`models/email` mettait `DESTINATAIRE: <nom>` dans son prompt — la dernière
sortie de l'application portant une identité. Le modèle écrit désormais le
repère `[DESTINATAIRE]` et la substitution du vrai nom se fait en local, après
génération. **Aucune route ne transmet plus de nom de client.**

### 3b. Composition de portefeuille, sans identité

| Route | Ce qui part |
|---|---|
| `POST /api/portfolio/analyze` | symboles, noms de titres, positions |
| `POST /api/transition/analyze` | symboles, valeurs marchandes |
| `POST /api/reports/generate` | symboles, quantités, valeurs — **le nom du client est délibérément remplacé par un libellé neutre** (`prompts-v2.ts:135`) |

Le nom ne part pas, mais une composition de portefeuille reste une donnée
dérivée d'un dossier client.

### 3b-bis. Identité d'un PROSPECT — uniquement sur son consentement (13 août 2026)

| Route | Ce qui part | Vers |
|---|---|---|
| `POST /api/transmission` → notification interne | prénom, nom, courriel, téléphone du prospect, sa tranche de valeur, **ses positions saisies** (codes + montants) et **les constats de son analyse** | Resend (fournisseur d'envoi), pour livrer le courriel à l'adresse interne |

C'est la seule sortie de l'application qui porte une identité — et elle est d'une
autre nature que les précédentes : **le prospect l'a demandée**. Il coche une case
de consentement dont la version est enregistrée pour l'audit ; sans elle, le
serveur refuse (`z.literal(true)`). L'objet même de l'envoi est de permettre à un
conseiller de le rappeler.

Ce qui encadre cette sortie :
- **Rien ne part avant le consentement.** Le diagnostic, lui, est enregistré
  anonymement — aucune identité — et ne devient nominatif qu'à la transmission.
- **Un seul courriel par transmission** : l'index unique `(diagnostic_id, courriel)`
  fait qu'un rejeu retombe sur la même ligne et n'envoie rien de plus.
- **L'échec ne se cache pas** : le sort de l'envoi est écrit sur le lead
  (`notification_statut`), et une pastille « Courriel non envoyé » apparaît dans
  « Analyses reçues ». Une transmission consentie n'est jamais perdue parce que
  le courriel a raté.
- **Aucun courriel au prospect** (accusé de réception) tant que la conformité n'a
  pas validé le texte de consentement.
- Destinataire et expéditeur en variables d'environnement
  (`ANALYSE_NOTIF_DESTINATAIRE`, `ANALYSE_NOTIF_EXPEDITEUR`), jamais en dur.

### 3c. Données de marché seulement

`classify-holdings`, `extract-maturities`, `describe-holdings` (symboles et noms
de titres), `fund-reports`, `translate`, `dashboard/news`, `dashboard/briefing`.

### 3d. Fournisseurs de cotation

FMP (logos, prix), Yahoo (secteurs, historiques). Symboles boursiers seulement.

---

## 4. La règle

Avant d'ajouter un appel sortant, écrire ici **ce qu'il transporte**, pas
seulement vers qui il va. « Le LLM est déjà là » n'est pas un argument : une
nouvelle catégorie de données sur un vieux tuyau est un nouvel usage, pas un
usage couvert.
