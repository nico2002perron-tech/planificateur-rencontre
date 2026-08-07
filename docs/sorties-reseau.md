# Ce qui quitte le poste — inventaire des sorties réseau

Mis à jour le **7 août 2026**. À relire avant tout ajout d'appel sortant.

> **Ce document devait tenir en une ligne après le retrait de Groq.** Il n'y tient
> pas : Groq n'était pas dans trois fichiers mais dans **quinze**. Le retrait
> demandé — la route `parse-portfolio` et ses deux appelants — est fait, et il
> supprimait la pire sortie. Les autres restent, et la liste ci-dessous est là
> pour qu'on décide de chacune en connaissance de cause plutôt que de croire le
> problème réglé.

---

## 1. Le volet fiscal — AUCUNE sortie

| Module | État |
|---|---|
| `src/lib/profils/*` (moteur, stratégies, démarches) | TypeScript pur, aucun accès réseau |
| `src/lib/profils/reformuler.ts` | **débranchée** — ne connaît aucun fournisseur, aucune clé, aucune URL. Sans `appelLLM` fourni par l'appelant, elle rend le texte source. Aucun appelant n'en fournit. |
| `src/app/api/base-locale/*` | lecture/écriture disque local, 404 hors localhost |

**Le jour d'un branchement**, la charge est protégée par deux barrières :
`referencePour()` ne construit que sept champs de chiffres et de libellés de
catalogue, et `masquerIdentifiants()` remplace les symboles de positions et les
**prénoms d'enfants** par des jetons avant l'envoi. La vérification aval refuse
toute sortie où un identifiant réel réapparaît.

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

### 3a. Un nom de client part — à décider

| Route | Ce qui part |
|---|---|
| `POST /api/models/email` | `DESTINATAIRE: ${clientName}` **dans le prompt**. Valeur par défaut « Client », mais les appelants peuvent passer un vrai nom. |

C'est la seule sortie qui porte encore une identité de client. Elle n'était pas
dans le périmètre du retrait demandé ; elle mérite une décision explicite.

### 3b. Composition de portefeuille, sans identité

| Route | Ce qui part |
|---|---|
| `POST /api/portfolio/analyze` | symboles, noms de titres, positions |
| `POST /api/transition/analyze` | symboles, valeurs marchandes |
| `POST /api/reports/generate` | symboles, quantités, valeurs — **le nom du client est délibérément remplacé par un libellé neutre** (`prompts-v2.ts:135`) |

Le nom ne part pas, mais une composition de portefeuille reste une donnée
dérivée d'un dossier client.

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
