# Cristallisation de gains — le plan exploratoire (v1)

Produit le 12 août 2026 par une exploration à 8 agents (5 angles fiscaux vérifiés au web,
1 cartographie du code, 1 contre-expertise, 1 critique de complétude).

> ⚠ **TOUT ce document est sous le verrou fiscaliste.** Chaque règle, chaque seuil, chaque
> mécanique doit être validé avant d'alimenter un document remis à un client. Les corrections
> de la contre-expertise sont intégrées en notes « ⚠ contre-expertise ». Les chiffres d'année
> (paliers, seuils PSV/SRG, MPB) sont ceux trouvés en août 2026 et se vérifient au CSV.

**63 cas recensés** — 57 confirmés par la contre-expertise, 6 corrigés, 25 manques identifiés par la critique de complétude (section finale).

---

## Calculables MAINTENANT — les intrants existent déjà (19)

### Garde-fou sur la stratégie 7 existante — pertes reportées ≠ protection du revenu net

**Déclencheur** : La stratégie « cristallisation de gains à impôt nul » est déclenchée chez un client de 64 ans et plus (PSV/SRG en vue ou en cours), ou chez une famille recevant l'ACE/Allocation famille. Détectable MAINTENANT : demographie.age + droits.pertesCapitalReportees + gains latents sont tous au dossier.

**Mécanique** : La stratégie existante absorbe les gains avec (a) les pertes nettes de l'ANNÉE et (b) les pertes REPORTÉES. Les deux sont équivalentes pour l'IMPÔT, mais pas pour le REVENU NET : les pertes de l'année se compensent à la ligne 12700 (le revenu net ne monte pas), les reportées se déduisent à la ligne 25300, après le revenu net (le revenu net monte du plein gain imposable). Chez un prestataire PSV/SRG/ACE, « impôt nul » peut coûter 15 à 75 ¢ par dollar de gain imposable en prestations perdues. Règle à coder : quand la portion absorbée par les REPORTÉES est non nulle ET que le client a 64 ans et plus (ou reçoit des prestations familiales), le constat doit porter un avertissement chiffrant l'exposition du revenu net — ou scinder le montant en « absorbable sans effet revenu net » (pertes de l'année) et « absorbable avec effet revenu net » (reportées).

**Données requises** :
- Âge, pertes reportées, pertes de l'année, gains latents — _deja-au-dossier — demographie.age, droits.pertesCapitalReportees, transactionsAnnee, positions_
- Statut PSV/SRG/prestations familiales (pour passer de l'avertissement au chiffrage) — _fiche-a-etendre_

**Pièges** :
- Sans ce garde-fou, le moteur actuel recommande en toute confiance un geste qui peut coûter des milliers de dollars de SRG à un client modeste — c'est le principal angle mort de la stratégie livrée.
- L'avertissement doit rester factuel : le geste reste souvent bon (remontée de PBR), c'est le CALENDRIER et le fractionnement qui changent.

**À valider par le fiscaliste** :
- La lecture des lignes 12700 / 23600 / 25300 (fédéral) et l'équivalent Québec (ligne 276 vs 299)
- Le seuil d'âge du déclencheur (64 ? 63 pour le SRG ?)

<sub>Sources : https://www.taxtips.ca/seniors/guaranteed-income-supplement.htm · https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html</sub>

_Confiance : haute_

### Transfert au conjoint — règles d'attribution et choix de renoncer au roulement 73(1)

**Déclencheur** : Client marié/conjoint de fait qui veut « donner » des titres en gain au conjoint (fractionnement de revenu, égalisation des patrimoines), ou détection de mouvements entre comptes du client et du conjoint (Compte.titulaire = 'conjoint' / 'conjoint-commun').

**Mécanique** : Deux verrous successifs font qu'un don de titres au conjoint ne transfère PAS l'impôt. Verrou 1 — le roulement : un transfert entre vifs au conjoint se fait automatiquement au PBR (73(1) LIR) → aucun gain cristallisé au transfert, le conjoint hérite du gain latent entier. Verrou 2 — l'attribution : même après le transfert, les gains et pertes en capital réalisés par le conjoint sur le bien (et tout bien substitué) sont réputés ceux de l'AUTEUR du transfert (74.2 LIR), à son taux à lui. Donner ne déplace donc ni l'impôt latent ni l'impôt futur. Pour cristalliser réellement : l'auteur peut CHOISIR de se soustraire au roulement dans sa déclaration de l'année du transfert → la disposition se fait alors à la JVM (art. 69, personnes liées) et le gain se cristallise CHEZ L'AUTEUR — utile précisément quand il a des pertes à absorber (pertes nettes de l'année + reportées : les deux sont déjà au dossier) : le gain sort à impôt nul, le conjoint reçoit un PBR remonté. C'est la stratégie 7 existante avec rachat dans le compte du conjoint au lieu du sien. Mais pour couper AUSSI l'attribution des gains futurs, il faut EN PLUS une contrepartie réelle à la JVM (argent propre du conjoint, ou billet à intérêt au taux prescrit payé chaque année dans les 30 jours suivant la fin d'année) — l'exception 74.5 LIR. Sans contrepartie, même le choix de se soustraire au roulement laisse les gains futurs remonter chez l'auteur.

**Données requises** :
- état civil — _deja-au-dossier — demographie.etatCivil_
- titulaire de chaque compte (pour détecter les transferts inter-conjoints déjà faits) — _deja-au-dossier — Compte.titulaire (souvent null : aucune source automatique, question de rencontre)_
- pertes disponibles de l'auteur (le plafond de la cristallisation à impôt nul) — _deja-au-dossier — transactionsAnnee + droits.pertesCapitalReportees_
- tranche de revenu du conjoint (l'intérêt du fractionnement) — _deja-au-dossier — demographie.conjoint.trancheRevenu_
- taux prescrit courant (pour la variante prêt entre conjoints) — _baremes-csv — à ajouter ; taux trimestriel ARC, non vérifié dans cette exploration_

**Pièges** :
- Le piège inverse à détecter d'office : un client qui a « donné » des titres en gain au conjoint en croyant l'impôt transféré — 74.2 ramènera le gain chez lui à la vente. Le moteur peut lever ce drapeau dès que Compte.titulaire est renseigné.
- Se soustraire au roulement sur un titre en PERTE ne marche pas : perte apparente (le conjoint est une personne affiliée) → perte refusée et ajoutée au PBR du conjoint. Le choix ne se fait que sur des titres en GAIN.
- Le choix de se soustraire à 73(1) est à la discrétion du seul AUTEUR, bien par bien, dans sa déclaration — pas d'accord du conjoint requis pour la cristallisation, mais la contrepartie JVM (pour couper l'attribution) exige, elle, de vrais fonds du conjoint.
- Contrepartie par billet : l'intérêt au taux prescrit doit être PAYÉ (pas couru) au plus tard 30 jours après chaque fin d'année, sinon l'attribution renaît pour toutes les années suivantes.
- L'attribution cesse au décès de l'auteur, à la séparation (pour les gains, sur choix conjoint 74.5(3)b)) et à la perte de résidence — les événements des autres cas de cet angle interagissent ici.
- Le CELI du conjoint reste la voie sans attribution la plus simple (exception déjà exploitée par la stratégie 3 existante) : la comparer avant tout montage.

**À valider par le fiscaliste** :
- La forme exacte du choix de se soustraire à 73(1) (mention à la déclaration, irrévocabilité, pendant québécois)
- La règle de perte apparente appliquée aux rachats croisés entre les comptes des deux conjoints — y compris quand c'est le CONJOINT qui rachète un titre que l'auteur vient de vendre à perte
- Le taux prescrit en vigueur au trimestre courant et la mécanique du prêt entre conjoints

<sub>Sources : https://www.conseiller.ca/ma-pratique/carriere/les-transferts-entre-conjoints-sans-consequences/ · https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/it511r/archivee-transferts-prets-biens-entre-conjoints-certains-autres-cas.html · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-120408.asp · https://levesquecpa.ca/transferts-entre-conjoints/ · http://www.mbba.ca/transferts-entre-personnes-liees</sub>

_Confiance : haute_

### Gonfler le CDC (compte de dividendes en capital) et verser un dividende en capital libre d'impôt

**Déclencheur** : Le client détient une société de gestion (comptes « corpo ») dont les positions portent des gains latents, et veut sortir des liquidités de la société — ou un solde CDC accumulé dort sans jamais avoir été versé. C'est LA raison proprement corporative de cristalliser : chaque gain réalisé transforme sa moitié non imposable en argent sortable sans impôt personnel.

**Mécanique** : Taux d'inclusion des gains en capital : 50 % — vérifié en vigueur en 2026 (la hausse aux 2/3 proposée en 2024 a été reportée au 1er janvier 2026, puis ANNULÉE le 21 mars 2025, annulation officialisée au budget fédéral de novembre 2025 ; le Québec s'était harmonisé). La moitié NON imposable de chaque gain en capital réalisé par une société privée crédite le CDC, un compte fiscal théorique cumulatif (depuis 1971 ou l'incorporation). La société fait ensuite le choix formel (T2054 au fédéral, CO-502 au Québec, résolution des administrateurs) et verse un dividende en capital 100 % libre d'impôt à l'actionnaire résident canadien. Cristalliser 100 000 $ de gain = 50 000 $ de CDC neuf. La moitié imposable coûte ~25,09 % du gain brut au Québec (50,17 % × 50 %), dont ~15,33 points remboursables via l'IMRTD (voir le cas IMRTD). Point clé de calendrier : le CDC est un solde INSTANTANÉ, pas un solde de fin d'exercice — l'élection et le versement peuvent se faire le jour même de la vente. Le moteur peut chiffrer dès maintenant une BORNE : « CDC potentiel créé = 50 % des gains latents des comptes corpo » ; le montant réellement versable exige le solde CDC vérifié auprès de l'ARC.

**Données requises** :
- Gains latents des positions corpo (PBR et valeur marchande) — _deja-au-dossier — Compte.type='corpo', Position.valeurComptable / valeurMarchande (src/lib/profils/types.ts)_
- Solde CDC actuel vérifié (Mon dossier d'entreprise ARC ou annexe 89 T2) — _impossible-automatique — à demander au comptable de la société ; fiche-a-etendre pour le stocker (soldeCDC + date de vérification)_
- Statut de société privée (le CDC n'existe que pour elles) — _fiche-a-etendre_
- Résidence canadienne des actionnaires — _fiche-a-etendre_
- Historique des pertes en capital réalisées par la société (elles ont déjà réduit le CDC cumulatif) — _impossible-automatique — seul le solde ARC vérifié fait foi_
- Taux d'inclusion 50 % et part CDC — _baremes-csv — config/parametres-fiscaux.csv_

**Pièges** :
- Élire plus que le solde réel → impôt de la partie III = 60 % de l'excédent, plus intérêts ; seule échappatoire : le choix du par. 184(3) dans les 90 jours de l'avis de cotisation, qui requalifie l'excédent en dividende imposable.
- La borne du moteur (50 % des gains latents) N'EST PAS le solde : les pertes en capital passées de la société l'ont déjà réduit (le cumul peut être en déficit), et d'autres sources l'augmentent (produit d'assurance-vie, dividendes en capital reçus d'une autre société). Ne jamais recommander un versement sur la borne.
- Actionnaire non-résident : le dividende en capital N'est PAS libre d'impôt pour lui — retenue de la partie XIII de 25 % (allègement conventionnel variable).
- Société non privée (ou qui cesse de l'être) : pas de CDC — verser avant tout changement de statut.
- Anti-évitement 83(2.1) : si les actions ont été acquises principalement pour toucher le CDC existant, le dividende est réputé imposable.
- La résolution doit préciser un MONTANT EN DOLLARS (l'ARC a confirmé qu'une résolution « la totalité du solde » est invalide) et l'élection porte sur le plein montant du dividende.
- Soldes CDC des exercices chevauchant la saga du taux d'inclusion (25 juin 2024 → annulation 2025) : des T2 ont pu être produites sur la base proposée des 2/3 — faire revérifier ces soldes par annexe 89.

**À valider par le fiscaliste** :
- Toute la mécanique CDC et les pourcentages (50 % / 50,17 % / 25,09 %)
- Le traitement québécois d'un versement excédentaire (le 60 % est fédéral ; l'équivalent québécois exact reste à confirmer)
- La portée exacte de 83(2.1) pour des sociétés de gestion familiales
- Le taux conventionnel applicable à tout actionnaire non-résident au dossier

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-2-dividends/income-tax-folio-s3-f2-c1-capital-dividends.html · https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account/capital-dividend-accounts.html · https://cpaquebec.ca/fr/salle-de-presse/nouvelles-et-publications/hausse-du-taux-dinclusion-du-gain-en-capital-et-dividendes-en-capital/ · https://www.revenuquebec.ca/fr/salle-de-presse/nouvelles-fiscales/details/2025-02-05/harmonisation-avec-le-report-au-1er-janvier-2026-de-la-mise-en-oeuvre-du-changement-du-taux-dinclusion-des-gains-en-capital/ · https://www.prospyr.ca/blog/capital-gains-inclusion-rate-canada-2026 · https://www.ey.com/content/dam/ey-unified-site/ey-com/fr-ca/services/tax/tax-calculators/2026/ey-taux-impot-placement-des-societes-2026-01-15-v1.pdf · https://www.revenuquebec.ca/fr/services-en-ligne/formulaires-et-publications/details-courant/co-502/ · https://www.bccpa.ca/news-events/cpabc-newsroom/2025/october/capital-dividend-accounts-practical-approaches-to-dealing-with-errors/ · https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/payments-non-residents/nr4-part-xiii-tax/part-xiii-withholding-tax/rates-part-xiii-tax.html · https://taxinterpretations.com/content/1062756</sub>

_Confiance : haute_

### Ordre des opérations : cristalliser les gains et verser le dividende en capital AVANT de réaliser les pertes

**Déclencheur** : Un compte corpo porte À LA FOIS des gains latents et des pertes latentes — ou une cristallisation de pertes corporative (miroir de la stratégie 1) est envisagée alors que des gains latents existent aussi. Le moteur voit déjà les deux côtés dans les positions.

**Mécanique** : Le CDC est réduit par la moitié NON déductible de chaque perte en capital au moment où elle est réalisée, et le solde se mesure à l'instant de l'élection. Séquence optimale démontrée par la littérature professionnelle : (1) réaliser les gains ; (2) élire et verser le dividende en capital immédiatement (le solde est instantané) ; (3) réaliser les pertes ensuite seulement. Inverser l'ordre détruit du CDC — de façon permanente si aucun gain futur ne le reconstruit. C'est une raison spécifiquement corporative de cristalliser des gains MAINTENANT, même sans besoin immédiat de liquidités : sécuriser la sortie libre d'impôt avant que la récolte de pertes ne la ferme. Aucun équivalent n'existe au personnel.

**Données requises** :
- Positions corpo en gain ET en perte (PBR, valeur marchande) — _deja-au-dossier — Position.valeurComptable / valeurMarchande des comptes type='corpo'_
- Solde CDC vérifié pour dimensionner le dividende — _impossible-automatique — annexe 89 / Mon dossier d'entreprise ; fiche-a-etendre pour le stocker_

**Pièges** :
- Perte apparente : rachat du titre vendu à perte dans les 30 jours par la société ou une personne AFFILIÉE (incluant l'actionnaire qui la contrôle et son conjoint) → perte refusée. La règle ne vise pas les gains : rachat le jour même permis sur la jambe gains.
- Si une perte est réalisée entre le calcul du solde et la production de l'élection, l'élection peut devenir excédentaire → partie III à 60 %.
- Le dividende en capital exige les liquidités (ou un billet à payer) : le verser « pour verser » sans plan de sortie réel est une décision d'affaires, pas seulement fiscale.

**À valider par le fiscaliste** :
- La confirmation que la réduction du CDC par une perte est immédiate à la réalisation (composante cumulative du par. 89(1))
- Le périmètre exact des personnes affiliées pour une société de gestion familiale
- L'opportunité de verser en billet quand l'encaisse manque

<sub>Sources : https://www.cadesky.com/publications/timing-is-everything/ · https://www.bmo.com/advisor/PDFs/the-capital-dividend-account-cda-advisor-guide-948e.pdf · https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-2-dividends/income-tax-folio-s3-f2-c1-capital-dividends.html · https://www.millerthomson.com/en/insights/corporate-tax/finance-releases-revised-rules-for-capital-dividend-account-cda-computations/</sub>

_Confiance : haute_

### Rachat immédiat après vente en gain — absence de règle du « gain apparent », RGAÉ non applicable en soi

**Déclencheur** : Tout plan de cristallisation qui vend un titre en gain puis le rachète (le cœur de strategieCristallisationGains) — la promesse « rachat permis le jour même » du texte du constat.

**Mécanique** : L'article 54 LIR définit la « perte apparente » : elle exige une disposition À PERTE, avec rachat d'un bien identique dans la fenêtre de 61 jours (-30/+30) et détention à la fin. Il n'existe AUCUN miroir pour les gains : vendre un gagnant et le racheter le jour même est une disposition réelle, le gain est imposable, et le PBR remonte au prix de rachat. Côté RGAÉ (art. 245, resserrée depuis 2024 : critère « un des objets principaux », substance économique codifiée, pénalité de 25 %), l'ARC a indiqué que les opérations de cristallisation de gains en capital ne sont pas en soi visées par la RGAÉ — cristalliser ACCÉLÈRE la reconnaissance de l'impôt (ou consomme des pertes que l'art. 111(1)b) permet expressément d'utiliser), il n'évite rien. Le risque RGAÉ n'apparaît que si la cristallisation s'insère dans une chaîne procurant d'autres avantages (dépouillement de surplus, etc.).

**Données requises** :
- Aucune donnée nouvelle — règle de droit binaire, applicable au plan existant — _deja-au-dossier_

**Pièges** :
- Le rachat immédiat n'est permis que pour les GAGNANTS : si le même document contient aussi la stratégie 1 (vente de perdants), le rachat de CES titres reste interdit 30 jours — deux consignes opposées sur la même page, à séparer visuellement.
- Des allers-retours répétés à haute fréquence pourraient faire requalifier les opérations en compte de REVENU (revenu d'entreprise) — une cristallisation annuelle unique est loin de ce seuil, mais la règle mérite d'être connue.
- La pénalité RGAÉ de 25 % (opérations postérieures au 20 juin 2024) rend coûteuse toute insertion de la cristallisation dans une planification plus large non revue.

**À valider par le fiscaliste** :
- Confirmer qu'aucune interprétation ou modification 2025-2026 n'a étendu l'art. 54 aux gains.
- Valider la lecture de la position ARC « cristallisation non per se visée par la RGAÉ » (contexte : hausse annulée du taux d'inclusion) et son application au cas « absorber des pertes reportées ».
- Approuver la formulation « rachat permis le jour même » au document client, avec ses réserves (cas 2 et 6).

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/capital-losses-deductions.html · https://taxinterpretations.com/content/799019 · https://www.doanegrantthornton.ca/insights/significant-changes-to-gaar/ · https://www.manulifeim.com/retail/ca/en/viewpoints/tax-planning/superficial-losses · https://www.financialwisdomforum.org/forum/viewtopic.php?p=770579</sub>

_Confiance : haute_

### Ordre intrajournalier vente-rachat : le coût moyen (art. 47) peut diluer le gain cristallisé

**Déclencheur** : Exécution du plan avec rachat le même jour que la vente — exactement ce que le constat actuel promet.

**Mécanique** : Le PBR est un coût MOYEN recalculé à chaque acquisition (art. 47). Si les achats du jour sont réputés traités AVANT les ventes du même jour (position administrative rapportée, non publiée), le coût moyen au moment de la vente inclut le rachat au prix du jour : le gain cristallisé est DILUÉ — on cristallise moins que le gain latent visé et le PBR final reste plus bas que prévu. En vendant AVANT de racheter (ou en rachetant le lendemain), la fraction vendue cristallise exactement sa fraction du gain latent, comme le suppose planifierRecolte. La dilution ne détruit pas le gain (il resurgira plus tard), mais elle rend FAUX le montant annoncé au client et peut laisser des pertes non consommées.

**Données requises** :
- Ordre réel d'exécution vente/rachat dans la journée (pupitre de négociation) — _impossible-automatique_
- Prix et quantités du rachat, pour simuler la dilution le cas échéant — _fiche-a-etendre_

**Pièges** :
- La consigne sûre à imprimer sur chaque ligne du plan : VENDRE d'abord, racheter ensuite — idéalement le lendemain si l'on veut éliminer tout débat sur l'ordre réputé.
- Racheter la veille de la vente (l'ordre inverse) est le pire cas : dilution garantie par le calcul de moyenne.
- Pour un fonds commun à VL unique quotidienne, vente et rachat le même jour passent à la même VL — pas d'écart de prix, mais la question de l'ordre des opérations dans le pool de coût moyen demeure.

**À valider par le fiscaliste** :
- La position administrative « achats avant ventes pour les opérations du même jour » — informelle, jamais publiée officiellement : à confirmer ou infirmer.
- La consigne d'exécution standard à joindre au plan (vendre-puis-racheter vs racheter à J+1).

> ⚠ **Contre-expertise** : La mécanique du coût moyen (art. 47) est exacte, mais la « position administrative » selon laquelle les achats du jour seraient réputés traités AVANT les ventes est introuvable dans toute source publique consultable — invérifiable, donc inutilisable comme règle moteur. La conclusion opérationnelle reste bonne par prudence : ne jamais racheter le même jour que la vente (régler la vente d'abord, racheter le lendemain), mais présenter cela comme précaution, pas comme règle établie.

<sub>Sources : https://www.adjustedcostbase.ca/blog/order-of-transactions-for-calculating-adjusted-cost-base/ · https://www.taxtips.ca/glossary/adjusted-cost-base.htm</sub>

_Confiance : faible_

### PBR moyen inter-comptes : biens identiques de TOUS les comptes non enregistrés du contribuable

**Déclencheur** : Le même titre (symbole + devise) détenu dans deux comptes non enregistrés ou plus du même contribuable — chez nous ou chez un autre courtier.

**Mécanique** : L'art. 47 impose un coût moyen calculé sur l'ENSEMBLE des biens identiques du contribuable, tous comptes non enregistrés confondus, y compris chez d'autres courtiers. La méthode moyenne est obligatoire (ni PEPS ni identification spécifique pour des titres identiques). Le « coût » par compte du relevé Croesus est un coût comptable PAR COMPTE : si le titre existe ailleurs, le PBR fiscal diffère, et le gain calculé position par position est faux. Vendre le « lot » du compte A cristallise en réalité le gain mesuré au coût moyen GLOBAL. Le moteur traite aujourd'hui chaque Position comme un pool indépendant (gainLatent par position).

**Données requises** :
- Détention du même symbole+devise dans plusieurs comptes non enregistrés internes du même titulaire — _deja-au-dossier — croisable dans profil.comptes dès maintenant_
- Positions détenues ailleurs (autres courtiers) — _fiche-a-etendre — consolidation.comptesExternes/detailsExternes ne portent pas le détail par titre_
- PBR consolidé du pool (interne + externe) — _fiche-a-etendre_

**Pièges** :
- Fusionner les pools par symbole+devise+TITULAIRE seulement : les pools sont par contribuable — jamais fusionner client et conjoint.
- Quand comptesExternes ≠ 'non' et que le titre est un candidat plausible à une détention externe, la dégradation en « montant-a-confirmer » n'est pas seulement prudente, elle est fiscalement OBLIGATOIRE : le PBR interne n'est pas le PBR.
- « Biens identiques » : deux FNB de fournisseurs différents sur le même indice ne sont PAS identiques ; deux séries (A vs F) du même fonds sont une question technique non triviale.

**À valider par le fiscaliste** :
- La définition de « biens identiques » appliquée au registre d'instruments (séries d'un même fonds, CDR vs action sous-jacente — le piège CDR/US déjà payé dans le grand livre).
- La règle de fusion des pools internes avant calcul du plan.

<sub>Sources : https://www.taxtips.ca/glossary/adjusted-cost-base.htm · https://www.adjustedcostbase.ca/blog/tracking-adjusted-cost-base-with-multiple-brokerage-accounts/ · https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/it387r2-consolid/archived-meaning-identical-properties.html</sub>

_Confiance : haute_

### Perte apparente inversée : achat récent du même titre au CELI/REER pendant qu'on vend le gagnant

**Déclencheur** : Le client a acheté (ou achètera) dans la fenêtre de 30 jours le même titre dans un compte enregistré — le sien ou celui de son conjoint — pendant que le plan vend ce titre EN GAIN.

**Mécanique** : Aucun piège sur le gain lui-même : la perte apparente (art. 54) exige une disposition à PERTE ; vendre un gagnant au non-enregistré reste une cristallisation valide même avec un achat récent au CELI/REER. Les vrais pièges sont adjacents : (a) si le plan JUMELÉ (stratégie 1) vend aussi des PERDANTS, un achat du même titre par le REER/FERR/CELI/CELIAPP (personnes affiliées — fiducies dont le client ou son conjoint est bénéficiaire majoritaire) dans la fenêtre de 61 jours refuse la perte DÉFINITIVEMENT : le rehaussement de PBR se perd dans le compte enregistré, où il ne sert à rien ; (b) le rachat du gagnant est une ACQUISITION qui ouvre une fenêtre de 30 jours vers l'avant — si le marché tombe et qu'on revend à perte dans les 30 jours en détenant encore des parts identiques à la fin de la période, cette nouvelle perte est apparente.

**Données requises** :
- Transactions par titre des comptes enregistrés du client sur ±30 jours (le profil ne les porte pas) — _fiche-a-etendre_
- Transactions des comptes du conjoint et de ses régimes (personnes affiliées) — _fiche-a-etendre — souvent hors visibilité, question de rencontre_
- Cotisations en titres (transferts en nature) vers CELI/REER dans la période — _deja-au-dossier partiellement — le parseur voit les cotisations mais pas toujours le titre_

**Pièges** :
- Le document portera deux consignes OPPOSÉES : « rachat immédiat permis » pour les gagnants, « attendre 31 jours » pour les perdants — les séparer typographiquement pour éviter l'erreur d'exécution.
- Le transfert EN NATURE d'un perdant vers un CELI/REER est le cas extrême : perte réputée nulle, refusée à jamais (et pour un REER, cotisation évaluée à la JVM). Le transfert en nature d'un GAGNANT, lui, cristallise le gain — c'est même une variante de cristallisation sans frais de courtage, à noter pour les autres angles.
- Le décompte des 30 jours en dates d'opération vs de règlement n'est pas uniforme dans l'industrie — compter prudemment (la fenêtre la plus large).

**À valider par le fiscaliste** :
- La liste des personnes affiliées retenue par le moteur (conjoint, société contrôlée, régimes des deux).
- Le texte des deux consignes de rachat au document.
- Le traitement du transfert en nature vers un compte enregistré comme variante de cristallisation de gains.

<sub>Sources : https://www.manulifeim.com/retail/ca/en/viewpoints/tax-planning/superficial-losses · https://www.sunlifeglobalinvestments.com/en/insights/investor-education/tax-and-estate-planning/the-superficial-loss-rules-have-you-tripped-the-wire/ · https://www.moneysense.ca/columns/ask-moneysense/triggering-losses-by-transferring-investments-to-a-tfsa/ · https://www.cibc.com/content/dam/personal_banking/advice_centre/tax-savings/superficial-loss-partial-en.pdf</sub>

_Confiance : haute_

### Contribuables mélangés dans le plan : comptes corpo et comptes conjoints (défaut présent dans le code)

**Déclencheur** : Présence d'un compte de type 'corpo', ou d'un titulaire 'conjoint'/'conjoint-commun'/null, parmi les positions en gain retenues par le plan.

**Mécanique** : Les pertes en capital sont PAR CONTRIBUABLE. Les pertes reportées de l'avis de cotisation du PARTICULIER n'absorbent jamais un gain réalisé dans sa société de gestion — contribuable distinct, déclaration T2 distincte, pertes distinctes — et inversement. Or positionsNonEnregistrees inclut c.type === 'corpo' (strategies.ts, ligne 162) et planifierRecolte ignore Compte.titulaire : le moteur peut aujourd'hui recommander de vendre des positions de la société pour « absorber » des pertes personnelles — un plan fiscalement faux, pas seulement imprécis. Comptes conjoints : le gain se déclare selon la propriété effective (proportion des apports) ; seule la PART du client est absorbable par SES pertes. En corpo, la cristallisation obéit à sa propre logique (la moitié non imposable du gain crédite le CDA ; les pertes le débitent) — c'est une stratégie distincte pour le moteur corporatif, pas une extension de celle-ci.

**Données requises** :
- Type de compte — _deja-au-dossier — Compte.type_
- Titulaire du compte — _deja-au-dossier — Compte.titulaire, mais nullable et sans source automatique_
- Pertes en capital reportées de la société (si un volet corpo est voulu un jour) — _fiche-a-etendre — n'existe pas au profil_
- Proportion des apports d'un compte conjoint — _fiche-a-etendre — question de rencontre_

**Pièges** :
- Correction de code immédiate : exclure les comptes 'corpo' du pool absorbable par des pertes PERSONNELLES, et exclure (ou dégrader en « montant-a-confirmer ») les comptes dont le titulaire n'est pas prouvé 'client'.
- Un titulaire null doit être traité comme « à confirmer », jamais présumé client — cohérent avec la philosophie « rien n'est deviné » du projet.
- Ne pas présumer 50/50 sur un compte conjoint : l'attribution suit les apports réels, pas le titre du compte.

**À valider par le fiscaliste** :
- La règle de partage des comptes conjoints (présomption admissible vs apports documentés).
- L'opportunité d'une stratégie « cristallisation corpo » séparée (interaction CDA/IMRTD) dans le moteur corporatif.

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-25300-net-capital-losses-other-years.html · https://www.taxtips.ca/filing/capital-gains-and-losses.htm</sub>

_Confiance : haute_

### Date de règlement, T+1 et fin d'année civile

**Déclencheur** : Cristallisation visant une année d'imposition PRÉCISE : absorber des gains déjà réalisés cette année, année à faible revenu, dernière année avant un changement de situation (départ, décès, vente d'entreprise).

**Mécanique** : La disposition survient à la DATE DE RÈGLEMENT (position de l'ARC pour les titres cotés) — le commentaire du code est conforme. Depuis mai 2024, le Canada règle à T+1 : pour l'année d'imposition 2026, le dernier jour pour NÉGOCIER avec règlement en 2026 est le mercredi 30 décembre 2026 (un ordre du jeudi 31 règle le lundi 4 janvier 2027, le 1er janvier étant férié). La variante « absorber des pertes reportées » n'a aucune échéance — les pertes en capital nettes se reportent indéfiniment — mais dès que le plan cible une ANNÉE, le calendrier devient une règle dure que le document doit imprimer.

**Données requises** :
- Calendrier boursier de l'année (jours fériés TSX/NYSE) — _fiche-a-etendre — table statique annuelle à coder ou à mettre dans les barèmes_

**Pièges** :
- Confusion classique avec les « 60 premiers jours » REER : ils ne gouvernent que la déduction REER, jamais l'année d'un gain — déjà bien noté dans le code, à conserver dans le document client.
- Titres canadiens et américains partagent T+1 depuis mai 2024, mais leurs jours fériés diffèrent — un plan mixte CAD/USD exécuté le 30 décembre peut régler des jours différents selon la place.
- Le décompte de la fenêtre de 30 jours (perte apparente) en dates d'opération vs de règlement n'est pas uniforme dans les sources — compter au plus large.

**À valider par le fiscaliste** :
- La position exacte opération vs règlement pour la disposition ET pour le décompte de l'art. 54 (interprétations ARC citées par TaxTips).
- La date butoir imprimée sur les plans de fin d'année.

<sub>Sources : https://www.taxtips.ca/personaltax/investing/taxtreatment/trade-date-versus-settlement-date.htm · https://www.raymondjames.ca/commentary-and-insights/tax-planning/2026/07/13/tax-loss-harvesting-canada-2026-guide · https://investingnews.com/daily/resource-investing/mark-these-tax-loss-selling-dates-on-your-calendar/</sub>

_Confiance : haute_

### T5008/RL-18 et la déclaration : préparer d'avance ce que le client verra

**Déclencheur** : Toute cristallisation exécutée — les feuillets arrivent en février suivant et l'ARC apparie les produits de disposition.

**Mécanique** : Le courtier produit un T5008 (et un RL-18 au Québec) par disposition : case 21 = produit BRUT ; case 20 = coût, SOUVENT vide ou non conforme au PBR fiscal — l'ARC l'écrit noir sur blanc : le montant « peut ne pas refléter votre PBR » et des ajustements peuvent être requis. Le client verra donc de GROS produits de vente sur ses feuillets, et l'ARC les voit aussi. La déclaration doit : reporter chaque disposition à l'annexe 3 (fédéral) et à l'annexe G (Québec) MÊME si le gain net est nul ; réclamer les pertes reportées à la ligne 25300 (fédéral) et à la ligne 290 (Québec, avec TP-729/annexe N) ; et s'attendre à un avis de cotisation montrant le solde de pertes RÉDUIT. Le document du plan peut générer d'avance, à partir de LignePlan : produits bruts attendus aux feuillets, gain cristallisé, pertes consommées, impôt résultant.

**Données requises** :
- Montants du plan (produits, gains, pertes consommées) — _deja-au-dossier — LignePlan et droits.pertesCapitalReportees_

**Pièges** :
- Logiciels d'impôt qui importent le T5008 avec case 20 vide → gain = 100 % du produit si personne ne corrige avec le PBR du plan ; remettre au client (ou à son comptable) le tableau PBR par titre.
- Doublon classique : T5008 auto-importé + annexe 3 saisie à la main = dispositions comptées DEUX fois.
- Ventes en USD : le T5008 peut être libellé en devise (case 13) — la conversion CAD reste à faire par le déclarant, au taux du jour de la disposition.
- Ne pas déclarer « parce que l'impôt est nul » n'est pas une option : l'appariement ARC des produits non déclarés génère des redressements automatiques à coût zéro présumé.
- La demande des pertes reportées n'est PAS automatique : sans la ligne 25300/290, le gain devient pleinement imposable même si les pertes dorment au dossier.

**À valider par le fiscaliste** :
- Le gabarit du bloc « ce que vous verrez en février » du document client.
- La consigne interne : rapprocher case 20 du T5008 et PBR du plan avant la saison d'impôt.

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5008-statement-securities-transactions-slip-information-individuals.html · https://www.cibc.com/content/dam/personal_banking/advice_centre/find-my-documents/t5008-faq-en.pdf · https://www.revenuquebec.ca/fr/citoyens/declaration-de-revenus/produire-votre-declaration-de-revenus/comment-remplir-votre-declaration-de-revenus/aide-par-ligne/276-a-298-2-revenu-imposable/ligne-290/ · https://www.questrade.com/learning/t5008-tax-slip-explained</sub>

_Confiance : haute_

### Priorité absolue du don de titres sur la cristallisation (règle d'ordonnancement)

**Déclencheur** : Le client fait des dons (intentions.donsAnnuelsMoyens > 0), détient des positions non enregistrées en gain latent, ET la cristallisation de gains est aussi déclenchée (pertes disponibles > 0). Les deux stratégies convoitent les mêmes titres.

**Mécanique** : Le don EN NATURE d'un titre coté à un organisme enregistré porte un taux d'inclusion de 0 % sur le gain (art. 38a.1) LIR, mesure miroir au Québec) PLUS le reçu pour la pleine juste valeur marchande. Cristalliser ce même gain consommerait le budget de pertes pour effacer un gain qui aurait disparu gratuitement — les pertes sont un actif rare, le don ne l'est pas. Ordre du moteur : (1) affecter le montant destiné au don au titre le plus dense en gain, EN NATURE ; (2) retirer cette position/portion du bassin de la cristallisation ; (3) cristalliser le résidu avec les pertes. Corollaire : ne jamais donner en nature un titre en PERTE — le vendre (la perte survit, un organisme n'est pas une personne affiliée), puis donner le comptant.

**Données requises** :
- Dons annuels moyens du client — _deja-au-dossier — intentions.donsAnnuelsMoyens (types.ts)_
- PBR et valeur marchande des positions — _deja-au-dossier — Position.valeurComptable / valeurMarchande_
- Pertes disponibles (année + reportées) — _deja-au-dossier — transactionsAnnee + droits.pertesCapitalReportees_
- Admissibilité du titre au taux 0 % (coté sur bourse désignée, FCP, fonds distinct — actions privées exclues) — _fiche-a-etendre — indicateur par instrument, candidat naturel : le registre profils-instrument du moteur corpo_

**Pièges** :
- Titres admissibles seulement : actions/créances cotées sur bourse désignée, parts de FCP, fonds distincts — les actions de sociétés privées sont EXCLUES du taux 0 %.
- IMR depuis 2024 : 30 % du gain sur titres donnés entre dans l'assiette IMR et le crédit de don n'y compte qu'à 80 % — un gros don n'est plus toujours parfaitement gratuit.
- Limite fédérale du crédit : 75 % du revenu net (100 % l'année du décès et l'année précédente) ; le Québec n'a plus de limite depuis 2016 ; report 5 ans.
- Un avantage reçu en retour réduit le montant admissible ; la JVM au moment du transfert de propriété fait foi (le délai de livraison du titre compte, pas la date de la promesse).

**À valider par le fiscaliste** :
- La règle d'ordonnancement elle-même (don en nature avant cristallisation pour tout montant destiné au don)
- La liste des instruments admissibles au taux 0 %, type par type
- Le traitement recommandé d'un titre en perte destiné au don (vendre puis donner le comptant)

> ⚠ **Contre-expertise** : La règle d'ordonnancement est bonne (inclusion 0 % via 38a.1) + reçu à la JVM, miroir QC), MAIS depuis la réforme 2024 l'IMR réintègre 30 % du gain sur les dons de titres cotés dans son assiette et ne reconnaît que 80 % du crédit de don (pas 50 % comme la plupart des crédits) : un don en nature important peut à lui seul déclencher l'IMR. Le moteur doit passer le don sous le même garde-fou IMR que les cristallisations — « le gain disparaît gratuitement » est faux au-delà de l'exemption IMR.

<sub>Sources : https://www.canadalife.com/fr/placement-gestion/nouvelles-et-renseignements/un-plus-grand-impact-caritatif.html · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-110307.asp · https://www.rcgt.com/fr/planiguide/modules/module-02-lindividu-et-la-famille/5-autres-credits-et-mesures-daide/ · https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-charities-fr.pdf</sub>

_Confiance : haute_

### Une vente déjà prévue EST la cristallisation — grand livre unique des dispositions planifiées

**Déclencheur** : Un portefeuille cible est fourni (stratégie ordre-vente active) en même temps que la cristallisation de gains — ou toute autre stratégie qui planifie une vente (don en nature inclus).

**Mécanique** : Les ventes de rééquilibrage réalisent des gains de toute façon : le budget de pertes s'alloue D'ABORD à ces ventes contraintes (la cible dicte quoi vendre, pas la densité de gain), et la cristallisation pure ne chiffre que le RÉSIDU de pertes non consommé. Fiscalement l'année civile est un seul panier — l'ordre intra-année est indifférent — mais côté moteur, compter le même dollar de perte dans deux constats fabrique un total faux (défaut du bandeau déjà documenté le 5 août 2026 dans strategies.ts). Règle : un « grand livre des dispositions planifiées » partagé entre don-titres, ordre-vente et cristallisation-gains ; chaque dollar de perte ne s'affecte qu'une fois ; chaque constat devient une VUE du même livre, et le PDF interdit la somme des montants (le champ libelleMontant existe déjà pour ça).

**Données requises** :
- Portefeuille cible du planificateur — _deja-au-dossier — paramètre PortefeuilleCible d'analyser(), souvent null_
- Plans de vente de chaque stratégie — _deja-au-dossier — Constat.plan (LignePlan[]), à unifier dans une structure commune_
- PBR par position — _deja-au-dossier — Position.valeurComptable_

**Pièges** :
- Double comptage : cristalliser un titre qu'on vendra de toute façon au rééquilibrage = compter le même gain deux fois ET générer un aller-retour inutile (frais, sortie de marché).
- L'ordre de vente vers la cible n'a pas la liberté du choix du titre le plus dense : l'allocation de pertes doit suivre les ventes réellement prévues, pas l'ordre optimal théorique.
- Si le rééquilibrage réalise déjà PLUS de gains que les pertes disponibles, la cristallisation pure doit sortir non-applicable — pas un deuxième montant.

**À valider par le fiscaliste** :
- Confirmer que le panier annuel unique (gains et pertes de l'année civile se compensent globalement à l'annexe 3) autorise cette présentation par budget, sans faux séquencement

<sub>Sources : https://www.taxtips.ca/personaltax/investing/taxtreatment/trade-date-versus-settlement-date.htm</sub>

_Confiance : haute_

### Cristalliser puis cotiser au CELI — le geste combiné

**Déclencheur** : Cristallisation de gains calculée ET droits CELI réels connus (les 3 conditions du schéma §2 : historique complet importé, historiqueExterne = jamais confirmé daté, aucun transfert entrant douteux).

**Mécanique** : Vendre le titre en gain (gain absorbé par les pertes → impôt nul), cotiser le produit au CELI, racheter le même titre DANS le CELI le jour même — permis : la règle de la perte apparente ne vise que les PERTES, il n'existe aucun « gain apparent ». Le rendement futur passe à l'abri. Variante en un geste : la cotisation EN NATURE d'un titre en gain est une disposition réputée à la JVM — la cotisation cristallise elle-même le gain. INTERDIT en nature pour un titre en perte : perte refusée définitivement (40(2)(g)(iv)). Et vendre à perte au comptant puis racheter le même titre dans le CELI (ou le REER) en dedans de 30 jours = perte apparente refusée SANS ajout au PBR — la perte disparaît pour toujours.

**Données requises** :
- Droits CELI réels du client — _deja-au-dossier — droits-celi.ts (formule sous verrou fiscaliste, §8 du schéma)_
- Plafond CELI 2026 (7 000 $, confirmé par l'ARC) — _baremes-csv — déjà présent dans config/parametres-fiscaux.csv, marqué a-confirmer_
- Confirmation comptesExternes = non — _deja-au-dossier — consolidation.comptesExternes_

**Pièges** :
- Cotisation excédentaire : 1 %/mois — d'où la règle transversale existante (jamais de montant quand les droits sont incertains), qui s'applique telle quelle au geste combiné.
- Un retrait CELI de l'année courante ne redonne des droits qu'au 1er janvier suivant (déjà codé dans deriver.ts).
- Le choix du titre à racheter dans le CELI est un jugement : retenue étrangère non récupérable sur les dividendes américains en CELI.
- La combinaison inverse est un piège classique : jamais transférer un titre en PERTE en nature vers CELI/REER.

**À valider par le fiscaliste** :
- Le traitement de la cotisation en nature comme disposition réputée à la JVM
- La perte apparente quand le rachat se fait dans le CELI/REER du client ou de son conjoint (personnes affiliées)
- Le plafond 2026 (lever le a-confirmer du CSV)

<sub>Sources : https://help.wealthsimple.com/hc/fr-ca/articles/360056585034 · https://www.cibc.com/content/dam/personal_banking/advice_centre/tax-savings/year-end-tax-tips-fr.pdf · https://www.canadalife.com/fr/placement-gestion/nouvelles-et-renseignements/conseils-fiscaux-de-fin-dannee.html · https://decouverte.rbcbanqueroyale.com/quel-est-le-plafond-de-cotisation-au-celi-pour-2026/</sub>

_Confiance : haute_

### Garde-fou PBR : le coût moyen fiscal traverse TOUS les comptes du contribuable

**Déclencheur** : comptesExternes ≠ 'non', OU transfert entrant non résolu sur un compte non enregistré, OU positions en FNB/fonds à distributions (remboursement de capital, distributions fantômes réinvesties).

**Mécanique** : Biens identiques (art. 47 LIR) : le PBR fiscal est le coût moyen de TOUTES les parts identiques du contribuable, tous comptes non enregistrés confondus, toutes institutions. La valeur comptable du relevé est un coût LIVRE par compte : si le client détient le même titre ailleurs, chaque ligne du plan de récolte porte un gain faux — et le total aussi. S'ajoutent les remboursements de capital (réduisent le PBR) et les distributions réinvesties « fantômes » (l'augmentent), que le coût livre reflète mal. Règle moteur : quand comptesExternes ≠ non, le montant global reste montant-a-confirmer (déjà le cas) ET le plan ligne à ligne ne s'imprime PAS — un plan sur des PBR douteux est une marche à suivre vers un chiffre faux (principe déjà écrit dans strategies.ts pour le champ plan) ; générer à la place une question de rencontre PAR SYMBOLE (« détenez-vous aussi X ailleurs ? ») ; un transfert entrant non résolu sur un compte non enregistré marque toutes les positions de ce compte « PBR douteux » — même statut.

**Données requises** :
- Confirmation de comptes ailleurs — _deja-au-dossier — consolidation.comptesExternes + transfertsResolus_
- Confirmation par symbole (détenu ailleurs oui/non) — _fiche-a-etendre — champ par position ou par symbole, résolu en rencontre comme les transferts_
- Historique des distributions par titre (RC, fantômes) — _impossible-automatique — les relevés ne le portent pas ; seul le courtier teneur de compte l'ajuste, imparfaitement_

**Pièges** :
- Un transfert entrant « en nature » arrive souvent avec un coût livre égal à la valeur au jour du transfert, pas au PBR fiscal d'origine — le gain latent affiché est alors faux même sans compte externe actuel.
- Le danger n'est pas le montant global (déjà dégradé) mais le plan ligne à ligne : c'est lui qui deviendrait un ordre de vente sur des chiffres faux.
- La vente PARTIELLE cristallise une fraction exacte du gain seulement si le PBR est le vrai coût moyen fiscal — l'argument d'exactitude de planifierRecolte() repose entièrement sur ce garde-fou.

**À valider par le fiscaliste** :
- La règle des biens identiques appliquée aux ventes partielles et aux lots multi-comptes
- Le traitement du PBR des transferts en nature entrants

<sub>Sources : https://www.adjustedcostbase.ca/blog/tracking-adjusted-cost-base-with-multiple-brokerage-accounts/ · https://www.taxtips.ca/glossary/adjusted-cost-base.htm</sub>

_Confiance : haute_

### Garde-fou contribuables : jamais de plan qui mélange client, conjoint et société

**Déclencheur** : Présence de comptes type 'corpo', ou de titulaire 'conjoint'/'societe'/'conjoint-commun'/null parmi les positions candidates au plan de récolte.

**Mécanique** : Les pertes reportées de l'avis de cotisation du CLIENT n'absorbent jamais les gains d'une SOCIÉTÉ ni ceux du CONJOINT — trois contribuables, trois paniers fiscaux. Dans une société : la moitié non imposable d'un gain crédite le compte de dividendes en capital (dividende libre d'impôt à sortir), une perte le DÉBITE, et le revenu de placement passif au-delà de 50 000 $ réduit le plafond de la DPE de 5 $ par 1 $ (éliminé à 150 000 $) — cristalliser 100 000 $ de gain ajoute 50 000 $ de revenu passif. Cristalliser dans la société est une décision du moteur corporatif, pas de ce moteur. DÉFAUT ACTUEL À CORRIGER : positionsNonEnregistrees() inclut les comptes 'corpo' dans le même bassin (strategies.ts, ligne 162 : « if (c.type !== 'non-enregistre' && c.type !== 'corpo') continue; ») et transactionsAnnee agrège tout — le « sans impôt » peut mélanger deux contribuables. Règle : partitionner par titulaire ; comptes corpo → constat séparé « à évaluer par le moteur corporatif » ; titulaire null → position exclue du plan avec question de rencontre.

**Données requises** :
- Titulaire de chaque compte — _deja-au-dossier — Compte.titulaire, mais souvent null (aucune source automatique, dixit types.ts) → à résoudre en rencontre_
- Transactions de l'année ventilées par contribuable — _fiche-a-etendre — TransactionsAnnee est un agrégat unique, à partitionner_
- Pertes reportées de la société — _impossible-automatique — déclaration T2/CO-17 de la société, hors dossier_

**Pièges** :
- Règles d'attribution entre conjoints : si l'argent du client a financé le compte du conjoint, les gains peuvent lui revenir fiscalement — la partition par titulaire ne suffit pas à trancher.
- Un compte conjoint partage les gains au prorata des apports — invisible au relevé.
- Le suffixe de compte ne dit pas le titulaire (déjà documenté) : ne jamais le déduire.

**À valider par le fiscaliste** :
- Tout le volet corporatif (CDA, meule DPE, harmonisation québécoise de la meule, taux d'inclusion société)
- Les règles d'attribution entre conjoints appliquées aux comptes du dossier

<sub>Sources : https://www.bnc.ca/entreprises/conseils/articles/compte-dividendes-en-capital.html · https://www.cibc.com/content/dam/small_business/day_to_day_banking/advice_centre/pdfs/business_reports/ccpc-passive-income-fr.pdf · https://www.cifinancial.com/ci-gam/ca/fr/expert-insights/articles/inclusion-rates-and-the-capital-dividend-account.html</sub>

_Confiance : haute_

### Garde-fou calendrier : la date de RÈGLEMENT fait l'année fiscale (T+1)

**Déclencheur** : Tout plan de cristallisation généré en novembre-décembre, ou qui promet un effet « cette année ».

**Mécanique** : La disposition d'un titre coté se date à son RÈGLEMENT, pas à la négociation. Depuis le 27 mai 2024 le cycle canadien et américain est T+1 : la dernière journée de négociation pour l'année N est environ le 30 décembre (ajustée fériés/week-ends — en 2026, vente au plus tard le mercredi 30 décembre pour un règlement le 31). Règle moteur : chaque plan daté de fin d'année imprime la date limite de négociation à côté du montant ; passé cette date, le moteur requalifie automatiquement le geste dans l'année N+1 et recalcule — les pertes REPORTÉES ne périment pas (le geste survit), mais les pertes « de l'année » changent de panier et le montant change. Le module demarches.ts porte déjà la règle du règlement de fin d'année : la réutiliser, pas la dupliquer.

**Données requises** :
- Date du document (déjà un paramètre explicite d'analyser()) — _deja-au-dossier — paramètre date, jamais new Date() caché_
- Calendrier des jours de bourse (fériés TSX/NYSE) — _baremes-csv — table annuelle simple à ajouter_
- Type d'instrument (les fonds communs règlent autrement) — _deja-au-dossier — Position.categorie, incomplet ; registre d'instruments à terme_

**Pièges** :
- Fonds communs et FNB peuvent régler sur d'autres cycles — vérifier avant de promettre l'année.
- Racheter en décembre expose aux distributions de fin d'année des fonds (acheter la distribution = s'imposer dessus) — le rachat du geste vendre-racheter doit regarder les dates ex-distribution.
- Le jumeau de ce piège côté pertes (stratégie 1) est plus serré encore : 30 jours de perte apparente PLUS la date de règlement.

**À valider par le fiscaliste** :
- La politique ARC de la date de règlement pour les titres cotés
- Le cas des fonds communs de placement

<sub>Sources : https://www.taxtips.ca/personaltax/investing/taxtreatment/trade-date-versus-settlement-date.htm · https://www.securities-administrators.ca/news/canadian-securities-regulators-announce-move-to-t1-settlement-cycle/</sub>

_Confiance : haute_

### Ce qui reste au fiscaliste — et comment le document doit le dire

**Déclencheur** : Toujours, tant que revisionFiscalisteRequise = true ; et après le lever du verrou, pour chaque paramètre pris individuellement.

**Mécanique** : Tout seuil, taux, plafond et règle vit dans config/parametres-fiscaux.csv avec sa colonne source — jamais en dur (principe 4 du schéma, déjà respecté). Règles proposées : (1) un constat dont UN paramètre porte la source « a-confirmer » ne peut jamais sortir en statut 'calcule' — au mieux montant-a-confirmer (aujourd'hui, seul plafondCeliCumulatif propage contientAConfirmer ; strategies.ts ne lit pas la colonne source) ; (2) chaque montant imprimé porte l'année et la source de ses paramètres (le champ sources[] du Constat existe, y ajouter les lignes CSV utilisées) ; (3) la mention du verrou reste en toutes lettres sur la section tant que le drapeau tient, plus la mention « ne constitue pas un avis fiscal — à revoir avec votre fiscaliste ou comptable » ; (4) toute règle issue de cette exploration entre au tableau du mandat (§8 du schéma) AVANT d'être codée — le fiscaliste doit recevoir une liste fermée de fichiers, pas une chasse ; (5) le lever du verrou reste une ligne unique, datée, sur instruction explicite de Nicolas ; (6) un paramètre validé expire au 31 décembre (indexation annuelle) — le CSV doit porter l'année et le moteur refuser un paramètre d'une année passée sans reconduction explicite.

**Données requises** :
- Statut de source par paramètre — _deja-au-dossier — colonne source de config/parametres-fiscaux.csv_
- Propagation du statut a-confirmer au statut du constat — _fiche-a-etendre — strategies.ts et parametres-fiscaux.ts, généraliser contientAConfirmer_
- Nouveaux paramètres à faire valider : plafond REER 2026, seuil SV, exemption+taux IMR féd/QC, calendrier de bourse — _baremes-csv — lignes à ajouter, toutes a-confirmer à la naissance_

**Pièges** :
- Le « Rapport vivant » HTML circule SANS le verrou (divergence assumée, commentaire lignes 19-27 de strategies.ts) : toute nouvelle règle de cristallisation doit rester du côté PDF verrouillé — ne pas « réparer » la divergence sans demander.
- Un verrou global unique devient invisible à force d'être vu : la dégradation PAR PARAMÈTRE (règle 1) est ce qui garde le signal vivant après le premier lever du verrou.

**À valider par le fiscaliste** :
- Le périmètre §8 étendu aux nouvelles règles (ce document en est la préparation)
- La formulation exacte des mentions imprimées
- La règle d'expiration annuelle des paramètres

<sub>Sources : src/lib/profils/strategies.ts + docs/schema-profil-fiscal-v1.md §8 — planificateur-rencontre · config/parametres-fiscaux.csv — planificateur-rencontre</sub>

_Confiance : haute_

### Cotisation en nature au CELI/REER — la cristallisation qui finance l'abri

**Déclencheur** : Droits CELI ou REER inutilisés (déjà à la fiche : droits.celiInutilises / reerInutilises) + positions EN GAIN au non-enregistré + pas de liquidités pour cotiser. Couplage direct avec la stratégie cristallisation-gains existante : si des pertes dorment, le transfert en nature EST la cristallisation à impôt nul, et il met en plus le rendement futur à l'abri.

**Mécanique** : Un transfert en nature d'un compte non enregistré vers un CELI ou un REER est une DISPOSITION RÉPUTÉE à la juste valeur marchande : le gain se cristallise automatiquement, sans passer par le marché (aucun frais de vente-rachat, aucun risque de sortie de marché). Le titre repart avec un PBR égal à la JVM dans l'abri. Si le gain est absorbé par des pertes reportées (le montant déjà calculé par strategieCristallisationGains, strategies.ts:469), l'opération est totalement gratuite ; côté REER, la déduction générée dépasse généralement l'impôt du gain (déduction sur 100 % de la valeur transférée vs impôt sur 50 % du seul gain).

**Données requises** :
- Droits CELI/REER inutilisés, datés — _deja-au-dossier — droits.celiInutilises / reerInutilises (fiche/route.ts:111-119)_
- Positions en gain avec PBR — _deja-au-dossier — même filtre enGain que strategies.ts:425-428_
- Pertes reportées (variante impôt nul) — _deja-au-dossier — droits.pertesCapitalReportees_
- Confirmation qu'aucun compte n'est détenu ailleurs (règle transversale anti-cotisation-excédentaire) — _deja-au-dossier — consolidation.comptesExternes, la garde existe déjà (strategies.ts:224-231)_

**Pièges** :
- NE JAMAIS transférer une position EN PERTE : la perte est REFUSÉE à jamais (alinéa 40(2)g) LIR — REER/CELI). Il faut vendre, attendre 30 jours (perte apparente) ou transférer le produit en argent. Le moteur doit filtrer enGain strictement, comme il le fait déjà.
- La règle transversale du dépôt s'applique telle quelle : aucun montant à cotiser recommandé si comptesExternes ≠ non (pénalité 1 %/mois sur l'excédent).
- Le gain cristallisé sans pertes disponibles reste imposable : la variante « sans pertes » doit être couplée aux paliers bas (cas 1), sinon on devance de l'impôt sans raison.
- Retenue possible du courtier sur la fraction/valeur au moment du transfert REER : question d'exécution, pas de fiscalité, mais elle appartient aux démarches (demarches.ts).

**À valider par le fiscaliste** :
- La lecture de 40(2)g) (perte refusée au transfert vers REER/CELI du contribuable ou de son conjoint) et la formulation des démarches côté client.
- L'arbitrage transfert-en-nature vs vendre-puis-cotiser (frais, fractions, retenues).

<sub>Sources : https://www.cifinancial.com/ci-gam/ca/fr/expert-insights/articles/kind-transfers-registered-plans-dealing-superficial-and-denied-loss-rules.html · https://help.wealthsimple.com/hc/fr-ca/articles/360056585034 · https://www.lapresse.ca/debats/201012/01/01-4348001-transfert-au-celi-et-au-reer-pertes-sur-actions-refusees.php</sub>

_Confiance : haute_

---

## Calculables AVEC LES BARÈMES — paliers, seuils et taux à verser au CSV (verrou fiscaliste) (13)

### IMR — la borne haute de toute cristallisation massive

**Déclencheur** : Toute cristallisation dont le gain dépasse ~200 000 $ dans une année, surtout si le gain est la principale source de revenu de l'année (année creuse + grosse purge = combinaison exacte que ce catalogue recommande par ailleurs).

**Mécanique** : Depuis la réforme 2024 : IMR fédéral à 20,5 % sur un revenu imposable rajusté où les gains en capital entrent à 100 % (au lieu de 50 %), avec exemption de 181 440 $ en 2026 (indexée = début du 4e palier) et seulement 50 % de la plupart des crédits non remboursables. Québec harmonisé (Bulletin 2024-6) : taux 19 %, exemption 175 000 $ en 2024, indexée (~183 700 $ estimé pour 2026, à confirmer). Calcul interne sur les barèmes 2026 : pour un contribuable dont le SEUL revenu est le gain, l'IMR fédéral commence à mordre autour de 340 000–350 000 $ de gain cristallisé. L'IMR payé est récupérable sur les 7 années suivantes contre l'excédent d'impôt régulier — souvent un PRÉPAIEMENT, pas un coût final… sauf si les années suivantes n'ont pas assez d'impôt régulier (retraité) : alors le report se perd et l'IMR devient un vrai coût. Le moteur doit borner chaque plan de récolte : « au-delà de X $ cristallisés cette année, l'IMR s'active — vérification fiscaliste requise ».

**Données requises** :
- Gain cristallisé simulé (sortie du plan de récolte) — _deja-au-dossier — planifierRecolte()_
- Paramètres IMR féd. + QC (taux, exemptions, inclusions, fraction des crédits) — _baremes-csv — lignes imr-taux-fed 0,205, imr-exemption-fed 181440, imr-taux-qc 0,19, imr-exemption-qc (à confirmer), imr-inclusion-gains 1,0_
- Autres revenus de l'année (affinent le point de bascule) — _fiche-a-etendre_

**Pièges** :
- La cristallisation « à impôt nul » par pertes reportées N'EST PAS à l'abri : l'assiette IMR ne permet que 50 % des pertes reportées en déduction — un très gros gain « nul » peut déclencher l'IMR à lui seul.
- Les dons de titres cotés entrent à 30 % dans l'assiette IMR (0 % au régime régulier) — interaction avec la stratégie 4 existante.
- Le point de bascule ~340-350 k$ est un calcul interne (paliers 2026 + MPB à 50 %), PAS un chiffre publié — à faire recalculer.
- L'exemption QC 2026 exacte n'a pas été trouvée publiée — estimée par indexation (2,85 % en 2025, 2,05 % en 2026).

**À valider par le fiscaliste** :
- Le point de bascule fédéral et québécois avec le profil réel du client
- L'exemption IMR Québec 2026 exacte
- Le traitement des pertes reportées (50 %) et des dividendes (au montant reçu, sans majoration) dans l'assiette
- La mécanique de récupération sur 7 ans et sa valeur réelle pour un retraité

<sub>Sources : https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-en.pdf · https://taxspecialty.com/canada-alternative-minimum-tax-2026/ · https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/finances/publications-adm/Bulletins/FR/BULFR_2024-6.pdf · https://www.rcgt.com/fr/conseils/avis-d-experts/impot-minimum-remplacement-irm-changements-2024/ · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/impot-minimum-remplacement/</sub>

_Confiance : haute_

### Lisser de son vivant plutôt que la disposition réputée au décès

**Déclencheur** : Client âgé (ou en fin de vie) détenant un non-enregistré à gros gains latents, sans conjoint survivant possible pour le roulement — ou dont le conjoint mourra second avec tout le bloc.

**Mécanique** : Au décès, disposition réputée de tous les biens à la juste valeur marchande (T4011) : tout le gain latent tombe dans UNE déclaration finale, en bonne partie aux taux maximaux (33 % + 25,75 %, ~26,7 % effectif sur le gain — voire plus si récupération PSV la même année). Exception : roulement automatique au PBR vers le conjoint ou une fiducie au profit du conjoint — l'impôt attend le second décès. La cristallisation pluriannuelle de son vivant (cas 7) utilise les paliers bas de chaque année restante et peut faire passer le même gain de ~26,7 % à ~13-20 % ; les héritiers reçoivent de toute façon un PBR à la JVM. Point favorable spécifique : l'IMR ne s'applique pas à l'année du décès — mais il s'applique aux années de lissage du vivant, d'où l'intérêt de tranches annuelles modérées.

**Données requises** :
- Âge et état civil — _deja-au-dossier — demographie.age, demographie.etatCivil_
- Gains latents totaux — _deja-au-dossier_
- Paliers + seuils (pour chiffrer l'écart lissé vs bloc au décès) — _baremes-csv_
- Espérance de lissage (horizon) et volontés successorales — _impossible-automatique — conversation de planification, jamais un champ calculé_

**Pièges** :
- Si le roulement au conjoint s'applique, cristalliser avant le premier décès peut être PIRE que d'attendre (report gratuit au second décès) — l'ordre des décès est inconnaissable.
- Le don de titres à gain latent par testament (élimination du gain + reçu) peut battre le lissage pour la portion caritative — croiser avec la stratégie 4.
- Sujet délicat : le moteur détecte, le planificateur décide quoi présenter (principe SelectionStrategies déjà en place).
- La non-application de l'IMR l'année du décès n'a pas été vérifiée à la source dans cette exploration.

**À valider par le fiscaliste** :
- La mécanique 70(5)/70(6) (disposition réputée / roulement conjoint) et le choix de renoncer au roulement position par position
- La non-application de l'IMR au décès
- L'interaction avec la récupération PSV dans la déclaration finale

<sub>Sources : https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/evenements-vie/faire-impots-personne-decedee/preparer-declarations/declarer-revenus/gains-capital.html · https://www.cibc.com/content/dam/personal_banking/advice_centre/tax-savings/death-shareholder-fr.pdf</sub>

_Confiance : haute_

### Décès — cristallisation graduelle du vivant (lissage des paliers avant la disposition réputée)

**Déclencheur** : Client âgé (ou en fin de décaissement) portant de gros gains latents non enregistrés, dont le revenu annuel courant n'atteint pas le palier maximal, et pour qui aucun roulement au conjoint n'est disponible ou souhaité (célibataire, veuf, divorcé, ou conjoint déjà décédé). Le champ intentions.testamentAJour et demographie.age servent de porte d'entrée à la conversation.

**Mécanique** : Au décès, la LIR (par. 70(5)) répute que le défunt a disposé de toutes ses immobilisations à la juste valeur marchande immédiatement avant son décès : TOUS les gains latents s'empilent dans UNE seule déclaration finale. Empilés, ils poussent le revenu au palier maximal — au Québec en 2026, 53,31 % combiné au-delà d'environ 253 000 $, soit 26,65 % effectif sur un gain en capital à inclusion de 50 %. Cristalliser graduellement de son vivant — vendre-racheter chaque année juste assez de gain pour remplir les paliers inférieurs de l'année (le rachat immédiat est permis : la règle des 30 jours ne vise que les pertes, déjà documenté dans strategies.ts) — remonte le PBR d'autant et remplace un impôt au taux maximal en bloc par un impôt étalé aux taux inférieurs. Le portefeuille ne change pas ; seule la facture au décès fond. La mécanique de récolte par densité de gain (planifierRecolte) se réutilise telle quelle : la cible n'est plus « pertes disponibles » mais « espace de palier restant de l'année ».

**Données requises** :
- âge du client — _deja-au-dossier — demographie.age_
- état civil (décide si le roulement au conjoint existe) — _deja-au-dossier — demographie.etatCivil_
- positions non enregistrées avec PBR — _deja-au-dossier — comptes[].positions[].valeurComptable / valeurMarchande_
- revenu imposable EXACT de l'année (les bandes de revenus.trancheRevenu sont trop grossières pour calculer l'espace de palier) — _fiche-a-etendre — ajouter un champ revenuImposableExact ou affiner revenus.trancheRevenu_
- paliers d'imposition fédéral + Québec 2026 et taux d'inclusion (0,5) — _baremes-csv — config/parametres-fiscaux.csv, à faire valider par le fiscaliste_
- seuil de récupération de la PSV (≈ 95 323 $ de revenu net en 2026) — _baremes-csv_
- pertes en capital reportées (à consommer en priorité avant tout gain « payant ») — _deja-au-dossier — droits.pertesCapitalReportees_
- testament à jour (le contexte successoral de la conversation) — _deja-au-dossier — intentions.testamentAJour (souvent null → question de rencontre)_

**Pièges** :
- La récupération de la PSV : chaque dollar de revenu net au-delà du seuil (≈ 95 323 $ en 2026) reprend 15 ¢ de pension — un « lissage » qui traverse ce seuil chez un retraité peut coûter plus qu'il n'économise. Le calcul d'espace de palier doit intégrer ce seuil comme un pseudo-palier.
- Les pertes en capital nettes au décès deviennent déductibles contre TOUT revenu (111(2) LIR), pas seulement contre des gains : des pertes reportées ne sont donc jamais « perdues » au décès — l'urgence de les consommer du vivant est moindre qu'on le croit.
- Le déclencheur humain est l'horizon de vie : le moteur ne doit JAMAIS inférer une espérance de vie. Il présente l'écart de taux (palier courant vs 26,65 % au décès), le planificateur décide.
- Si un conjoint survivra, le roulement 70(6) reporte tout : le lissage du vivant du PREMIER conjoint est alors moins urgent — le vrai mur est au décès du survivant (voir le cas suivant).
- Frais de transaction et sortie de marché entre la vente et le rachat ; comptes à honoraires vs commissions.
- Un futur gouvernement peut remonter le taux d'inclusion (voir le cas « changement de taux ») : c'est un argument POUR cristalliser tôt, mais spéculatif — ne jamais le chiffrer.

**À valider par le fiscaliste** :
- L'arbitrage exact palier par palier fédéral + Québec 2026, incluant l'abattement du Québec et les crédits d'âge/pension qui fondent avec le revenu net
- La prise en compte de la récupération PSV et du SRG dans le coût marginal réel d'un gain cristallisé chez un retraité
- La confirmation que la disposition réputée 70(5) s'applique bien à chaque catégorie de biens détenue par la clientèle visée (fonds, FNB, CDR, actions US)

<sub>Sources : https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/evenements-vie/faire-impots-personne-decedee/preparer-declarations/declarer-revenus/gains-capital.html · https://www.conseiller.ca/magazine/compte-non-enregistre-au-deces-rouler-ou-ne-pas-rouler/ · https://laws-lois.justice.gc.ca/fra/lois/I-3.3/section-111.html · https://cqff.com/wp-content/uploads/paliers_imposition_2026.pdf · https://calculqc.ca/blog/fiscalite/taux-imposition-quebec-2026.html · https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html · https://francais.chip.ca/ressources/mode-de-vie/recuperation-prestation-vieillesse-oas-2026/</sub>

_Confiance : haute_

### Décès — roulement au conjoint survivant (70(6)) et renonciation bien par bien (70(6.2))

**Déclencheur** : Client marié ou conjoint de fait avec gains latents non enregistrés. Pertinent DU VIVANT (clause testamentaire et liquidateur à préparer — champ intentions.testamentAJour) et au décès (choix du liquidateur).

**Mécanique** : Par défaut, les biens légués à l'époux/conjoint de fait (ou à une fiducie exclusive au conjoint) roulent au PBR du défunt si la dévolution se fait dans les 36 mois (70(6) LIR) : aucun impôt au premier décès, l'impôt latent migre chez le survivant et frappera à SON décès (ou à sa vente). Mais le liquidateur peut RENONCER au roulement BIEN PAR BIEN (70(6.2)) : les biens choisis sont réputés disposés à la JVM dans la déclaration finale. La cristallisation optimale au premier décès consiste à renoncer sur juste assez de biens pour : (a) absorber les pertes du défunt — pertes de l'année ET reportées, que 111(2) rend déductibles contre TOUT revenu dans la déclaration finale ; (b) remplir les paliers inférieurs de la déclaration finale, qui autrement se perdent à jamais ; (c) consommer l'ECGC restante du défunt sur des actions admissibles — l'exonération ne se transmet pas. Le survivant hérite alors d'un PBR remonté sans un dollar d'impôt de plus que nécessaire. C'est littéralement la stratégie 7 existante (« récolter des gains à impôt nul »), exécutée une dernière fois dans la déclaration finale — mais elle n'existe que si le testament et le liquidateur le permettent, d'où l'intérêt de la préparer du vivant.

**Données requises** :
- état civil et âge du conjoint — _deja-au-dossier — demographie.etatCivil, demographie.conjoint.age_
- testament à jour et souplesse laissée au liquidateur — _deja-au-dossier — intentions.testamentAJour (oui/non/inconnu ; le contenu du testament reste impossible-automatique)_
- pertes en capital reportées du client — _deja-au-dossier — droits.pertesCapitalReportees_
- positions avec PBR (pour chiffrer ce qu'une renonciation partielle cristalliserait) — _deja-au-dossier — comptes[].positions[]_
- paliers fédéral + Québec (pour chiffrer l'espace de la déclaration finale) — _baremes-csv_
- ECGC déjà utilisée par le client (avis ARC/RQ) — _fiche-a-etendre — nouveau champ dans droits, source = avis de cotisation_

**Pièges** :
- Le délai de dévolution : le roulement 70(6) exige un transfert irrévocable dans les 36 mois du décès ; une succession qui traîne peut le perdre.
- La fiducie au profit du conjoint doit être EXCLUSIVE (tout le revenu au conjoint sa vie durant, personne d'autre ne touche capital ni revenu avant son décès), sinon pas de roulement.
- Le choix 70(6.2) est PAR BIEN, pas global — c'est ce qui permet le dosage fin, mais aussi ce qui exige un inventaire position par position avec PBR à jour : exactement ce que le profil porte déjà.
- La renonciation marche aussi sur un bien en PERTE (créer une perte dans la déclaration finale pour effacer d'autres revenus via 111(2)) — le miroir du cas gains.
- Minimiser l'impôt au premier décès n'est pas toujours optimal : rouler À 100 % gaspille les paliers et l'ECGC du défunt ; renoncer À 100 % surpaye. L'optimum est presque toujours partiel.
- Québec : l'harmonisation est générale mais les choix québécois se font séparément (Revenu Québec a ses propres formulaires post mortem) — un choix fédéral sans son pendant québécois crée une divergence de PBR entre les deux régimes.

**À valider par le fiscaliste** :
- La mécanique exacte du choix 70(6.2) (forme, délai de production, irrévocabilité) et son pendant québécois
- Le traitement des biens en copropriété conjoint-défunt et des comptes conjoints (Compte.titulaire = 'conjoint-commun')
- L'interaction entre renonciation partielle, ECGC du défunt et IMR dans l'année du décès (l'IMR ne s'applique pas à l'année du décès — à confirmer)

<sub>Sources : https://www.bdo.ca/fr-ca/insights/tax-considerations-following-the-loss-of-a-spouse-or-common-law-partner-part-ii · https://www.finance-investissement.com/zone-experts_/apff/planification-fiscale-post-mortem-entre-conjoints/ · https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/evenements-vie/faire-impots-personne-decedee/preparer-declarations/declarer-revenus/gains-capital.html · https://laws-lois.justice.gc.ca/fra/lois/I-3.3/section-111.html · https://www.conseiller.ca/magazine/compte-non-enregistre-au-deces-rouler-ou-ne-pas-rouler/</sub>

_Confiance : haute_

### Vente d'entreprise prévue — cristalliser le portefeuille AVANT l'année de la vente

**Déclencheur** : intentions.venteEntreprisePrevue = 'oui' (champ dormant déjà au schéma). Aussi pertinent pour tout événement à revenu massif ponctuel : vente d'immeuble locatif, gros retrait REER, indemnité de départ.

**Mécanique** : L'année de la vente, le produit imposable écrase tous les paliers : le client est au taux marginal maximal (53,31 % combiné au Québec en 2026, soit 26,65 % effectif sur gain en capital) dès le premier dollar de gain additionnel. Toute cristallisation de portefeuille faite CETTE année-là se paie donc au maximum. La règle s'inverse : dans les années qui PRÉCÈDENT la vente, les paliers inférieurs du client sont encore disponibles — c'est la dernière fenêtre pour récolter les gains latents du portefeuille au taux d'un revenu ordinaire, et pour vider les pertes reportées sur ce qui dépasse. Après la vente, la réserve de gains en capital (solde de prix de vente) permet d'étaler le gain de la vente elle-même sur un maximum de 5 ans (minimum 20 % du gain par année ; 10 ans à 10 %/an pour un transfert aux enfants de biens agricoles, de pêche ou d'actions AAPE) — un second levier de lissage, mais qui exige un vrai solde de prix de vente consenti à l'acheteur. Le moteur peut détecter dès aujourd'hui : venteEntreprisePrevue = oui + gains latents au dossier → constat « fenêtre pré-vente », avec chiffrage dès que les barèmes seront chargés.

**Données requises** :
- vente d'entreprise prévue (oui/non/inconnu) — _deja-au-dossier — intentions.venteEntreprisePrevue (souvent null → question de rencontre)_
- horizon de la vente (année visée) et ordre de grandeur du produit — _fiche-a-etendre — deux champs à ajouter à intentions_
- positions non enregistrées avec PBR — _deja-au-dossier — comptes[].positions[]_
- revenu imposable exact des années pré-vente — _fiche-a-etendre_
- paliers fédéral + Québec + paramètres IMR (exemption 181 440 $ en 2026, taux 20,5 %) — _baremes-csv_
- pertes reportées — _deja-au-dossier — droits.pertesCapitalReportees_

**Pièges** :
- L'IMR guette l'année de la vente : depuis 2024, les gains en capital comptent à 100 % dans l'assiette IMR (30 % pour les dons de titres cotés), taux fédéral de 20,5 %, exemption indexée (181 440 $ en 2026). L'IMR payé est récupérable sur 7 ans — mais seulement s'il reste de l'impôt régulier à venir : un retraité qui vend puis n'a plus de revenus peut ne jamais le récupérer.
- La récupération de la PSV pour un vendeur de 65 ans et plus : l'année de la vente peut effacer sa pension entière.
- Cristalliser « avant » exige de commencer 2-4 ans d'avance : une vente annoncée pour dans 6 mois n'offre plus de fenêtre — le moteur doit dater le constat.
- La réserve exige d'inclure au moins 20 % du gain par année (10 % pour les transferts admissibles aux enfants) : c'est un plancher, pas un choix libre.
- Le produit de vente reçu par une société de gestion (vente d'actifs, ou vente hybride) ne passe pas par les paliers personnels — le cas particulier/corpo se départage au dossier.

**À valider par le fiscaliste** :
- Le calcul IMR fédéral ET québécois (le Québec a son propre IMR harmonisé) sur un scénario type de vente
- Les paramètres exacts de la réserve (année de la vente, gain admissible, interaction avec l'ECGC sur la portion réservée)
- La règle de décision « combien cristalliser dans chaque année pré-vente » palier par palier

<sub>Sources : https://www.rcgt.com/fr/planiguide/modules/module-07-placements/gain-ou-perte-en-capital/ · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-120410.asp · https://groupedesmarais.com/planification-fiscale-reserve-pour-gains-en-capital/ · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/impot-minimum-remplacement/ · https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-fr.pdf · https://www.noovo.info/jour-de-paye/article/voici-combien-dimpots-vous-devrez-payer-au-federal-en-2026/ · https://cqff.com/wp-content/uploads/paliers_imposition_2026.pdf</sub>

_Confiance : haute_

### Impôt minimum de remplacement : le « gain à impôt nul » qui déclenche l'IMR

**Déclencheur** : Cristallisation importante absorbée par des pertes REPORTÉES (ligne 25300) chez un particulier — le cas exact que la stratégie 7 chiffre aujourd'hui sans plafond.

**Mécanique** : Depuis 2024, l'assiette de l'IMR fédéral inclut 100 % des gains en capital de l'année, mais les pertes en capital nettes REPORTÉES ne s'y déduisent qu'à 50 % ; exemption de base 173 205 $ (2024, indexée ensuite), taux fédéral 20,5 %. Le Québec s'est harmonisé avec ses propres paramètres (exemption 175 000 $, taux 19 % — combiné possible ~36 %). Conséquence : un gain entièrement absorbé par des pertes reportées au régime ordinaire (impôt régulier nul) laisse quand même ~50 % du gain dans l'assiette IMR ; au-delà de l'exemption, l'IMR frappe — ordre de grandeur : un gain cristallisé supérieur à environ 350 000 $ absorbé par des reportées peut déclencher l'IMR même sans autre revenu. L'IMR payé est récupérable sur 7 ans contre l'impôt régulier futur, mais c'est un décaissement réel l'année du geste — le « sans un dollar d'impôt » du texte actuel devient faux au-dessus du seuil.

**Données requises** :
- Exemptions et taux IMR fédéral + Québec, indexés pour l'année courante — _baremes-csv — config/parametres-fiscaux.csv à étendre_
- Autres revenus du client (la trancheRevenu du profil est trop grossière pour un calcul IMR exact, mais suffit pour un DRAPEAU) — _fiche-a-etendre_
- Ventilation pertes de l'année vs pertes reportées — _deja-au-dossier — transactionsAnnee et droits.pertesCapitalReportees_

**Pièges** :
- Les pertes de l'ANNÉE se compensent à 100 % dans l'assiette IMR (le net de l'année entre au complet) : absorber avec des pertes de l'année courante n'expose pas à l'IMR, absorber avec des REPORTÉES si — le mix change tout, et le moteur distingue déjà les deux sources.
- Règle moteur simple en attendant la modélisation : signaler tout plan dont le gain absorbé par des reportées dépasse un seuil paramétrable (p. ex. 150 000 $) avec la mention « IMR à vérifier ».
- Étaler la cristallisation sur plusieurs années civiles reste le remède standard.

**À valider par le fiscaliste** :
- Le traitement exact des pertes de l'année vs reportées dans l'assiette IMR fédérale et québécoise.
- Les montants d'exemption indexés 2026 (fédéral et Québec) à inscrire aux barèmes.
- Le seuil du drapeau automatique et la mécanique de récupération sur 7 ans.

<sub>Sources : https://www.pwc.com/ca/en/services/tax/publications/tax-insights/changes-alternative-minimum-tax-enacted-2024.html · https://www.ey.com/en_ca/technical/tax/tax-alerts/2023/tax-alert-2023-no-45 · https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-en.pdf · https://www.rcgt.com/fr/conseils/avis-d-experts/impot-minimum-remplacement-irm-changements-2024/ · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/impot-minimum-remplacement/</sub>

_Confiance : haute_

### Revenu net gonflé : récupération de la SV et programmes socio-fiscaux malgré l'« impôt nul »

**Déclencheur** : Client de 65 ans et plus (ou qui touche des prestations/crédits fondés sur le revenu) dont le plan est absorbé par des pertes REPORTÉES.

**Mécanique** : Le gain imposable entre au REVENU NET (lignes 23400/23600 fédéral ; ligne 275 au Québec). Les pertes reportées se déduisent APRÈS, au revenu IMPOSABLE (ligne 25300 fédéral ; ligne 290 Québec, via TP-729 et annexe N). Une cristallisation « à impôt nul » via pertes reportées gonfle donc le revenu net : récupération de la SV à 15 % au-delà de 95 323 $ (2026), SRG, crédit en raison de l'âge, crédit TPS, Allocation canadienne pour enfants ; au Québec : crédit d'impôt solidarité, prime au travail, contribution additionnelle de garde, prime du régime public d'assurance médicaments. EXCEPTION clé : les pertes de l'ANNÉE COURANTE se compensent à l'annexe 3 AVANT le revenu net — absorber avec des pertes de l'année ne gonfle PAS le revenu net. Le moteur distingue déjà les deux sources de pertes : il peut porter ce drapeau dès que l'âge est au dossier.

**Données requises** :
- Âge du client — _deja-au-dossier — demographie.age (nullable)_
- Seuil de récupération SV et seuils des programmes, année courante — _baremes-csv — à ajouter à config/parametres-fiscaux.csv_
- Statut SV/SRG et prestations réellement touchées — _fiche-a-etendre — question de rencontre_
- Ventilation pertes de l'année vs reportées — _deja-au-dossier_

**Pièges** :
- Pour un retraité près du seuil SV, la distinction inverse le conseil de calendrier : cristalliser les gains la MÊME année où des pertes sont réalisées (compensation avant revenu net) plutôt que de compter sur les reportées.
- Étaler sur deux années civiles (décembre/janvier) divise l'effet revenu net.
- La récupération SV se calcule par individu : déplacer des gains vers le conjoint sous le seuil n'est pas possible après coup — mais le choix des comptes (titulaire) AVANT la vente compte.
- Le drapeau doit sortir même si le montant exact n'est pas calculable : « ce plan gonfle votre revenu net de X $ ; votre pension SV peut être réduite » est vérifiable dès les barèmes chargés.

**À valider par le fiscaliste** :
- Le seuil SV 2026 exact (95 323 $ — sources secondaires convergentes, à confirmer sur canada.ca aux barèmes).
- La liste des programmes québécois sensibles au revenu net à intégrer.
- La règle « pertes de l'année avant revenu net / reportées après » telle qu'énoncée.

<sub>Sources : https://www.taxtips.ca/seniors/oas-clawback.htm · https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-25300-net-capital-losses-other-years.html · https://lifemoney.ca/blog/oas-clawback-2026-income-threshold · https://www.moneysense.ca/columns/ask-a-planner/how-to-avoid-oas-clawback-when-youve-had-a-temporary-increase-in-income/</sub>

_Confiance : haute_

### « Impôt nul » n'est pas « revenu net inchangé » — garde-fou prestations (SV, SRG, crédits)

**Déclencheur** : Cristallisation absorbée par des pertes REPORTÉES d'années passées, chez un client de 65 ans et plus (SV/SRG), de 60 ans et plus (Allocation), ou dont le ménage reçoit des prestations calculées sur le revenu net familial.

**Mécanique** : Les pertes d'autres années se déduisent au revenu IMPOSABLE (ligne 25300 fédéral), APRÈS le calcul du revenu net (lignes 23400/23600). Le gain cristallisé gonfle donc le revenu net même quand l'impôt est nul → récupération de la SV à 15 % au-dessus du seuil (93 454 $ pour le revenu 2025 ; seuil 2026 à confirmer), perte de SRG, de crédit TPS, d'allocations. Les pertes de la MÊME année, elles, se compensent à la ligne 12700, DANS le revenu net → aucun effet. Règle moteur : distinguer l'ORIGINE des pertes dans le calcul ET dans la phrase ; si âge ≥ 65 (ou âge inconnu) et que la cristallisation s'appuie sur des reportées : plafonner le montant proposé à (seuil SV − revenu net estimé) ÷ taux d'inclusion, ou dégrader en montant-a-confirmer si le revenu de l'année est inconnu. Le libellé actuel « sans un dollar d'impôt » du constat doit être qualifié pour ces clients.

**Données requises** :
- Origine des pertes : année courante vs reportées — _deja-au-dossier — transactionsAnnee vs droits.pertesCapitalReportees (déjà distinguées dans strategieCristallisationGains)_
- Âge du client — _deja-au-dossier — demographie.age_
- Seuil de récupération SV pour l'année de la vente — _baremes-csv — à ajouter (93 454 $ confirmé pour le revenu 2025 ; 2026 non publié dans mes sources)_
- Revenu net estimé de l'année (tous revenus : pensions, FERR, location...) — _impossible-automatique — à demander en rencontre, l'avis de cotisation ne donne que l'an passé_

**Pièges** :
- L'effet paraît avec 18 mois de décalage : le revenu de l'année N gouverne la SV de juillet N+1 à juin N+2 — le client ne relie pas la vente à la coupure.
- Le fractionnement de revenu de pension et les retraits FERR rendent l'estimation du revenu net hasardeuse — jamais d'estimation silencieuse.
- Au Québec, la même mécanique touche le revenu familial net (allocation famille, prime au travail, contribution garde) — liste exacte à faire valider.
- Étaler la cristallisation sur deux années civiles est souvent la parade — mais c'est un conseil, pas un calcul : proposer les deux scénarios, pas trancher.

**À valider par le fiscaliste** :
- Les seuils SV/SRG 2026 exacts
- La formule de plafonnement proposée
- La liste des prestations québécoises calculées sur le revenu (familial) net touchées par un gain « à impôt nul »

<sub>Sources : https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/sujets/tout-votre-declaration-revenus/declaration-revenus/remplir-declaration-revenus/deductions-credits-depenses/ligne-25300-pertes-capital-nettes-autres-annees/pertes-capital-nettes-autres-annees/pertes-capital-nettes-autres-annees-2.html · https://www.canadalife.com/fr/placement-epargne/retraite/les-regimes-de-retraite/securite-de-la-vieillesse/quest-ce-que-la-recuperation-de-la-sv.html</sub>

_Confiance : haute_

### Garde-fou « revenu de l'année inconnu » : ce que le moteur peut dire quand même, et où il se tait

**Déclencheur** : revenus.trancheRevenu est null, ou sa source est 'declare' (dit en rencontre, non documenté), ou sa dateDonnee est périmée.

**Mécanique** : La variante « à impôt nul par pertes » se chiffre SANS connaître le revenu — le plafond vient des pertes, pas des barèmes — elle reste donc permise, sous les garde-fous 5 (prestations) et 6 (IMR). Mais toute variante qui dépend du revenu est interdite de chiffre tant que le revenu n'est pas documenté : « cristalliser au bas palier » (année sabbatique, congé parental, retraite avant FERR), économies d'impôt en dollars, valeur du crédit de don, effet SV. Statut indisponible + question de rencontre « avis de cotisation ». Règle d'asymétrie à écrire dans le code : borner un DROIT par le haut est prudent (le plafond CELI le fait) ; borner une ÉCONOMIE par le haut est vendeur — pour les économies, jamais d'hypothèse de tranche par défaut, ni haute ni basse. C'est le miroir exact du principe existant « un droit surestimé coûte 1 %/mois » : une économie surestimée coûte la confiance du client et l'assurance responsabilité du conseiller.

**Données requises** :
- Tranche de revenu, sa source et sa date — _deja-au-dossier — revenus.trancheRevenu + source + dateDonnee_
- Barèmes d'imposition fédéral + Québec (pour la variante bas-palier, explicitement reportée par le commentaire de strategieCristallisationGains) — _baremes-csv — jamais ajoutés, sous verrou fiscaliste le jour où ils entrent_
- Règle de péremption d'une tranche déclarée (proposition : 12 mois) — _fiche-a-etendre — comparer dateDonnee à la date d'analyse_

**Pièges** :
- Une tranche déclarée en rencontre vieillit sans bruit — sans péremption, le moteur chiffrerait sur un revenu d'il y a trois ans.
- La variante bas-palier est celle qui touche les clients les plus fragiles (congé, invalidité, veuvage récent) : précisément ceux où les circonstances de vie (cas 10) commandent la retenue.
- Le bas palier interagit avec le SRG et les prestations (cas 5) : un « bas revenu » qui reçoit le SRG perd 50 cents par dollar de revenu net additionnel — le bas palier d'impôt n'est pas le bas palier EFFECTIF.

**À valider par le fiscaliste** :
- Les barèmes fédéral et Québec le jour de leur entrée au CSV
- La règle de péremption des données déclarées
- Le taux effectif marginal (impôt + prestations) par tranche — la vraie courbe, pas la courbe d'impôt

<sub>Sources : src/lib/profils/strategies.ts (commentaire « variante année à faible revenu ») — planificateur-rencontre · https://www.canadalife.com/fr/placement-epargne/retraite/les-regimes-de-retraite/securite-de-la-vieillesse/quest-ce-que-la-recuperation-de-la-sv.html</sub>

_Confiance : haute_

### Année à faible revenu — remplir les paliers du bas (« gain harvesting »)

**Déclencheur** : Revenu imposable temporairement bas (congé parental ou sabbatique, année de perte d'entreprise, retour aux études, première année de retraite avant les rentes) alors que des positions non enregistrées portent des gains latents. C'est exactement la variante que strategies.ts:383-386 réserve déjà : « la variante année à faible revenu exigera les barèmes fédéral + Québec dans parametres-fiscaux.csv ».

**Mécanique** : Le gain en capital est inclus à 50 % (taux confirmé : la hausse à 2/3 a été annulée le 21 mars 2025 et l'annulation confirmée au budget du 4 novembre 2025). En 2026, le premier palier fédéral est à 14 % jusqu'à ~58 523 $ et le premier palier Québec à 14 % jusqu'à ~53 255 $ ; les montants personnels de base (~16 4xx $ fédéral, 17 183 $ Québec) rendent même une tranche imposée à 0 %. Cristalliser juste assez de gain pour remplir l'espace restant sous un palier bas, racheter le jour même (la règle des 30 jours ne vise que les pertes — déjà documenté dans strategies.ts:379-381), et le PBR remonte : l'impôt futur au taux plein est remplacé par un impôt immédiat au taux plancher, parfois nul. Le plan de récolte par densité (planifierRecolte, strategies.ts:188-216) se réutilise tel quel — seule la cible change : au lieu de min(gains latents, pertes disponibles), c'est min(gains latents, 2 × espace de palier restant), le facteur 2 venant de l'inclusion à 50 %.

**Données requises** :
- Gains latents par position (PBR et valeur marchande) — _deja-au-dossier — Position.valeurComptable / valeurMarchande (types.ts:104-118), dérivés par hydraterProfil_
- Gains et pertes déjà réalisés dans l'année — _deja-au-dossier — transactionsAnnee (deriver.ts:115-136)_
- Barèmes fédéral + Québec 2026 et montants personnels de base — _baremes-csv — config/parametres-fiscaux.csv, lignes à ajouter (voir notes pour la convention)_
- Revenu imposable précis de l'année — _fiche-a-etendre — revenus.trancheRevenu existe (tranches de 50 k$, trop grossières pour viser un palier) ; une borne PRUDENTE est calculable dès maintenant avec le haut de la tranche, dans l'esprit maison « borner et le dire »_
- Province (le calcul suppose QC) — _fiche-a-etendre — l'API l'accepte déjà (fiche/route.ts:62-66), aucun contrôle à l'écran EcranFiscal.tsx_

**Pièges** :
- Le gain gonfle le revenu NET familial : il ampute l'Allocation canadienne pour enfants, l'Allocation famille QC, les crédits TPS/solidarité — pour une jeune famille, le taux effectif réel dépasse le taux d'impôt affiché.
- C'est la DATE DE RÈGLEMENT qui fixe l'année fiscale, pas la date de l'ordre (déjà écrit dans demarches.ts:65) — un ordre fin décembre peut se régler en janvier.
- Un très gros gain peut être étalé sur deux années civiles (une vente en décembre, une en janvier) pour remplir deux fois les paliers bas — mécanique à offrir dans le même constat.
- L'abattement Québec de 16,5 % sur l'impôt fédéral de base complique un calcul « à la main » : les barèmes doivent être appliqués par un module testé, pas improvisés dans une explication.
- Le champ trancheRevenu porte sa source (declare/document, fiche/route.ts:106) : un revenu « dit en rencontre » ne devrait produire qu'un montant-a-confirmer.

**À valider par le fiscaliste** :
- Les bornes exactes des paliers 2026 (fédéral 58 523 $ / Québec 53 255 $) et les montants personnels de base — sources secondaires, à confronter aux tables ARC/Revenu Québec avant toute entrée au CSV.
- La règle de calcul « espace de palier × 2 = gain cristallisable » et son interaction avec les crédits non remboursables.
- Le traitement de l'abattement du Québec dans le taux marginal affiché.

<sub>Sources : https://www.canada.ca/fr/agence-revenu/nouvelles/salle-presse/conseils-fiscaux/conseils-fiscaux-2025/mise-jour-administration-arc-changements-proposes-taux-inclusion-gains-capital.html · https://www.fidelity.ca/fr/insights/articles/canadian-income-tax-brackets/ · https://cqff.com/wp-content/uploads/paliers_imposition_2026.pdf · https://www.wealthsimple.com/fr-ca/learn/quebec-tax-brackets</sub>

_Confiance : haute_

### Fenêtre 60-64 ans — cristalliser avant la PSV et le SRG

**Déclencheur** : Client retraité ou proche de la retraite, avant 65 ans (ou avant la conversion FERR obligatoire à 71 ans) : revenu bas ET aucune prestation encore récupérable. Détectable avec demographie.age (déjà à la fiche) et intentions.ageRetraiteVise (API prête, écran absent).

**Mécanique** : À partir de 65 ans, chaque 1 000 $ de gain cristallisé = 500 $ de revenu net, qui déclenche 15 % de récupération de la PSV au-delà du seuil (~95 323 $ pour 2026, récupération complète vers 152 062 $) et fait fondre le SRG de 50 ¢ par dollar de revenu pour une personne seule (25 ¢/1 $ pour un couple deux-PSV). Vider les gains latents AVANT la période PSV/SRG — pendant les années creuses entre le dernier salaire et les rentes — paie l'impôt au palier bas d'aujourd'hui et protège les prestations de demain. C'est le même moteur que le cas « année à faible revenu », avec un déclencheur d'âge et un plafond additionnel : ne pas dépasser le seuil de récupération dans les années où la PSV est versée.

**Données requises** :
- Âge du client — _deja-au-dossier — demographie.age (EcranFiscal.tsx:540-541)_
- Âge de retraite visé — _fiche-a-etendre — intentions.ageRetraiteVise accepté par l'API (fiche/route.ts:127-131), aucun contrôle à l'écran_
- Seuil de récupération PSV et paramètres SRG de l'année — _baremes-csv — à ajouter (ex. seuil-psv-recuperation,2026,CA,95323,a-confirmer)_
- Gains latents par position — _deja-au-dossier — Position.valeurComptable/valeurMarchande_
- Revenu imposable précis — _fiche-a-etendre — même limite de tranche que le cas précédent_

**Pièges** :
- La période de récupération PSV juillet-juin se fonde sur le revenu de l'ANNÉE CIVILE PRÉCÉDENTE : un gros gain cristallisé à 64 ans peut récupérer la PSV versée à 65-66 ans — la fenêtre se ferme un an plus tôt qu'on pense.
- Le SRG est plus punitif que l'impôt (50 % de réduction) : pour un client à faible revenu, NE PAS cristalliser pendant les années SRG est souvent le conseil, et le devancement est la solution.
- Le seuil PSV est INDIVIDUEL (revenu net personnel), pas familial — la répartition des ventes entre conjoints compte, mais attention à l'attribution (74.2) si les titres ont été financés par l'autre conjoint.

**À valider par le fiscaliste** :
- Le seuil 2026 exact (95 323 $ relevé de sources secondaires) et la mécanique période-de-versement vs année-de-revenu.
- L'arbitrage report-de-PSV-à-70 vs cristallisation anticipée — hors de portée d'une règle automatique, mais le fiscaliste doit cadrer ce que le constat a le droit de dire.

<sub>Sources : https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html · https://francais.chip.ca/ressources/mode-de-vie/recuperation-prestation-vieillesse-oas-2026/ · https://www.wealthsimple.com/fr-ca/learn/guaranteed-income-supplement-explained</sub>

_Confiance : haute_

### Lissage successoral — devancer la disposition réputée au décès

**Déclencheur** : Client âgé, gains latents importants, et PAS de conjoint survivant à qui rouler (célibataire, veuf, divorcé — demographie.etatCivil déjà à la fiche). Le champ intentions.testamentAJour (dormant) est la porte d'entrée naturelle de la conversation.

**Mécanique** : Au décès, tous les biens en immobilisation sont réputés disposés à la JVM (paragraphe 70(5) LIR) : la totalité du gain latent tombe dans UNE seule déclaration finale, presque entièrement au taux marginal maximal (53,31 % au Québec au-delà de ~258 482 $ en 2026). Cristalliser chaque année, de son vivant, la tranche de gain qui se loge sous un palier inférieur répartit le même gain sur plusieurs années à taux moindre — c'est le cas 1 répété, avec un horizon successoral comme motif. Le roulement au conjoint (70(6)) reporte tout : tant qu'il y a un conjoint survivant probable, l'urgence disparaît et le constat doit le dire.

**Données requises** :
- Âge et état civil — _deja-au-dossier — demographie.age / etatCivil_
- Gains latents par position — _deja-au-dossier_
- Barèmes (pour dimensionner la tranche annuelle) — _baremes-csv_
- Testament à jour / intentions successorales — _fiche-a-etendre — intentions.testamentAJour accepté par l'API (fiche/route.ts:132-139), écran absent_
- Horizon (état de santé, espérance) — _impossible-automatique — jugement du planificateur, jamais un champ_

**Pièges** :
- Devancer l'impôt a un coût de renonciation : le report est en soi une valeur ; la règle ne devrait proposer que ce qui se loge sous les paliers BAS, jamais une liquidation.
- Le don de titres en nature au décès ou de son vivant (stratégie 4 existante) reste supérieur à toute cristallisation quand le client donne déjà : inclusion à 0 % ET reçu à la pleine valeur.
- Le roulement au conjoint inverse le conseil : cristalliser avant le décès du PREMIER conjoint gaspille des paliers si tout roule de toute façon.
- La résidence principale et les biens hors relevés Croesus dominent souvent la facture successorale — le constat ne voit que le portefeuille et doit le déclarer (limiteVisibilite).

**À valider par le fiscaliste** :
- Le cadrage complet 70(5)/70(6) et la formulation client d'un sujet délicat (le décès) — le ton relève du planificateur, la règle du fiscaliste.
- L'interaction avec les pertes reportées au décès et la déclaration de droits ou biens.

<sub>Sources : https://laws-lois.justice.gc.ca/fra/lois/i-3.3/section-70-20170101.html · https://www.thomsonreuters.ca/fr/suiteprofessionnelledt/blogue/implications-fiscales-deces.html</sub>

_Confiance : haute_

### Garde-fou IMR — plafonner la cristallisation « à impôt nul » existante

**Déclencheur** : Pas un nouveau cas : une CORRECTION de la stratégie cristallisation-gains actuelle, dès que le montant cristallisé contre des PERTES REPORTÉES devient grand. « À impôt nul » n'est vrai qu'en impôt régulier.

**Mécanique** : Depuis 2024, l'impôt minimum de remplacement inclut 100 % des gains en capital dans son assiette, mais ne permet la déduction des pertes en capital nettes REPORTÉES d'autres années qu'à 50 %. Exemple : cristalliser 500 000 $ de gains entièrement absorbés par 500 000 $ de pertes reportées donne 0 $ d'impôt régulier, mais une assiette IMR de 500 000 − 250 000 = 250 000 $, au-dessus de l'exemption fédérale (~178 k$ en 2025, indexée pour 2026) → IMR fédéral à 20,5 % sur l'excédent, plus l'IMR québécois harmonisé (taux 19 %, ses propres paramètres). L'IMR est récupérable sur 7 ans, mais seulement si l'impôt régulier futur le permet. Règle automatique proposée : quand montantEstime dépasse environ deux fois l'exemption IMR, dégrader le constat en montant-a-confirmer avec la mention IMR, ou plafonner le plan de récolte à la zone sûre.

**Données requises** :
- Montant cristallisé contre pertes REPORTÉES vs pertes de l'année — _deja-au-dossier — strategies.ts:432-437 distingue déjà perteNetteAnnee et reportees ; la restriction IMR à 50 % ne vise que les reportées_
- Exemption et taux IMR fédéral + Québec de l'année — _baremes-csv — imr-exemption-federale / imr-taux-federal / imr-exemption-qc / imr-taux-qc, source a-confirmer_
- Autres éléments de l'assiette IMR du client (dons, DGC, frais financiers) — _impossible-automatique — le garde-fou doit rester une borne prudente, pas un calcul d'IMR complet_

**Pièges** :
- Les pertes de l'ANNÉE nettes contre les gains de l'année ne subissent pas la restriction de 50 % (c'est le report, 111(1)b), qui est limité) — le seuil du garde-fou ne doit compter que la portion « reportées ». À faire confirmer, c'est le point technique le plus fin du cas.
- L'exemption IMR est INDIVIDUELLE et annuelle : étaler la cristallisation sur deux ou trois ans (les pertes reportées ne périment pas — déjà écrit dans strategies.ts:499) fait souvent disparaître l'IMR entièrement.
- Le montant exact de l'exemption 2026 n'était pas publié dans les sources consultées (173 205 $ en 2024, 177 882 $ en 2025, indexée) — entrer la valeur 2026 au CSV seulement une fois confirmée ARC.

**À valider par le fiscaliste** :
- Le traitement IMR exact des pertes de l'année courante vs reportées (assiette : gains 100 %, report 111(1)b) à 50 %).
- Les paramètres IMR Québec 2026 (taux 19 %, exemption propre) et le mécanisme de report sur 7 ans dans les deux régimes.
- Le seuil de déclenchement du garde-fou et sa formulation dans le constat.

<sub>Sources : https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-fr.pdf · https://www.pwc.com/ca/fr/services/tax/publications/tax-insights/changes-alternative-minimum-tax-enacted-2024.html · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/impot-minimum-remplacement/ · https://www.finance-investissement.com/zone-experts_/apff/impot-minimum-de-remplacement/</sub>

_Confiance : haute_

---

## Calculables AVEC DE NOUVELLES DONNÉES — la fiche ou le dossier à étendre (24)

### Année à faible revenu — cristalliser au bas palier

**Déclencheur** : Le revenu imposable de l'année est anormalement bas : sabbatique, retour aux études, entre deux emplois, semi-retraite, année de transition. Détectable si la fiche portait le revenu estimé de l'année courante (la tranche 50 k$ actuelle est trop grossière).

**Mécanique** : Le gain en capital est imposable à 50 % (taux d'inclusion maintenu — la hausse à 66,67 % a été annulée le 21 mars 2025, confirmé au Budget 2025). Réaliser le gain dans une année où le revenu imposable reste sous le 1er palier coûte ~12,8 % combiné sur le gain (féd. 14 % × 0,835 d'abattement QC + QC 14 %, × 50 % d'inclusion) contre ~26,7 % au taux maximal — près de 14 points d'écart. Paliers 2026 : fédéral 14 % ≤ 58 523 $, 20,5 % ≤ 117 045 $, 26 % ≤ 181 440 $, 29 % ≤ 258 482 $, 33 % au-delà ; Québec 14 % ≤ 54 345 $, 19 % ≤ 108 680 $, 24 % ≤ 132 245 $, 25,75 % au-delà. Vendre-racheter le jour même est permis : la règle des 30 jours (perte apparente) ne vise que les pertes. Le PBR remonte, ce qui réduit l'impôt de toute vente future.

**Données requises** :
- Revenu imposable estimé de l'année courante (précis, pas en bande de 50 k$) — _fiche-a-etendre — `revenus.trancheRevenu` (types.ts) n'existe qu'en bandes 0-50k/50-100k... qui chevauchent les paliers (58 523 $ tombe au milieu de la bande 50-100k)_
- Motif de l'année creuse (sabbatique, transition, etc.) — _fiche-a-etendre — aucun champ « situation de l'année » dans le schéma actuel_
- Paliers et taux fédéral + Québec 2026, abattement 16,5 % — _baremes-csv — config/parametres-fiscaux.csv (absent du dépôt ; lecteur prêt dans src/lib/profils/parametres-fiscaux.ts, format parametre,annee,juridiction,valeur,source)_
- Gains latents par position (PBR) — _deja-au-dossier — Position.valeurMarchande/valeurComptable + planifierRecolte() dans strategies.ts_

**Pièges** :
- Le gain IMPOSABLE gonfle le revenu net (ligne 23600) : même à bas taux d'impôt, il érode les prestations fondées sur le revenu (ACE, crédit solidarité, TPS) — l'année « pauvre » est souvent celle où ces prestations sont les plus grosses.
- Ne jamais compter le taux fédéral sans l'abattement du Québec de 16,5 %.
- Les frais de transaction et l'écart achat-vente rongent un avantage calculé en points de pourcentage.
- Comptes 'corpo' : positionsNonEnregistrees() les met dans le même panier que le non-enregistré — leurs gains sont imposés DANS la société, pas aux paliers personnels ; à exclure de ce cas.

**À valider par le fiscaliste** :
- Les seuils/taux 2026 saisis au CSV (fédéral indexé 2,0 %, Québec 2,05 %)
- Le traitement de l'abattement du Québec dans la formule
- La règle de décision « remplir jusqu'au sommet du palier X » : quel palier viser selon le profil

<sub>Sources : https://www.taxtips.ca/taxrates/canada.htm · https://paycheckguru.com/2026-federal-tax-brackets-canada/ · https://calculqc.ca/blog/fiscalite/paliers-imposition-quebec-2026.html · https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/finances/publications-adm/parametres/AUTFR_RegimeImpot2026.pdf · https://enrichedthinking.scotiawealthmanagement.com/2025/04/07/cancellation-of-the-proposed-capital-gains-inclusion-rate-increase/ · https://www.canada.ca/en/department-finance/news/2024/06/fair-and-predictable-capital-gains-taxation.htm</sub>

_Confiance : haute_

### Année à revenu quasi nul — la zone à impôt zéro des crédits personnels

**Déclencheur** : Une année où le client (ou un client retraité vivant de son CELI/capital) n'a pratiquement aucun revenu imposable. Les montants personnels de base sont « à prendre ou à perdre » chaque année : sans revenu, ils se perdent.

**Mécanique** : Avec 0 $ d'autre revenu, jusqu'à ~32 904 $ de gain BRUT (2 × MPB fédéral 16 452 $, inclusion 50 %) ne génère AUCUN impôt fédéral, et jusqu'à ~37 904 $ (2 × MPB Québec 18 952 $) aucun impôt du Québec — sans consommer une seule perte reportée. C'est le seul cas où cristalliser à impôt nul ne dépend d'aucune perte : les crédits personnels inutilisés font le travail. Miroir direct de la stratégie 7 existante, mais avec une autre « réserve d'absorption ».

**Données requises** :
- Confirmation que le revenu de l'année est quasi nul (et lequel : emploi, pension, PSV…) — _fiche-a-etendre — la bande '0-50k' de revenus.trancheRevenu ne distingue pas 0 $ de 49 000 $_
- MPB fédéral et Québec 2026 — _baremes-csv — lignes mpb-fed / mpb-qc à créer dans config/parametres-fiscaux.csv_
- Gains latents (PBR) — _deja-au-dossier — Position.valeurComptable_

**Pièges** :
- « Impôt zéro » ne veut pas dire « effet zéro » : le revenu net monte quand même — ACE, solidarité, SRG, allocation-logement peuvent baisser.
- Si l'argent qui a acheté les titres venait du conjoint, les règles d'attribution (art. 74.2 LIR) rapatrient le gain chez le conjoint prêteur — ne pas « déplacer » le gain vers le conjoint sans revenu.
- Le MPB fédéral bonifié s'érode entre 181 440 $ et 258 482 $ de revenu net (min. 14 829 $) — sans impact ici, mais la formule du CSV doit le savoir.
- Autres crédits perdus la même année (montant en raison de l'âge, crédit pension) changent le plafond exact de la zone zéro.

**À valider par le fiscaliste** :
- Le calcul exact de la zone zéro avec TOUS les crédits du client (âge, pension, vivant seul QC)
- MPB 2026 : 16 452 $ féd. / 18 952 $ QC
- La lecture des règles d'attribution avant tout conseil impliquant le conjoint

<sub>Sources : https://www.taxtips.ca/taxrates/canada.htm · https://calculqc.ca/blog/fiscalite/paliers-imposition-quebec-2026.html · https://www.quebec.ca/nouvelles/actualites/details/indexation-des-parametres-du-regime-dimposition-des-particuliers-des-prestations-dassistance-sociale-et-de-certains-tarifs-gouvernementaux-pour-lannee-dimposition-2026-67248</sub>

_Confiance : haute_

### Le trou avant la retraite — la fenêtre pré-PSV / pré-FERR

**Déclencheur** : Client qui cesse de travailler avant 65 ans : entre la fin du salaire et le début de la PSV (65) puis des retraits FERR obligatoires (l'année des 72 ans), le revenu imposable passe par un creux — souvent les années les moins imposées de toute la vie. Déclencheur détectable AUJOURD'HUI : demographie.age + intentions.ageRetraiteVise sont au dossier.

**Mécanique** : Cristalliser les gains latents pendant ces années creuses : (1) profite des bas paliers ; (2) surtout, purge les gains AVANT que le revenu net devienne surveillé par la récupération PSV (seuil 95 323 $ pour le revenu 2026) et avant que les retraits FERR gonflent le plancher de revenu. Un gain reporté après 65 ans peut coûter 15 % de récupération PSV EN PLUS de l'impôt. Reporter la PSV à 70 allonge la fenêtre de purge de 5 ans.

**Données requises** :
- Âge du client — _deja-au-dossier — demographie.age_
- Âge de retraite visé — _deja-au-dossier — intentions.ageRetraiteVise_
- Revenus projetés des années de la fenêtre (RRQ commencée ? pension d'employeur ?) — _fiche-a-etendre — aucun champ prestations/pensions dans le schéma_
- Paliers 2026 + seuil de récupération PSV — _baremes-csv — lignes palier-* et seuil-psv à créer_

**Pièges** :
- Cristalliser dans la fenêtre entre en concurrence avec les « fontes REER » (retraits REER anticipés) qui visent la même fenêtre — l'ordre optimal entre les deux est un vrai arbitrage de planification.
- Si la PSV est reportée à 70, le seuil de récupération ne s'applique qu'aux années où la PSV est effectivement versée.
- Le RRQ anticipé à 60 remplit déjà une partie de la fenêtre.
- Un très gros gain unique dans la fenêtre peut réveiller l'IMR (voir le cas IMR).

**À valider par le fiscaliste** :
- L'arbitrage cristallisation vs retraits REER dans la même fenêtre
- Le seuil PSV 2026 (95 323 $) et la mécanique période de paiement (juillet 2027–juin 2028 pour le revenu 2026)
- L'âge FERR (conversion au 31 décembre des 71 ans, retraits dès l'année des 72 ans)

<sub>Sources : https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html · https://www.financialtools.ca/blog/blog-fr-recuperation-sv-2026-seuil-strategies.html · https://bkhfinance.ca/blog/recuperation-psv-securite-vieillesse-quebec-2026</sub>

_Confiance : haute_

### Année de perte d'entreprise ou de perte locative

**Déclencheur** : Travailleur autonome ou propriétaire dont l'entreprise/l'immeuble affiche une perte cette année : la perte autre qu'en capital est déductible contre TOUT revenu, y compris le gain en capital imposable, et le revenu imposable de l'année tombe au plancher.

**Mécanique** : Deux effets cumulés : (1) l'année est de facto une année à bas palier — cristalliser remplit les tranches à 14 % ; (2) une perte d'entreprise assez grosse pour annuler tout le revenu ferait perdre les crédits non remboursables de l'année (MPB…) — cristalliser des gains « consomme » la perte à hauteur du revenu qu'elle efface et sauve ces crédits. La perte autre qu'en capital non utilisée se reporte 20 ans en avant / 3 ans en arrière : il n'y a donc pas d'urgence mécanique, c'est un arbitrage taux-aujourd'hui vs taux-futur.

**Données requises** :
- Existence et ampleur de la perte d'entreprise/locative de l'année — _fiche-a-etendre — aucun champ ; question de rencontre (l'avis de cotisation et les états de l'entreprise sont les sources)_
- Paliers 2026 — _baremes-csv_
- Gains latents — _deja-au-dossier_

**Pièges** :
- Piège central : brûler à 14 % une perte reportable qui aurait effacé du revenu à 53,3 % dans 2 ans est une DESTRUCTION de valeur — le cas ne vaut que si aucun revenu élevé n'est prévisible dans l'horizon de report.
- Ne pas confondre perte d'entreprise (autre qu'en capital, déductible contre tout) et perte en capital (déductible contre gains seulement) — la stratégie 7 existante ne traite que la seconde.
- PDTPE (perte au titre d'un placement d'entreprise) : régime distinct, à ne pas mélanger.

**À valider par le fiscaliste** :
- La règle d'arbitrage consommer-maintenant vs reporter (quel écart de taux justifie d'attendre)
- Les périodes de report des pertes autres qu'en capital (20 ans avant / 3 ans arrière) — non vérifiées à la source dans cette exploration
- L'interaction avec l'acompte provisionnel de l'année

<sub>Sources : https://www.rcgt.com/fr/planiguide/modules/module-07-placements/gain-ou-perte-en-capital/ · https://www.taxtips.ca/taxrates/canada.htm</sub>

_Confiance : moyenne_

### Congé parental (RQAP) — bas palier, mais prestations familiales en jeu

**Déclencheur** : Client ou conjoint en congé parental : les prestations RQAP (imposables, plafonnées à 55-75 % d'un maximum assurable de 103 000 $ en 2026) remplacent le salaire — le revenu imposable individuel chute, souvent d'un ou deux paliers.

**Mécanique** : L'année du congé (surtout si le congé chevauche une année civile complète) est une année à bas taux marginal : cristalliser au taux réduit. MAIS c'est le cas où le « taux caché » des prestations familiales est le plus fort : l'ACE (juillet 2026–juin 2027 : maximum 8 157 $ par enfant de moins de 6 ans, réduction dès 38 237 $ de revenu familial net rajusté, 2e taux au-delà de 82 847 $) et l'Allocation famille du Québec se calculent sur le revenu FAMILIAL net — le gain imposable les ampute directement, au moment précis où la famille les touche à plein.

**Données requises** :
- Congé parental en cours ou prévu (et pour quelle année civile) — _fiche-a-etendre — aucun champ ; question de rencontre_
- Revenu familial net rajusté estimé (les DEUX conjoints) — _fiche-a-etendre — demographie.conjoint.trancheRevenu existe mais en bandes_
- Enfants à charge (tous — pas seulement les bénéficiaires REEE) — _fiche-a-etendre — demographie.enfants ne liste que les bénéficiaires REEE_
- Seuils et taux ACE / Allocation famille — _baremes-csv — à ajouter (ace-seuil-1, ace-seuil-2, taux par nombre d'enfants)_

**Pièges** :
- Le taux marginal EFFECTIF (impôt + perte d'ACE jusqu'à ~13,5 % et plus selon le nombre d'enfants + Allocation famille + solidarité) peut dépasser le taux d'une année normale : le calcul doit intégrer les prestations, sinon il recommande le contraire de l'optimal.
- L'ACE de juillet N+1 à juin N+2 dépend du revenu de l'année N : l'effet du gain arrive avec un an de décalage.
- Les taux de réduction exacts de l'ACE par nombre d'enfants n'ont pas été vérifiés un à un dans cette exploration.

**À valider par le fiscaliste** :
- La table complète des taux de réduction ACE et Allocation famille QC 2026-2027
- La règle de décision : à partir de quel gain le « taux effectif famille » dépasse le taux d'une année normale

<sub>Sources : https://atlasquebec.ca/guides/rqap-conge-parental-quebec-2026 · https://catax.tools/ccb-calculator/ · https://calculqc.ca/blog/famille/allocation-famille-quebec-montants.html · https://immigrationnewscanada.ca/new-canada-child-benefit-payment-jul-2026/</sub>

_Confiance : moyenne_

### Invalidité ou arrêt de travail prolongé

**Déclencheur** : Client en invalidité : si les primes de l'assurance salaire étaient payées par l'employé, les prestations sont NON imposables et le revenu imposable tombe près de zéro ; même imposables (rente RRQ d'invalidité, régime payé par l'employeur), elles restent bien sous le salaire.

**Mécanique** : Année(s) à revenu imposable plancher → cristalliser aux bas paliers, voire dans la zone à impôt zéro des crédits personnels (cas 2). Une invalidité longue crée plusieurs années creuses consécutives : combiner avec le lissage (cas 7) plutôt que tout cristalliser d'un coup.

**Données requises** :
- Statut d'invalidité et nature (imposable ou non) des prestations — _fiche-a-etendre — aucun champ ; question de rencontre délicate_
- Revenu imposable estimé — _fiche-a-etendre_
- Paliers + MPB — _baremes-csv_

**Pièges** :
- Le caractère imposable des prestations dépend du contrat (qui payait les primes) — indéterminable automatiquement.
- Des programmes fondés sur le revenu (crédit solidarité, allocation-logement, aide sociale le cas échéant) peuvent être touchés par le revenu net gonflé.
- Le crédit d'impôt pour personnes handicapées et le supplément ne sont pas affectés par le revenu du client lui-même, mais les suppléments familiaux peuvent l'être.
- Sensibilité humaine : le moteur peut détecter, mais la présentation au client appartient au planificateur (principe déjà inscrit dans SelectionStrategies).

**À valider par le fiscaliste** :
- La liste des prestations d'invalidité imposables vs non imposables (RRQ invalidité, CNESST, régimes privés)
- Les programmes québécois sensibles au revenu net à inscrire dans la carte des seuils

<sub>Sources : https://www.taxtips.ca/taxrates/canada.htm · https://calculqc.ca/blog/fiscalite/paliers-imposition-quebec-2026.html</sub>

_Confiance : faible_

### Lissage pluriannuel — remplir chaque année jusqu'au sommet d'un palier

**Déclencheur** : Portefeuille non enregistré portant un gros gain latent qui devra sortir un jour (rééquilibrage, décaissement, position concentrée) chez un client dont le revenu annuel laisse de la place dans un palier bas.

**Mécanique** : Au lieu d'un gain de 300 000 $ en une année (dont une large part au-delà de 132 245 $ QC / 181 440 $ féd., à ~25 %+ sur le gain), réaliser chaque année la tranche de gain qui remplit exactement le palier courant du client. Chaque cristallisation remonte le PBR — l'impôt total sur la même appréciation est structurellement plus bas, et le risque IMR disparaît. La progressivité des paliers est le seul mécanisme en jeu : vérifiée dans les barèmes 2026. Le plan de récolte existant (planifierRecolte, densité de gain) fournit déjà QUOI vendre ; il manque le COMBIEN par année.

**Données requises** :
- Revenu imposable annuel récurrent du client (précis) — _fiche-a-etendre_
- Paliers 2026 (et projection des années suivantes = mêmes seuils indexés) — _baremes-csv_
- Gains latents et plan de récolte — _deja-au-dossier — planifierRecolte() réutilisable tel quel avec une cible « place restante dans le palier »_
- Revenus des années FUTURES — _impossible-automatique — projection, hypothèses du planificateur_

**Pièges** :
- Le lissage étale AUSSI l'érosion des prestations sur plusieurs années : pour un client PSV, 5 années à +20 000 $ de revenu net peuvent coûter plus de récupération totale qu'une seule grosse année déjà au-delà de la zone de récupération (au-dessus de ~154 000 $ la PSV est déjà toute récupérée — le dollar suivant ne coûte plus rien en PSV). Le sens optimal s'inverse selon le niveau.
- Frais de transaction annuels récurrents.
- Risque de marché : le gain latent d'aujourd'hui n'attend pas — le lissage parie que le titre tient.
- Chaque année de lissage doit re-vérifier les pertes disponibles : la stratégie 7 existante (absorption à impôt nul) passe TOUJOURS en premier.

**À valider par le fiscaliste** :
- La règle du « palier cible » (sommet du 1er ? du 2e ? selon le patrimoine)
- L'ordre de priorité entre absorption par pertes (stratégie 7), lissage, et seuils sociaux
- L'hypothèse d'indexation ~2 %/an pour projeter les paliers futurs

<sub>Sources : https://www.taxtips.ca/taxrates/canada.htm · https://calculqc.ca/blog/fiscalite/paliers-imposition-quebec-2026.html</sub>

_Confiance : haute_

### Récupération de la PSV — cristalliser sous le seuil, ou hors des années PSV

**Déclencheur** : Client de 65 ans et plus recevant la PSV (ou 64 ans : dernière année « libre »), dont le revenu net approche 95 323 $ (revenu 2026). demographie.age est au dossier — le déclencheur d'âge est détectable aujourd'hui.

**Mécanique** : La PSV est récupérée à 15 % de chaque dollar de revenu net au-delà du seuil (revenu 2026 : 95 323 $ ; revenu 2025 : 93 454 $ ; récupération appliquée sur les versements de juillet 2027 à juin 2028 pour le revenu 2026). Le gain imposable (50 % du gain) entre dans ce revenu net. Trois règles en découlent : (1) sous le seuil, cristalliser jusqu'à la place restante ((seuil − revenu net) × 2 en gain brut) sans toucher la PSV ; (2) dans la zone de récupération (~95 000–154 000 $), chaque dollar de gain imposable coûte impôt + 15 ¢ — zone à ÉVITER, lisser en dessous ou concentrer au-dessus ; (3) au-delà de la borne d'élimination (revenu 2025 : ~151 668 $ à 65-74 ans / 157 490 $ à 75+ ; 2026 à confirmer), la PSV est déjà toute perdue — le dollar suivant ne coûte plus que l'impôt : paradoxalement, une année déjà « brûlée » est une bonne année pour concentrer un gros gain.

**Données requises** :
- Âge — _deja-au-dossier — demographie.age_
- PSV en versement (oui/non/reportée à 70) — _fiche-a-etendre — aucun champ prestations_
- Revenu net estimé de l'année — _fiche-a-etendre_
- Seuil (95 323 $), taux (15 %), bornes d'élimination 65-74/75+ — _baremes-csv — lignes seuil-psv, taux-recuperation-psv, psv-elimination-65-74, psv-elimination-75 à créer_

**Pièges** :
- PIÈGE MAJEUR sur la stratégie 7 existante : les pertes en capital REPORTÉES se déduisent à la ligne 25300 (revenu imposable), APRÈS le revenu net — une cristallisation « à impôt nul » par pertes reportées gonfle quand même le revenu net et déclenche la récupération. Seules les pertes de l'ANNÉE (nettes à la ligne 12700) protègent le revenu net.
- La récupération se fait par retenue sur les versements de juillet à juin suivant : l'effet de trésorerie arrive décalé.
- Les bornes d'élimination dépendent des taux PSV trimestriels (indexés) — celles du revenu 2026 ne sont pas encore fixées.

**À valider par le fiscaliste** :
- Seuil 95 323 $ (revenu 2026) et bornes d'élimination 2026
- La confirmation ligne par ligne que les pertes reportées ne réduisent pas le revenu net aux fins de la récupération
- La stratégie « concentrer au-delà de la borne » (agressive — à encadrer)

<sub>Sources : https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html · https://www.financialtools.ca/blog/blog-fr-recuperation-sv-2026-seuil-strategies.html · https://bkhfinance.ca/blog/recuperation-psv-securite-vieillesse-quebec-2026 · https://www.taxtips.ca/seniors/guaranteed-income-supplement.htm</sub>

_Confiance : haute_

### SRG — le seuil social le plus violent : cristalliser AVANT la première année de SRG

**Déclencheur** : Client modeste approchant 65 ans qui recevra le SRG, ou déjà prestataire, et qui détient un non-enregistré avec gains latents. Le SRG de juillet N à juin N+1 se calcule sur le revenu de l'année N-1.

**Mécanique** : Le SRG (maximum ~1 123 $/mois pour un célibataire, trimestre juillet-septembre 2026, coupure ~22 800 $ de revenu hors PSV) est réduit de 50 ¢ (jusqu'à 75 ¢ dans certaines plages avec la surprestation) par dollar de revenu. Le gain imposable compte INTÉGRALEMENT : l'exemption de 5 000 $ + 50 % des 10 000 $ suivants ne vise que le revenu d'emploi/autonome, jamais les gains en capital. Un seul gain de 45 600 $ (22 800 $ imposable) peut effacer TOUT le SRG d'une année. Règle d'or : purger les gains latents au plus tard l'année des 63 ans (le revenu de l'année des 64 ans détermine le SRG des premiers versements à 65) — après, chaque dollar de gain imposable coûte 50-75 ¢ de SRG en plus de l'impôt.

**Données requises** :
- Âge — _deja-au-dossier — demographie.age_
- SRG en versement ou probable (revenu de retraite projeté sous ~22 800 $) — _fiche-a-etendre_
- Revenu net estimé (client + conjoint — le SRG est familial) — _fiche-a-etendre_
- Seuils SRG trimestriels et taux de réduction — _baremes-csv — mise à jour TRIMESTRIELLE, pas annuelle_

**Pièges** :
- Comme pour la PSV : le revenu aux fins du SRG se calcule AVANT les pertes reportées — la cristallisation « à impôt nul » de la stratégie 7 détruit le SRG quand même.
- Taux effectif possible > 100 % : 50-75 ¢ de SRG + impôt + érosion du crédit solidarité et de l'allocation-logement sur le même dollar.
- Les seuils SRG bougent chaque trimestre (indexation) — le CSV doit porter le trimestre, pas l'année seule.
- La demande d'estimation de revenu courant (cessation d'emploi/pension) ne s'applique pas aux gains en capital.
- Pour ces clients, le refuge structurel est le CELI : un gain dans le CELI ne touche jamais le SRG — à croiser avec les droits CELI au dossier.

**À valider par le fiscaliste** :
- Les seuils exacts du trimestre courant (source officielle Service Canada — la page canada.ca bloquait le fetch, chiffres pris de sources secondaires)
- Les plages à 75 ¢ (surprestation) et la mécanique conjoint
- La règle des 63 ans (décalage revenu N-1 → prestations juillet N)

<sub>Sources : https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/benefit-amount.html · https://www.taxtips.ca/seniors/guaranteed-income-supplement.htm · https://www.savvynewcanadians.com/what-is-the-maximum-income-to-qualify-for-gis/ · https://lifemoney.ca/blog/gis-eligibility-2026-income-thresholds</sub>

_Confiance : moyenne_

### Seuils des aînés et crédits fondés sur le revenu — la carte des zones d'érosion

**Déclencheur** : Tout client de 65 ans et plus (montants d'âge) ou 70 ans et plus (soutien aux aînés QC), et tout ménage recevant TPS/solidarité : leur revenu net traverse des zones où chaque dollar de gain imposable coûte plus que l'impôt affiché.

**Mécanique** : Au-delà de PSV/SRG, le gain imposable érode : (1) le montant fédéral en raison de l'âge (2024 vérifié : 8 790 $, érodé à 15 % au-delà de 44 325 $ de revenu net, éteint vers 102 925 $ ; 2026 estimé ~9 200 $ / ~46 400 $) ; (2) le montant d'âge du Québec (érosion sur le revenu familial — non vérifié en détail) ; (3) le crédit remboursable soutien aux aînés QC (70+, max 2 000 $/4 000 $, réduit à 5,4 % du revenu familial au-delà de ~27 835 $ seul / ~45 270 $ couple, éteint à 64 968 $ / 119 326 $ en 2026) ; (4) le crédit TPS et le crédit solidarité QC. Le moteur doit produire une « carte des seuils » du client : où est son revenu net, quelles zones un gain de X $ ferait traverser, et le taux effectif marginal réel par tranche de gain.

**Données requises** :
- Âge (client et conjoint) — _deja-au-dossier — demographie.age, demographie.conjoint.age_
- Revenu net estimé (familial) — _fiche-a-etendre_
- Tous les seuils/taux d'érosion — _baremes-csv — bloc « seuils-sociaux » à créer, avec la juridiction et l'année (ou le trimestre) par ligne_

**Pièges** :
- Les érosions se SUPERPOSENT : impôt + PSV 15 % + âge 15 % + soutien aînés 5,4 % sur le même dollar — le taux effectif peut dépasser 50 % sur un revenu modeste.
- Certains seuils sont individuels, d'autres familiaux — la carte doit le porter.
- Montant d'âge QC et solidarité : paramètres 2026 non vérifiés dans cette exploration (le PDF officiel des paramètres 2026 des Finances du Québec n'a pas pu être lu — à ressaisir manuellement).

**À valider par le fiscaliste** :
- Chaque ligne du bloc seuils-sociaux du CSV, un par un
- Le montant en raison de l'âge fédéral 2026 exact (estimé par indexation ~2 %/an depuis 8 790 $ en 2024)
- Le choix des programmes à inclure (allocation-logement ? prime RAMQ ?)

> ⚠ **Contre-expertise** : Les chiffres fédéraux 2024 (8 790 $ / seuil 44 325 $ / extinction ~102 925 $) sont exacts, mais les paramètres 2026 sont des estimations non sourcées et le montant d'âge du Québec (érosion sur revenu FAMILIAL, taux ~18,75 %, seuils 2026) reste non vérifié — aucun de ces paramètres ne peut nourrir une règle automatique avant sourçage dans parametres-fiscaux.csv. La carte est aussi incomplète (voir manques : prime assurance médicaments QC, solidarité, TPS, maintien à domicile).

<sub>Sources : https://www.taxtips.ca/filing/age-amount-tax-credit.htm · https://www.revenuquebec.ca/fr/citoyens/credits-dimpot/credit-dimpot-pour-soutien-aux-aines/montant-du-credit-dimpot-pour-soutien-aux-aines/ · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/credit-impot-soutien-aines/ · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-110108.asp</sub>

_Confiance : moyenne_

### Cristalliser avant une hausse de taux personnelle prévisible

**Déclencheur** : Le taux de l'an prochain est connu et plus haut que celui de cette année : retour au travail après une année creuse, début du RRQ/PSV, l'année des 71 ans (dernière avant les retraits FERR obligatoires qui montent le plancher de revenu à vie), vente d'entreprise ou boni exceptionnel attendu. Déclencheurs d'âge détectables aujourd'hui (demographie.age = 70-71 ; intentions.venteEntreprisePrevue = oui).

**Mécanique** : Miroir du cas 1 : quand le taux marginal futur est structurellement plus haut, payer MAINTENANT au taux bas bat le report. Cas type : à 71 ans, dernière année avant que les retraits minimums FERR (obligatoires dès l'année des 72 ans) remplissent les paliers bas pour toujours — toute purge de gains latents faite avant vaut son écart de palier. Même logique avant la première année complète RRQ+PSV. La décision se chiffre : taux marginal estimé cette année vs l'an prochain, appliqué au gain imposable, moins la valeur temps du report d'impôt.

**Données requises** :
- Âge (fenêtre 70-71 détectable) — _deja-au-dossier — demographie.age_
- Vente d'entreprise prévue — _deja-au-dossier — intentions.venteEntreprisePrevue (ternaire)_
- Revenus de cette année et projection de l'an prochain — _fiche-a-etendre / impossible-automatique pour la projection fine_
- Paliers 2026 — _baremes-csv_

**Pièges** :
- La valeur temps joue CONTRE la cristallisation anticipée : payer 1 $ d'impôt aujourd'hui pour en éviter 1,10 $ dans 10 ans est perdant — l'écart de taux doit dépasser le coût du devancement.
- Le solde FERR peut être géré autrement (retraits anticipés, fractionnement de revenu de pension à 65 ans) — la cristallisation n'est qu'un levier parmi d'autres.
- Une hausse LÉGISLATIVE anticipée (comme la hausse d'inclusion 2024, finalement annulée) est un pari, pas une règle : l'épisode 2024-2025 a montré que cristalliser pour devancer une loi peut se retourner.

**À valider par le fiscaliste** :
- La formule d'arbitrage (écart de taux vs valeur temps, horizon)
- L'âge exact des retraits FERR (conversion fin de l'année des 71 ans, premier retrait l'année des 72 ans)

<sub>Sources : https://www.taxtips.ca/taxrates/canada.htm · https://www.wolterskluwer.com/en-ca/expert-insights/changes-to-capital-gains-inclusion-rate-deferred-to-2026</sub>

_Confiance : moyenne_

### Départ du Canada — impôt de départ : lisser avant, ou différer avec sûreté

**Déclencheur** : Intention d'émigrer (mutation, retraite à l'étranger, retour au pays d'origine). AUCUN champ du profil ne la capte aujourd'hui — c'est une donnée de rencontre à ajouter à la fiche.

**Mécanique** : Celui qui cesse d'être résident du Canada est réputé avoir disposé de la plupart de ses biens à la JVM immédiatement avant le départ (128.1(4) LIR) — les titres de placement non enregistrés y passent en bloc : c'est l'« impôt de départ », payable dans la déclaration de l'année du départ. Exclusions principales : les immeubles situés au Canada, les biens d'une entreprise exploitée au Canada par un établissement stable, les régimes enregistrés (REER/FERR/CELI/REEE), et les biens détenus à l'arrivée par un résident de courte durée (60 mois ou moins de résidence dans les 10 ans précédant le départ). Deux stratégies de cristallisation se comparent : (1) CRISTALLISER AVANT — étaler les gains sur les 2-4 années précédant le départ pour les imposer aux paliers inférieurs, plutôt que de tout empiler dans l'année du départ (même arithmétique que le lissage pré-décès ; noter que cristalliser n'ÉVITE rien, la disposition réputée arrivera de toute façon — l'avantage vient uniquement des paliers et des pertes disponibles) ; (2) NE RIEN CRISTALLISER ET DIFFÉRER — le choix T1244 reporte le paiement de l'impôt de départ SANS INTÉRÊT jusqu'à la vente réelle, avec sûreté exigée quand l'impôt fédéral dépasse 16 500 $ ; Québec a son propre choix (TP-1033.2) avec sa propre sûreté. Le report sans intérêt est économiquement puissant : il peut battre toute cristallisation anticipée. Déclarations obligatoires : T1161 (liste des biens si JVM totale > 25 000 $) et T1243 (dispositions réputées).

**Données requises** :
- intention de départ, date visée, pays de destination — _fiche-a-etendre — nouveau champ intentions.departCanadaPrevu (ReponseTernaire) + paysDestination ; la détection du fait lui-même reste impossible-automatique_
- positions non enregistrées avec PBR (l'assiette de l'impôt de départ) — _deja-au-dossier — comptes[].positions[]_
- revenu imposable des années pré-départ (pour le lissage) — _fiche-a-etendre_
- paliers fédéral + Québec — _baremes-csv_
- province de résidence (départ interprovincial ≠ émigration) — _deja-au-dossier — demographie.province_
- traitement fiscal du pays d'arrivée (step-up ou non, convention fiscale) — _impossible-automatique — question fiscaliste/fiscaliste étranger_

**Pièges** :
- Le pays d'arrivée peut ne PAS remonter le coût fiscal à la JVM du jour d'arrivée → double imposition du même gain ; certaines conventions (dont Canada–É.-U.) prévoient un choix pour l'éviter. Toujours un dossier de fiscaliste transfrontalier.
- Le CELI reste à l'abri au Canada mais est imposable dans plusieurs pays (dont les É.-U.) : le « gain sans impôt » cristallisé dans un CELI avant le départ peut devenir imposable après.
- Omettre le T1161 coûte une pénalité quotidienne plafonnée (montants non vérifiés ici — à confirmer) même si AUCUN impôt n'est dû.
- Un déménagement interprovincial n'est PAS une émigration : aucune disposition réputée ; c'est la province de résidence au 31 décembre qui impose toute l'année — un lissage interprovincial est un tout autre calcul.
- Les actions de société privée (AAPE) sont incluses dans la disposition réputée : le départ peut consommer — ou gaspiller — l'ECGC ; coordonner avec le cas ECGC avant de fixer la date de départ.
- La date de départ (perte de résidence) est une question de FAITS (liens de résidence), pas un choix de date sur un formulaire.

**À valider par le fiscaliste** :
- Le seuil de sûreté fédéral (16 500 $) et les exigences de sûreté de Revenu Québec en 2026
- La liste exacte des biens exclus applicable à la clientèle visée et le traitement des comptes corpo (la société de gestion ne « part » pas avec l'actionnaire — enjeu de résidence de la société)
- L'opportunité relative lissage pré-départ vs report T1244 sans intérêt, cas par cas

<sub>Sources : https://www.canada.ca/fr/agence-revenu/services/impot/impot-international-non-residents/particuliers-depart-canada-entree-canada-non-residents/dispositions-biens.html · https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/formulaires/t1243.html · https://www.effisca.com/report-de-limpot-de-depart-garanties-exigees/ · https://www.effisca.com/depart-du-canada-et-obligation-de-declarer-certains-biens/ · https://www.revenuquebec.ca/fr/services-en-ligne/formulaires-et-publications/details-courant/tp-1033-2-a/ · https://www.revenuquebec.ca/documents/fr/formulaires/tp/TP-1033.2(2021-03)DXI.pdf · https://www.finance-investissement.com/nouvelles/developpement-des-affaires/les-consequences-fiscales-de-lemigration/</sub>

_Confiance : haute_

### ECGC/LCGE sur actions admissibles de petite entreprise — purification et cristallisation de l'exonération

**Déclencheur** : Client actionnaire d'une société privée (comptes de type 'corpo' au dossier, ou dit en rencontre) avec vente ou transfert envisagé (intentions.venteEntreprisePrevue = oui/inconnu). Le radar du moteur corporatif voit précisément les placements passifs qui « salissent » la société.

**Mécanique** : L'exonération cumulative des gains en capital est passée à 1 250 000 $ pour les dispositions après le 24 juin 2024 (mesure maintenue et confirmée après l'annulation de la hausse du taux d'inclusion) ; l'indexation reprend en 2026, portant le plafond à environ 1 275 000 $. Conditions AAPE : (1) au moment de la vente, la société est une SEPE — 90 % ou plus de la JVM des actifs utilisés dans une entreprise exploitée activement au Canada ; (2) tout au long des 24 mois précédents, SPCC dont plus de 50 % des actifs sont actifs ; (3) actions détenues 24 mois par le vendeur ou une personne liée. Deux gestes distincts : la PURIFICATION — sortir les placements passifs (encaisse excédentaire, portefeuille de la société opérante) pour requalifier les actions, ce qui peut exiger jusqu'à 24 mois de délai → le moteur doit lever le drapeau des ANNÉES avant la vente, et c'est exactement la donnée que le book de sociétés de gestion expose ; et la CRISTALLISATION DE L'ECGC — déclencher volontairement un gain sur les actions pendant qu'elles se qualifient (typiquement un échange interne avec choix au-dessus du PBR, art. 85) pour verrouiller l'exonération à aujourd'hui, même si la société cesse ensuite de se qualifier ou si les règles se resserrent : le PBR remonte, l'exonération est consommée à impôt (presque) nul. Montage de fiscaliste — le moteur DÉTECTE la fenêtre, il n'exécute rien.

**Données requises** :
- existence d'une société privée et de placements passifs dedans — _deja-au-dossier partiellement — comptes type 'corpo' ; le registre du moteur corporatif (C:\moteur-corpo-phase0) voit la composition_
- statut AAPE réel (composition des actifs de la société opérante, historique 24 mois) — _impossible-automatique — états financiers de la société, hors périmètre du profil_
- ECGC déjà utilisée par le client (et par le conjoint) — _fiche-a-etendre — nouveau champ, source = historique fiscal/avis ARC_
- CNIL et PDTPE (réduisent l'exonération accessible) — _impossible-automatique — dossier fiscal_
- plafond ECGC de l'année (1 250 000 $ → indexé 2026) — _baremes-csv — config/parametres-fiscaux.csv_

**Pièges** :
- L'IMR : un gain exonéré par l'ECGC entre quand même à 100 % dans l'assiette IMR depuis 2024 — une grosse cristallisation dans une année à faible revenu régulier déclenche presque sûrement de l'IMR (récupérable sur 7 ans, si revenus futurs suffisants).
- Le test des 90 % s'évalue AU JOUR de la disposition : l'encaisse qui s'accumule entre la purification et la vente peut disqualifier à la dernière minute.
- Le CNIL (compte de pertes nettes cumulatives sur placements) bloque la DÉDUCTION même quand l'action se qualifie — fréquent chez les clients qui déduisent des intérêts d'emprunt-placement.
- La purification elle-même a un coût (impôt sur les dividendes sortis, ou complexité d'une société de gestion sœur) : l'économie d'ECGC se compare à ce coût.
- Deux conjoints actionnaires = deux ECGC (jusqu'à ~2,55 M$ en 2026) — mais seulement si les DEUX détiennent des actions admissibles depuis 24 mois : à structurer des années d'avance.
- Le chiffre 1 275 000 $ pour 2026 vient de sources secondaires (CFFP, Wealthsimple) — l'ARC administre la hausse à 1,25 M$ depuis le 25 juin 2024 mais le cadre légal a cheminé par propositions ; confirmer le montant indexé exact avant tout document.

**À valider par le fiscaliste** :
- Le montant ECGC 2026 exact et le statut législatif final de la hausse (adoptée vs administrée)
- Toute opération de cristallisation art. 85 et toute purification — hors périmètre du moteur en entier
- L'harmonisation Québec (déduction équivalente au provincial) et l'interaction avec l'IMR québécois

<sub>Sources : https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/deduction-gain-capital/ · https://cffp.recherche.usherbrooke.ca/wp-content/uploads/2025/11/48_exoneration_cumulative_gc_2025_VF.pdf · https://www.wealthsimple.com/fr-ca/learn/lifetime-capital-gains-explained · https://www.rcgt.com/fr/planiguide/modules/module-07-placements/deduction-pour-gains-en-capital/ · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-120411.asp · http://www.mbba.ca/l-exoneration-des-gains-en-capital · https://www.finance-investissement.com/nouvelles/developpement-des-affaires/l-avantage-de-la-purification-d-une-societe-par-actions/ · https://apercus-gestionprivee.bmo.com/fr/insights/strategies-et-planification-de-patrimoine/mise-jour-de-limpt-sur-les-gains-en-capital-ce-que-vous-devez-savoir-maintenant/</sub>

_Confiance : moyenne_

### Cristalliser contre les pertes de la société — le miroir corporatif de la stratégie 7, avec deux chausse-trapes absentes au personnel

**Déclencheur** : La société a des pertes en capital nettes reportées d'exercices passés, ou des pertes réalisées dans l'exercice courant, et ses positions portent des gains latents : gains absorbables à impôt corporatif nul, PBR remonté.

**Mécanique** : Identique au personnel sur le principe (le PBR est un coût moyen par action ici aussi, donc le plan de récolte proportionnel reste exact), mais DEUX différences décisives. (a) CDC : les pertes passées ont déjà réduit le cumul — le premier composant du CDC est un NET cumulatif (moitiés non imposables des gains MOINS moitiés non déductibles des pertes depuis 1971). Un gain qui ne fait que reboucher un déficit cumulatif ne crée AUCUN CDC positif : promettre « 50 % du gain sortable libre d'impôt » serait faux dans ce cas. (b) RPTA : le revenu de placement total ajusté compte les gains imposables nets des pertes de l'exercice COURANT seulement — les pertes REPORTÉES appliquées ne le réduisent pas. Une cristallisation « à impôt nul » peut donc quand même meuler la DPE d'une société opérante associée (voir le cas RPTA). L'appariement gains/pertes se fait par EXERCICE, pas par année civile.

**Données requises** :
- Pertes en capital nettes reportées DE LA SOCIÉTÉ (annexe 4 T2 / avis de cotisation corporatif) — _impossible-automatique — fiche-a-etendre (champ distinct de Droits.pertesCapitalReportees, qui est PERSONNEL)_
- Gains et pertes réalisés PAR EXERCICE de la société — _fiche-a-etendre — TransactionsAnnee nette par année civile ; il faut refenêtrer les transactions corpo sur l'exercice_
- Positions corpo en gain (PBR, valeur marchande) — _deja-au-dossier_
- Date de fin d'exercice — _fiche-a-etendre_

**Pièges** :
- NE JAMAIS transposer les pertes reportées du particulier (Droits.pertesCapitalReportees) aux comptes corpo : société et actionnaire sont deux contribuables distincts — or le moteur actuel fait exactement ce mélange (voir notes).
- Le « 50 % au CDC » ne tient que si le cumul CDC n'est pas en déficit — seul le solde ARC le dit.
- Les pertes corporatives se reportent 3 ans en arrière et indéfiniment en avant, mais uniquement contre des gains en capital : une société de gestion sans gains futurs prévus a intérêt à cristalliser plutôt qu'à laisser dormir.
- La règle de la perte apparente s'applique aussi entre personnes affiliées à la société.

**À valider par le fiscaliste** :
- La mécanique du composant cumulatif du CDC en présence d'un déficit (gains qui « rebouchent le trou »)
- La confirmation que les pertes reportées appliquées ne réduisent pas le RPTA (définition au par. 125(7))
- Le report rétrospectif de 3 ans comme alternative à la cristallisation

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-2-dividends/income-tax-folio-s3-f2-c1-capital-dividends.html · https://www.bakertilly.ca/fr/perspectives/taxalert-managing-adjusted-aggregate-investment-income · https://www.bccpa.ca/kbase/kbase-search/taxation/taxation/articles/holding-passive-investments-in-a-private-corporation/</sub>

_Confiance : moyenne_

### Cristalliser pour créer puis récupérer l'IMRTD : le cycle d'intégration complet

**Déclencheur** : L'actionnaire tire (ou prévoit tirer) un dividende imposable de sa société de gestion — ou un solde IMRTD dort parce que la société paie l'impôt remboursable sur ses revenus de placement sans jamais verser de dividende imposable. La cristallisation devient alors quasi « préfinancée ».

**Mécanique** : Au Québec en 2026, la moitié imposable d'un gain d'une SPCC est taxée à 50,17 % (38,67 % fédéral incluant l'impôt supplémentaire remboursable de 10,67 %, + 11,5 % Québec — barème EY 2026, applicable aussi aux « SPCC en substance »). De ces 50,17 points, 30,67 vont au compte d'IMRTD non déterminé (IMRDND) et sont remboursés à raison de 38,33 % des dividendes IMPOSABLES versés dans l'exercice — 1 $ récupéré par ~2,61 $ de dividende. Coût corporatif net après remboursement complet ≈ 19,5 % de la moitié imposable ≈ 9,75 % du gain brut. Combiné au CDC : sur 100 000 $ de gain, ~50 000 $ sortent libres d'impôt, ~15 330 $ d'impôt sont récupérables au versement du dividende imposable, et le solde (~9 750 $) est le vrai coût corporatif — avant l'impôt personnel sur le dividende imposable. Timing : le dividende imposable doit être VERSÉ AVANT LA FIN DE L'EXERCICE pour déclencher le remboursement de cet exercice ; un dividende non déterminé puise d'abord dans l'IMRDND ; un dividende déterminé ne puise que dans l'IMRDD.

**Données requises** :
- Soldes IMRDD et IMRDND (avis de cotisation T2 de la société) — _impossible-automatique — fiche-a-etendre_
- Date de fin d'exercice et dividendes déjà versés dans l'exercice — _fiche-a-etendre_
- Taux 50,17 % / 30,67 % / 38,33 % — _baremes-csv — config/parametres-fiscaux.csv, sous verrou fiscaliste_
- Tranche d'imposition personnelle de l'actionnaire (pour le net-net du dividende imposable) — _deja-au-dossier — Revenus.trancheRevenu (grossier) ; baremes-csv pour les taux de dividendes_

**Pièges** :
- Le dividende EN CAPITAL ne déclenche AUCUN remboursement d'IMRTD — seuls les dividendes imposables comptent ; les deux versements se planifient ensemble mais sont deux gestes distincts.
- Remboursement REFUSÉ si la T2 est produite plus de 3 ans après la fin de l'exercice — et l'IMRTD est quand même réduit : perte sèche définitive (interprétation ARC confirmée).
- Piège de conversion IMRDD→IMRDND documenté lors de dividendes intersociétés : l'ordre de versement dans un groupe peut dégrader la qualité du compte.
- Le remboursement est un remboursement à la SOCIÉTÉ ; l'actionnaire, lui, paie l'impôt personnel sur le dividende imposable — le « net des deux mains » est le seul chiffre honnête à présenter.

**À valider par le fiscaliste** :
- Les quatre taux et le calcul net des deux mains (société + particulier) au barème québécois 2026
- La stratégie de versement optimale déterminé/non déterminé selon les soldes IMRDD/IMRDND et le CRTG
- La règle des 3 ans et ses exceptions éventuelles

<sub>Sources : https://www.ey.com/content/dam/ey-unified-site/ey-com/fr-ca/services/tax/tax-calculators/2026/ey-taux-impot-placement-des-societes-2026-01-15-v1.pdf · https://centralesunlife.sunlife.ca/fr/produits/strategies-et-concepts/quest-ce-que-limpot-en-main-remboursable-au-titre-de-dividendes-imrtd/ · https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-129.html · https://members.videotax.com/technical-interpretations/2015-0610691C6-t2-late-filing-impact-on-div-refund-and-rdtoh · https://www.ctf.ca/EN/EN/Newsletters/Canadian_Tax_Focus/2021/1/210104.aspx</sub>

_Confiance : haute_

### Le calendrier corporatif : l'exercice remplace l'année civile

**Déclencheur** : Toute cristallisation dans un compte corpo — l'année d'imposition d'une société est son EXERCICE (art. 249 LIR), et la date de fin d'exercice n'est nulle part au dossier du moteur.

**Mécanique** : Six conséquences concrètes. (1) DIFFÉRÉ MAXIMAL : cristalliser au début de l'exercice reporte le paiement jusqu'à ~14 mois — le solde d'impôt est dû 2 mois après la fin d'exercice (3 mois pour certaines SPCC réclamant la DPE ; une société de gestion pure, sans revenu actif, est généralement à 2 mois). (2) L'appariement gains/pertes se fait par exercice : le netting « année civile » du moteur (TransactionsAnnee) est FAUX pour les comptes corpo. (3) Le 31 décembre n'a aucune signification : la « vente de fin d'année » corporative se planifie avant la fin d'EXERCICE. (4) Le dividende imposable qui récupère l'IMRTD doit partir avant la fin d'exercice. (5) Le RPTA d'un exercice frappe la DPE du groupe pour les années d'imposition commençant après la fin de l'année CIVILE où cet exercice se termine — une fin d'exercice en janvier plutôt qu'en décembre décale l'effet d'un an. (6) Seul le CDC est instantané et indifférent à l'exercice : c'est l'unique geste corporatif « en tout temps ».

**Données requises** :
- Date de fin d'exercice de chaque société du book — _impossible-automatique (états financiers / T2 du client) — fiche-a-etendre : champ finExercice sur une future FicheSociete_
- Refenêtrage des transactions corpo par exercice — _fiche-a-etendre — les transactions existent au grand livre, seule la fenêtre change_
- DPE réclamée ou non (pour le 2 vs 3 mois du solde dû) — _fiche-a-etendre_

**Pièges** :
- Présumer le 31 décembre : les recommandations datées « avant la fin de l'année » du moteur seraient simplement fausses pour une société dont l'exercice finit en juin.
- Un gros gain cristallisé peut déclencher ou gonfler des acomptes provisionnels dès l'exercice suivant.
- Deux relevés du même exercice à cheval sur deux années civiles se réconcilient mal avec un profil annuel civil.

**À valider par le fiscaliste** :
- Le critère exact 2 mois / 3 mois pour les sociétés de gestion du book (association, DPE, revenu imposable)
- L'interaction exercice ↔ année civile pour le RPTA (années d'imposition se terminant dans l'année civile précédente)

> ⚠ **Contre-expertise** : Le « différé de ~14 mois » ignore les ACOMPTES PROVISIONNELS des sociétés : dès que l'impôt de la partie I dépasse 3 000 $ (année courante ET précédente), des versements mensuels/trimestriels sont exigés en cours d'exercice. Le différé complet ne tient que si la base d'acomptes (année précédente) est faible ; sinon seul le solde au-delà des acomptes profite du délai de 2 mois. La règle « solde à 2 mois, 3 mois pour certaines SPCC avec DPE » est exacte, mais une société de gestion qui cristallise régulièrement paiera en cours d'année.

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-payments/paying-your-balance-corporation-tax/balance-day.html · https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-129.html · https://www.bccpa.ca/kbase/kbase-search/taxation/taxation/articles/holding-passive-investments-in-a-private-corporation/</sub>

_Confiance : haute_

### Revenu passif et plafond des affaires : la meule RPTA sur le groupe associé

**Déclencheur** : La société de gestion est ASSOCIÉE (au sens fiscal) à une société opérante qui réclame la déduction pour petite entreprise, et la cristallisation projetée porterait le RPTA (revenu de placement total ajusté) du groupe au-delà de 50 000 $ pour l'exercice.

**Mécanique** : Fédéral : le plafond des affaires de 500 000 $ du groupe est réduit de 5 $ par 1 $ de RPTA au-delà de 50 000 $, et tombe à zéro à 150 000 $ de RPTA. Le RPTA de référence est celui des années d'imposition du groupe se terminant dans l'année CIVILE PRÉCÉDENTE — l'effet d'une cristallisation est donc décalé d'environ un an. La moitié imposable du gain compte dans le RPTA (nette des pertes de l'exercice courant ; pertes reportées exclues ; gains sur actifs utilisés dans l'entreprise active exclus). Le QUÉBEC applique la même réduction linéaire 50 000 $ → 150 000 $ (harmonisé ; en plus de son critère propre des heures travaillées, et avec une hausse du taux de la DPE annoncée en mai 2026 — Bulletin 2026-3). Cas inverse tout aussi important : une société de gestion PURE, non associée à une opérante qui réclame la DPE, n'est PAS touchée — elle n'a pas de revenu actif ; le moteur doit savoir ÉCARTER ce faux piège au lieu de le brandir. Leviers de cristallisation : étaler les gains sur plusieurs exercices pour rester sous 50 000 $ de RPTA ; ou, pour un très gros gain inévitable, le CONCENTRER dans un seul exercice — la DPE ne se perd qu'une fois plutôt que plusieurs années de suite.

**Données requises** :
- Existence d'un groupe associé et DPE réclamée par une société du groupe — _impossible-automatique — question de rencontre ; fiche-a-etendre (groupeAssocie, dpeReclamee)_
- RPTA du groupe pour les exercices terminés dans l'année civile précédente (T2) — _impossible-automatique — fiche-a-etendre_
- Revenus passifs courants des comptes corpo (intérêts, dividendes, loyers) — _deja-au-dossier partiellement — Position.revenuAnnuel ; le reste (loyers, revenus hors book) est à demander_
- Seuils 50 000 $ / 150 000 $ / ratio 5:1 — _baremes-csv — config/parametres-fiscaux.csv_

**Pièges** :
- Le RPTA additionne TOUS les revenus passifs du groupe (intérêts, dividendes de portefeuille, loyers, moitié des gains) — pas seulement la cristallisation projetée : le seuil de 50 000 $ peut déjà être entamé.
- Les pertes en capital REPORTÉES appliquées ne réduisent pas le RPTA : une cristallisation « à impôt nul » (cas 3) meule quand même.
- « Associée » est une notion technique (contrôle, liens familiaux, participations croisées) plus large que « même actionnaire » — ne jamais la déduire automatiquement.
- L'Ontario et le Nouveau-Brunswick ne suivent pas la meule fédérale, mais le QUÉBEC la suit : pour un book québécois, l'effet est double (fédéral + provincial).
- Perdre la DPE une année par concentration volontaire est un coût CHIFFRABLE et parfois acceptable — le présenter comme un arbitrage, pas comme un interdit.

**À valider par le fiscaliste** :
- La définition exacte du RPTA (par. 125(7)) et ses exclusions
- L'harmonisation québécoise précise et l'effet de la hausse du taux de DPE de mai 2026 (Bulletin 2026-3) sur le coût d'une année de DPE perdue
- Le chiffrage du coût réel d'une DPE réduite (écart de taux fédéral + Québec sur le revenu actif du groupe)

<sub>Sources : https://www.bccpa.ca/kbase/kbase-search/taxation/taxation/articles/holding-passive-investments-in-a-private-corporation/ · https://www.manulifeim.com/retail/ca/en/viewpoints/tax-planning/how-to-plan-around-the-small-business-tax-changes · https://www.bakertilly.ca/fr/perspectives/taxalert-managing-adjusted-aggregate-investment-income · https://www.revenuquebec.ca/fr/salle-de-presse/nouvelles-fiscales/details/2026-05-04/hausse-du-taux-de-la-deduction-pour-petite-entreprise/ · https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/finances/publications-adm/Bulletins/FR/BULFR_2026-3.pdf · https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-210101.asp</sub>

_Confiance : haute_

### PBR en devise étrangère : le gain fiscal inclut le change (art. 261)

**Déclencheur** : Toute position dont Position.devise ≠ 'CAD' entre dans le plan de récolte.

**Mécanique** : Chaque achat se convertit en CAD au taux du JOUR D'ACHAT (taux quotidien de la Banque du Canada) ; le produit de vente, au taux du JOUR DE VENTE. L'ARC refuse le taux moyen annuel pour les dispositions de biens en capital. Le gain fiscal CAD contient donc la variation du change depuis chaque achat : un titre US stable en USD peut porter un gros gain (ou une perte) en CAD. DÉFAUT ACTUEL DU MOTEUR : positions.ts lit coutTotal (col 8) et valeurMarchande (col 9) sans aucune conversion, puis strategieCristallisationGains ADDITIONNE les gains latents toutes devises confondues et les compare à des pertes exprimées en CAD — le montant « absorbable » mélange des USD et des CAD.

**Données requises** :
- Devise de la position — _deja-au-dossier — Position.devise_
- Convention du champ « coût » de l'export Croesus pour un titre USD (CAD au taux d'origine ? CAD au taux du jour ? USD ?) — _impossible-automatique — à documenter avec iA/Croesus_
- Dates d'achat de chaque lot et taux BdC quotidiens correspondants — _fiche-a-etendre — aucune date d'achat au profil actuellement_
- Taux BdC du jour de vente — _fiche-a-etendre_

**Pièges** :
- Additionner USD et CAD sans conversion (défaut présent dans le code, à corriger avant toute exécution).
- Convertir le PBR au taux DU JOUR au lieu du taux d'achat : fausse le gain exactement du montant du change.
- La vente-rachat d'un titre US laisse passer l'encaisse par l'USD : la disposition de devises est un événement fiscal distinct (art. 39 ; exemption de 200 $ pour les particuliers) — négligeable sur un rachat le jour même, mais à connaître.
- La cristallisation HAUSSE le coût fiscal total des titres étrangers : elle peut faire franchir le seuil T1135 de 100 000 $ CAD de coût indiqué des « biens étrangers déterminés » (les actions US le sont, même chez un courtier canadien) — une nouvelle obligation déclarative créée par le geste lui-même.
- En attendant les données : toute position non-CAD doit dégrader le constat en « montant-a-confirmer », pas sortir en « calcule ».

**À valider par le fiscaliste** :
- La méthode de conversion retenue (taux quotidien BdC par transaction).
- La convention de devise du relevé Croesus, une fois documentée par iA.
- L'ajout d'un avertissement T1135 quand le coût des biens étrangers approche 100 000 $ CAD.

<sub>Sources : https://www.adjustedcostbase.ca/blog/calculating-adjusted-cost-base-with-foreign-currency-transactions/ · https://bccpa.ca/news-events/latest-news/2019/capital-gains-101-how-to-calculate-transactions-in-foreign-currency/ · https://taxinterpretations.com/content/664018 · https://www.advisor.ca/columnists_/michelle-connolly/how-foreign-exchange-impacts-capital-gains/ · https://www.taxtips.ca/filing/foreign-asset-reporting.htm</sub>

_Confiance : haute_

### Fonds communs et FNB : un PBR de relevé provisoire (distributions réinvesties, remboursement de capital, distributions fantômes)

**Déclencheur** : Une position de type fonds commun ou FNB figure dans le plan de récolte (le typeInstrument du parseur le sait ; Position.categorie est encore null).

**Mécanique** : Le PBR fiscal d'un fonds bouge sans transaction du client : les distributions réinvesties — dont les distributions « fantômes » de fin d'année des FNB, versées en parts puis consolidées — AUGMENTENT le PBR ; le remboursement de capital (T3 case 42 / RL-16) le DIMINUE. Ces ajustements ne sont connus qu'aux feuillets de février-mars SUIVANT : un plan exécuté en cours d'année repose sur un PBR provisoire. Deux directions d'erreur : distribution réinvestie non créditée → PBR sous-évalué → gain SURestimé → le plan consomme plus de pertes que nécessaire (bénin) ; RoC non déduit → PBR SURévalué → gain réel PLUS GRAND que calculé → l'excédent dépasse les pertes disponibles → impôt inattendu (la direction dangereuse). La fiabilité du coût comptable Croesus pour ces ajustements n'est pas documentée — les systèmes de courtage appliquent typiquement la case 42 avec des mois de retard, sans écriture visible.

**Données requises** :
- Nature de l'instrument (fonds/FNB vs action) — _fiche-a-etendre — typeInstrument existe au parseur (col 1) mais n'est pas propagé dans Position.categorie_
- Historique des distributions réinvesties et RoC du fonds (données du manufacturier ou de CDS) — _impossible-automatique — en local, sans flux de données_
- Politique de Croesus/iA sur l'ajustement du coût comptable (case 42, réinvesties, fantômes) — _impossible-automatique — à documenter avec iA_

**Pièges** :
- Cristalliser en décembre puis racheter AVANT la distribution fantôme annuelle : on encaisse la distribution imposable de fin d'année sur les parts rachetées — un impôt supplémentaire absent du plan. Vérifier le calendrier de distribution avant d'exécuter en décembre.
- Fonds en catégorie de société : depuis 2017, l'échange entre catégories est une disposition — un « switch » n'est plus neutre.
- Règle moteur proposée en attendant : pour toute ligne « fonds », appliquer une marge de sécurité (ne pas consommer 100 % des pertes disponibles) et marquer le PBR « provisoire » sur le document.

**À valider par le fiscaliste** :
- La marge de sécurité à appliquer aux positions fonds/FNB (p. ex. cristalliser au plus 90 % des pertes disponibles).
- La note client expliquant qu'un T3/RL-16 de mars peut réviser légèrement le gain déclaré.

<sub>Sources : https://www.adjustedcostbase.ca/blog/phantom-distributions-and-their-effect-on-adjusted-cost-base/ · https://www.cifinancial.com/ci-gam/ca/en/expert-insights/articles/etf-taxation--phantom-distributions.html · https://www.theglobeandmail.com/investing/education/article-understanding-phantom-etf-distributions/ · https://help.wealthsimple.com/hc/en-ca/articles/4409775037083-What-is-adjusted-cost-base-ACB</sub>

_Confiance : moyenne_

### Frais d'exécution et coût de marché du vendre-racheter

**Déclencheur** : Chaque ligne du plan (LignePlan.vendre) — surtout les titres peu liquides, les gros blocs et les comptes à commissions par transaction.

**Mécanique** : Coût d'un aller-retour = commission de vente + commission d'achat + écart achat-vente (payé environ une fois sur l'aller-retour) + impact de marché sur les gros blocs + risque hors-marché entre la vente et le rachat. Fiscalement : la commission d'achat S'AJOUTE au PBR et la commission de vente RÉDUIT le produit de disposition — le gain cristallisé réel est donc légèrement inférieur à (VM − PBR), et le nouveau PBR = prix de rachat + commission. Fonds communs : vente et rachat passent à la même VL de fin de journée (pas d'écart, pas d'impact marché), mais des frais d'opérations à court terme peuvent s'appliquer selon le prospectus, et des échéanciers de frais d'acquisition reportés (FAR) hérités courent encore (FAR interdits sur les ventes nouvelles depuis juin 2022).

**Données requises** :
- Grille de commissions du compte (honoraires vs commissions par transaction) — _fiche-a-etendre_
- Écart achat-vente / liquidité des titres du plan — _impossible-automatique — en local, sans flux de marché_
- Prospectus des fonds au plan (frais court terme, FAR résiduels) — _impossible-automatique_

**Pièges** :
- Le tri par densité de gain de planifierRecolte minimise déjà le volume vendu — bon réflexe ; mais une ligne à FAIBLE densité (petit gain sur grosse valeur vendue) peut coûter plus en frais que la valeur actualisée de l'impôt évité : prévoir un seuil de matérialité par ligne.
- Exécution : ordres à cours limité, éviter l'ouverture et la clôture de séance, fractionner les gros blocs.
- Racheter un fonds vendu peut déclencher des frais de négociation à court terme sur un rachat ultérieur rapproché — vérifier la politique du manufacturier avant de promettre un aller-retour sans frais.

**À valider par le fiscaliste** :
- Le seuil de matérialité (p. ex. ne pas recommander une ligne dont le gain cristallisé < N fois les frais estimés).
- Le traitement des commissions dans le calcul du gain du plan (produit net vs brut).

<sub>Sources : https://www.taxtips.ca/glossary/adjusted-cost-base.htm · https://www.gerezmieuxvotreargent.ca/chemin-dapprentissage/fonds-communs-de-placement-et-fonds-distincts/les-frais-dacquisition-reportes-et-linterdiction-des-courtiers-executants-expliques/ · https://www.gerezmieuxvotreargent.ca/chemin-dapprentissage/fonds-communs-de-placement-et-fonds-distincts/frais-associes-aux-fonds-communs-de-placement/</sub>

_Confiance : moyenne_

### Cristalliser puis cotiser au REER — la déduction contre le gain excédentaire

**Déclencheur** : Les gains latents dépassent les pertes disponibles (l'excédent serait imposable), le client a des droits REER connus par avis de cotisation, et il n'a pas atteint le 31 décembre de l'année de ses 71 ans.

**Mécanique** : L'excédent de gain non couvert par les pertes est imposable à 50 % d'inclusion (taux maintenu — la hausse aux deux tiers a été annulée le 21 mars 2025). Une cotisation REER déduite la même année réduit le revenu net ET le revenu imposable : elle peut neutraliser l'impôt de l'excédent, et — contrairement aux pertes reportées de la ligne 25300 — elle protège AUSSI les prestations calculées sur le revenu net. Formule candidate du geste combiné : gain cristallisable sans impôt supplémentaire = pertes disponibles + (déduction REER prévue ÷ taux d'inclusion). Transfert en nature possible pour un titre en gain (disposition réputée) ; jamais pour un titre en perte.

**Données requises** :
- Droits REER inutilisés (avis de cotisation SEULEMENT — jamais calculables à l'interne, règle du schéma §2) — _deja-au-dossier — droits.reerInutilises, souvent null → question de rencontre_
- Âge du client (limite des 71 ans) — _deja-au-dossier — demographie.age_
- Plafond REER 2026 (33 810 $) — _baremes-csv — à ajouter à config/parametres-fiscaux.csv avec source_
- Revenu imposable de l'année (pour dire ce que la déduction vaut) — _impossible-automatique — revenus.trancheRevenu déclaré ne suffit pas à chiffrer_

**Pièges** :
- Cotiser n'est pas déduire : la déduction peut se reporter — si l'année est à bas revenu, cotiser maintenant et déduire plus tard peut battre le geste combiné ; c'est un arbitrage de barèmes, pas un automatisme.
- Après 71 ans : REER du conjoint plus jeune seulement — le moteur doit le savoir avant de proposer.
- La période des 60 premiers jours ne gouverne que la DÉDUCTION ; l'année du gain reste la date de règlement de la vente (déjà documenté dans strategies.ts).
- Grâce de 2 000 $ sur l'excédent, puis 1 %/mois — même garde-fou transversal que le CELI.

**À valider par le fiscaliste** :
- La formule « pertes + déduction ÷ taux d'inclusion »
- Le plafond 2026 et l'opportunité REER (taux au décaissement vs taux à la déduction — dépasse le moteur)
- Le cas du REER du conjoint après 71 ans

<sub>Sources : https://www.canada.ca/fr/agence-revenu/nouvelles/salle-presse/conseils-fiscaux/conseils-fiscaux-2025/mise-jour-administration-arc-changements-proposes-taux-inclusion-gains-capital.html · https://gfmgroupe.com/blogue-details/738/nouvelle-annee-mise-a-jour-sur-le-celi-et-le-reer-pour-2026 · https://help.wealthsimple.com/hc/fr-ca/articles/360056585034</sub>

_Confiance : haute_

### Société de gestion — cristalliser pour gonfler le CDA avant un dividende en capital

**Déclencheur** : Compte de société (titulaire 'societe' / type 'corpo') avec gains latents, et un actionnaire qui veut sortir des fonds de la société. Cœur du « moteur corporatif » déjà en chantier ailleurs (C:/moteur-corpo-phase0).

**Mécanique** : Quand une société réalise un gain en capital, la moitié NON imposable crédite son compte de dividendes en capital (CDA). Par l'élection T2054 (fédéral) et CO-502 (Québec), la société verse ensuite un dividende en capital 100 % libre d'impôt à l'actionnaire résident canadien. Cristalliser les gains latents AVANT un versement prévu maximise le solde CDA au moment de l'élection — chaque 100 000 $ de gain cristallisé crée 50 000 $ sortables sans un dollar d'impôt personnel. Le vendre-racheter remonte en plus le PBR corpo, comme au personnel.

**Données requises** :
- Identification du compte comme corpo — _fiche-a-etendre — TypeCompte 'corpo' existe (types.ts:18-20) mais AUCUNE table ne le produit : TYPE_PAR_SUFFIXE (parseur-croesus/types.ts:73-77) mappe A/B/E/F/J vers 'non-enregistre' ; seul le tranchage manuel pose titulaire='societe' (comptes.ts:26-33). Étendre l'écran de tranchage pour poser type='corpo'._
- Solde CDA courant — _impossible-automatique — vient du comptable / T2 annexe 89 ; au mieux un champ MontantDate saisi et daté (le patron existe : droits.pertesCapitalReportees)_
- Fin d'exercice de la société — _fiche-a-etendre — nouveau champ, le schéma docs/schema-profil-fiscal-v1.md doit le définir d'abord_
- Gains latents des positions corpo — _deja-au-dossier — dès que le compte est marqué corpo_
- Revenu de placement passif de l'exercice (RPTA/AAII) — _impossible-automatique — T2 ; nécessaire pour le piège DPE seulement_

**Pièges** :
- Les pertes en capital réalisées RÉDUISENT le CDA (moitié non déductible) : l'ordre des opérations dans l'exercice compte — cristalliser les gains et verser AVANT de réaliser des pertes, jamais l'inverse.
- Élire un dividende en capital supérieur au solde CDA réel coûte l'impôt de la partie III (60 % de l'excédent) — d'où l'exigence du solde confirmé par le comptable, jamais estimé par le moteur.
- 50 % du gain compte dans le revenu de placement total ajusté : au-delà de 50 000 $ de revenu passif, le plafond DPE fond de 5 $ par 1 $ (nul à 150 000 $). Pour une société associée à une société OPÉRANTE, la cristallisation peut coûter la déduction pour petite entreprise du groupe.
- La moitié imposable du gain subit l'impôt remboursable (IMRTD) — récupérable seulement en versant des dividendes IMPOSABLES : le « libre d'impôt » ne décrit que la moitié CDA.
- Dividende en capital à un actionnaire NON-RÉSIDENT : retenue à la source — l'avantage disparaît.
- Règle anti-évitement 83(2.1) si des actions ont été acquises pour capter un CDA.

**À valider par le fiscaliste** :
- Toute la mécanique CDA (folio S3-F2-C1), le calendrier d'élection et le partage des rôles avec le comptable de la société.
- Le seuil à partir duquel le grind DPE rend la cristallisation contre-productive pour un client à société opérante.

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-2-dividends/income-tax-folio-s3-f2-c1-capital-dividends.html · https://www.taxtips.ca/glossary/capital-dividend.htm · https://www.cibc.com/content/dam/small_business/day_to_day_banking/advice_centre/pdfs/business_reports/ccpc-passive-income-fr.pdf</sub>

_Confiance : haute_

### Société de gestion — miroir « à impôt nul » sur les pertes reportées DE LA SOCIÉTÉ

**Déclencheur** : Société de gestion qui traîne ses PROPRES pertes en capital nettes reportées (T2, annexe 4) pendant que son portefeuille porte des gains latents.

**Mécanique** : Exactement la stratégie cristallisation-gains existante, mais au niveau du contribuable-société : les gains cristallisés dans la société sont absorbés par les pertes reportées de la société, à impôt nul, et le PBR corpo remonte. NUANCE CDA : la moitié non déductible des vieilles pertes a déjà réduit le CDA quand elles ont été réalisées ; cristalliser des gains équivalents ne fait que RAMENER le CDA vers zéro — l'avantage de cette variante est le PBR (et l'effacement du solde de pertes avant une vente future), pas un dividende en capital immédiat.

**Données requises** :
- Pertes en capital reportées DE LA SOCIÉTÉ — _impossible-automatique — T2 annexe 4 ; saisissable en fiche comme MontantDate daté (nouveau champ, schéma d'abord) — SURTOUT PAS droits.pertesCapitalReportees, qui est PERSONNEL_
- Positions corpo avec PBR — _deja-au-dossier — dès que le compte est marqué corpo (voir cas CDA)_
- Fin d'exercice (l'année fiscale de la société n'est pas l'année civile) — _fiche-a-etendre_

**Pièges** :
- DÉFAUT LATENT DU MOTEUR ACTUEL, à corriger avant tout le reste : positionsNonEnregistrees (strategies.ts:159-166) fusionne 'non-enregistre' ET 'corpo' dans le même panier, puis strategieCristallisationGains absorbe ces gains avec les pertes reportées du PARTICULIER (droits.pertesCapitalReportees, avis de cotisation). Deux contribuables distincts : les pertes de l'un n'absorbent jamais les gains de l'autre. Tant qu'aucun compte n'est marqué corpo le défaut est théorique, mais la règle doit séparer les deux paniers dès maintenant.
- La perte apparente s'applique entre PERSONNES AFFILIÉES (la société et son actionnaire) : sans danger pour une cristallisation de gains, mais toute stratégie sœur côté pertes corpo devra en tenir compte.
- L'exercice non-calendaire déplace toutes les échéances « fin décembre » du catalogue personnel.

**À valider par le fiscaliste** :
- La séparation stricte particulier/société dans le moteur et la formulation des deux constats.
- L'effet exact d'une cristallisation sur un solde CDA négatif ou nul.

<sub>Sources : https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/series-3-property-investments-savings-plan-folio-2-dividends/income-tax-folio-s3-f2-c1-capital-dividends.html · https://www.taxtips.ca/glossary/capital-dividend.htm</sub>

_Confiance : haute_

### Gains dans les mains d'un enfant mineur — l'attribution ne vise pas les gains en capital

**Déclencheur** : Compte « in trust » ou bien donné/prêté à un enfant mineur, avec gains latents. Les enfants sont déjà au profil (demographie.enfants, EcranFiscal.tsx:576-616) mais aucun compte ne peut leur être rattaché (Titulaire n'a pas de valeur 'enfant', types.ts:22).

**Mécanique** : Les REVENUS (intérêts, dividendes) d'un bien transféré à un mineur sont attribués au parent, mais les GAINS EN CAPITAL ne le sont PAS (la règle 74.1(2) ne couvre pas les gains ; 74.2 ne vise que le conjoint). Cristalliser les gains dans le compte de l'enfant les impose donc chez l'enfant — presque toujours à 0 $ grâce à son montant personnel de base. Rachat immédiat permis : même mécanique de remontée de PBR que la stratégie existante.

**Données requises** :
- Compte rattaché à un enfant (in trust) — _fiche-a-etendre — ajouter 'enfant' au type Titulaire + le tranchage ; le schéma d'abord_
- Revenu de l'enfant (généralement nul) — _fiche-a-etendre — un champ par enfant, sur le modèle de EnfantBeneficiaire.age_
- Gains latents du compte — _deja-au-dossier — dès le rattachement fait_

**Pièges** :
- AVEC LE CONJOINT, la même manœuvre ÉCHOUE : 74.2 attribue les gains en capital au conjoint auteur du transfert — le moteur ne doit jamais généraliser ce cas au titulaire 'conjoint'.
- L'impôt sur le revenu fractionné (IRF) vise les dividendes de sociétés privées et certains gains y liés (120.4) — sans danger pour des titres cotés, mais la frontière doit être dite.
- Une fiducie informelle mal documentée peut être requalifiée (vrai propriétaire = parent) : la déclaration des gains chez l'enfant suppose que le compte est réellement le sien.
- Le produit appartient à l'enfant : question de tenue autant que de fiscalité — même réserve que le « jamais suggéré de donner pour donner » de strategieDonTitres (strategies.ts:652-653).

**À valider par le fiscaliste** :
- La portée exacte de la non-attribution des gains aux mineurs (74.1(2) vs 74.2) et les cas limites (biens substitués, prêt vs don).
- Le traitement Québec (harmonisé, à confirmer) et la déclaration de revenus de l'enfant.

<sub>Sources : https://ca.rbcwealthmanagement.com/documents/10192/1189349/Income+splitting+Fre.pdf/1f1fd1a4-c914-4022-8021-d03992efdb7e · http://www.mbba.ca/regles-d-attribution-du-revenu</sub>

_Confiance : moyenne_

---

## JAMAIS AUTOMATIQUES — alertes et jugement, pas de calcul (7)

### Réserve de gain en capital — l'étalement légal sur 5 ans

**Déclencheur** : Vente (bloc d'actions privées, immeuble, entreprise) dont le PRODUIT est encaissé sur plusieurs années (solde de prix de vente) — pas une vente boursière ordinaire.

**Mécanique** : L'ARC permet de différer la part du gain correspondant au solde non encaissé : réserve raisonnable = gain × (solde à recevoir ÷ prix de vente), maximum 5 ans, minimum cumulatif de 20 % du gain reconnu par année. C'est le lissage pluriannuel (cas 7) inscrit dans la loi : chaque tranche annuelle tombe dans les paliers de son année. La réserve est FACULTATIVE année par année — on peut la sauter dans une année creuse pour y reconnaître plus de gain.

**Données requises** :
- Modalités de paiement d'une vente réelle (calendrier du solde de prix) — _impossible-automatique — événement ponctuel hors des relevés ; intentions.venteEntreprisePrevue (deja-au-dossier) peut servir de déclencheur de conversation_

**Pièges** :
- Interaction directe avec l'IMR : la tranche annuelle entre à 100 % dans l'assiette IMR.
- La réserve modifie le revenu net de CHAQUE année d'étalement → seuils PSV/SRG/ACE touchés 5 ans de suite.
- Règles particulières (réserve de 10 ans pour transferts à un enfant dans certains cas agricoles/AAPE) non couvertes ici.

**À valider par le fiscaliste** :
- La formule de réserve raisonnable et le minimum 20 %/an cumulatif
- L'optimisation « sauter la réserve dans une année creuse »
- Les cas à réserve de 10 ans

<sub>Sources : https://www.rcgt.com/fr/planiguide/modules/module-07-placements/gain-ou-perte-en-capital/ · https://groupedesmarais.com/planification-fiscale-reserve-pour-gains-en-capital/ · https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/t4037/gains-capital.html</sub>

_Confiance : haute_

### Changement annoncé du taux d'inclusion — la leçon 2024-2025 : ne jamais cristalliser sur une annonce

**Déclencheur** : Une annonce budgétaire fédérale (ou québécoise) de hausse du taux d'inclusion des gains en capital ou d'un autre resserrement daté — le scénario s'est joué au complet en 2024-2025.

**Mécanique** : Chronologie vérifiée : budget du 16 avril 2024 → hausse proposée du taux d'inclusion de 1/2 à 2/3 (au-delà de 250 000 $/an pour les particuliers ; dès le premier dollar pour sociétés et fiducies), effective le 25 juin 2024 → jamais adoptée (prorogation du Parlement le 6 janvier 2025) → report annoncé au 1er janvier 2026 (31 janvier 2025) → ANNULATION le 21 mars 2025 par le premier ministre Carney → budget du 4 novembre 2025 : annulation confirmée, incitatif aux entrepreneurs canadiens abandonné, hausse de l'ECGC à 1,25 M$ maintenue. Résultat en août 2026 : taux d'inclusion = 50 %, point. La leçon pour le moteur : des clients ont cristallisé en masse avant le 25 juin 2024 — payé de l'impôt des années d'avance, perdu le report — pour une hausse qui n'est JAMAIS entrée en vigueur ; l'ARC a même administré la mesure non adoptée avant de rétropédaler. Règle à encoder : (1) le taux d'inclusion vit dans config/parametres-fiscaux.csv, jamais dans le code ; (2) le moteur ne déclenche AUCUN constat sur une annonce non adoptée ; (3) si un jour une hausse est ADOPTÉE avec date d'entrée en vigueur, le calcul devient légitime et simple — cristalliser avant la date les gains qu'on comptait DE TOUTE FAÇON réaliser à moyen terme, en comparant (impôt payé d'avance au taux actuel) contre (impôt futur au taux haussé, actualisé) ; jamais les gains à horizon long, où la valeur du report domine.

**Données requises** :
- taux d'inclusion en vigueur, avec date — _baremes-csv — config/parametres-fiscaux.csv (0,5 en août 2026)_
- état d'une éventuelle mesure future (annoncée vs déposée vs adoptée) — _impossible-automatique — veille humaine du fiscaliste, jamais une inférence du moteur_
- horizon de réalisation prévu de chaque position (pour l'arbitrage report vs taux) — _fiche-a-etendre — au mieux, une intention par grande masse d'actifs_

**Pièges** :
- L'asymétrie fondamentale : cristalliser = coût CERTAIN et immédiat (impôt payé d'avance, report perdu) contre une économie CONDITIONNELLE à l'adoption ET au maintien de la mesure. 2024-2025 a montré que même une mesure « en vigueur administrativement » peut mourir.
- Ceux qui ont cristallisé avant le 25 juin 2024 n'ont AUCUN recours : la disposition est réelle, l'impôt est dû au taux de 50 % — ils ont simplement avancé leur impôt sans contrepartie.
- Un seuil du type « 250 000 $/an » (dans la mouture 2024) change l'optimum : il aurait fallu ÉTALER les cristallisations par tranches annuelles sous le seuil, pas tout vendre d'un coup — toute règle future doit lire sa structure exacte dans le CSV.
- Le miroir politique existe : une BAISSE annoncée du taux commanderait de RETARDER les ventes — même règle de prudence.

**À valider par le fiscaliste** :
- La politique de la maison sur ce qui compte comme « quasi-certain » (avis de motion de voies et moyens ? adoption ? sanction royale ?) avant que le moteur ait le droit d'en parler
- Le gabarit d'arbitrage report-vs-taux à utiliser SI un changement adopté survient

<sub>Sources : https://www.pm.gc.ca/en/news/news-releases/2025/03/21/prime-minister-mark-carney-cancels-proposed-capital-gains-tax-increase · https://www.lapresse.ca/affaires/finances-personnelles/2025-03-21/carney-confirme-que-la-hausse-de-l-impot-sur-les-gains-en-capital-est-abandonnee.php · https://www.pwc.com/ca/fr/services/tax/publications/tax-insights/parliament-prorogued-2025.html · https://cpaquebec.ca/-/media/docs/salle-de-presse/actualites/resume_budget_2025_fr.pdf · https://kpmg.com/ca/fr/home/insights/2025/09/canadian-federal-budget-2025.html · https://apercus-gestionprivee.bmo.com/fr/insights/strategies-et-planification-de-patrimoine/nouveau-taux-dinclusion-des-gains-en-capital-mise-en-uvre-reporte-jusquen-2026/ · https://www.rcgt.com/fr/planiguide/modules/module-07-placements/incitatifs-aux-entrepreneurs-canadiens/</sub>

_Confiance : haute_

### Le choix du dividende en capital : élection formelle, solde vérifié, versement excédentaire

**Déclencheur** : Dès qu'un dividende en capital est envisagé (cas 1 à 3) : le versement n'est jamais automatique — c'est une élection formelle à deux paliers avec un couperet à 60 %.

**Mécanique** : Fédéral : formulaire T2054 + copie certifiée de la résolution des administrateurs + annexe 89 (calcul du solde), à produire AU PLUS TARD au premier des deux moments : le jour où le dividende devient payable, ou le jour où une partie en est payée. Élection tardive possible avec pénalité : le moindre de 1 % du dividende et de 500 $ par année de retard, au prorata mensuel. Québec : élection SÉPARÉE via CO-502 (art. 502 de la Loi sur les impôts), à envoyer à Revenu Québec distinctement de toute déclaration, dans le même délai — l'oublier est un piège classique des dossiers québécois. Vérification préalable : l'ARC affiche le solde CDC dans Mon dossier d'entreprise (pour les sociétés ayant déjà produit un T2054 ou une annexe 89) et l'annexe 89 sert précisément à faire VÉRIFIER le solde avant d'élire. Excédent : impôt de la partie III = 60 % de l'excédent + intérêts ; le par. 184(3) permet, dans les 90 jours de l'avis de cotisation de partie III, d'élire que l'excédent soit traité comme dividende imposable (avec l'accord des actionnaires).

**Données requises** :
- Solde CDC vérifié (annexe 89 / Mon dossier d'entreprise) daté — _impossible-automatique — fiche-a-etendre pour le consigner_
- Preuve que l'élection québécoise CO-502 a été produite (dossiers passés) — _impossible-automatique — question au comptable_
- Barème de la pénalité de retard (1 % / 500 $ par année) — _baremes-csv — si le moteur veut chiffrer le coût d'une régularisation_

**Pièges** :
- Le couperet : 60 % de l'excédent en partie III — la pire pénalité du catalogue, sur un geste censé être « libre d'impôt ».
- Le CO-502 québécois oublié alors que le T2054 fédéral est produit : les logiciels T2 le préremplissent, mais il part par la poste séparément.
- Élire « le solde au complet » sans montant en dollars : résolution invalide selon l'ARC.
- Le solde affiché dans Mon dossier d'entreprise peut être périmé (exercices non cotisés) : l'annexe 89 de vérification reste la voie sûre avant un gros versement.
- Une perte réalisée entre la vérification et l'élection rend le solde vérifié caduc (cas 2).

**À valider par le fiscaliste** :
- La procédure complète T2054 + CO-502 et les délais exacts
- La formule précise de la pénalité de retard fédérale et son équivalent québécois
- La marche à suivre 184(3) et ses conditions (consentement des actionnaires)

<sub>Sources : https://support.cchifirm.ca/en/assistance/T2/2024/content/taxhelp/t2054.htm · https://www.revenuquebec.ca/fr/services-en-ligne/formulaires-et-publications/details-courant/co-502/ · https://www.bccpa.ca/news-events/cpabc-newsroom/2025/october/capital-dividend-accounts-practical-approaches-to-dealing-with-errors/ · https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account/capital-dividend-accounts.html · https://support.cchifirm.ca/en/assistance/T2/2025/content/taxhelp/xxcda.htm</sub>

_Confiance : haute_

### Fenêtres de taux et de statut : cristalliser avant qu'une règle ou un statut ne se referme

**Déclencheur** : Une hausse du taux d'inclusion est ANNONCÉE (la saga 2024-2026 prouve que ça arrive), la société s'apprête à perdre son statut de société privée (appel public à l'épargne, restructuration, prise de contrôle non-résidente), ou une vente de la société est prévue (le champ Intentions.venteEntreprisePrevue existe déjà au profil).

**Mécanique** : Le CDC et l'impôt se figent sur les règles en vigueur AU MOMENT de la réalisation. Trois fenêtres. (1) TAUX D'INCLUSION : le projet 2024 de passer aux 2/3 aurait réduit la part créditée au CDC de 50 % à 33⅓ % du gain — cristalliser avant l'entrée en vigueur d'une hausse annoncée protège définitivement la part non imposable (et pendant la saga, des contribuables ont cristallisé pour cette raison exacte). État vérifié août 2026 : taux à 50 %, hausse annulée (21 mars 2025, officialisée au budget de novembre 2025), AUCUNE hausse pendante — donc aucune urgence de ce type aujourd'hui, et cristalliser « par peur » a un coût réel d'impôt payé d'avance. (2) STATUT : le CDC n'existe que pour les sociétés privées — cristalliser et VERSER avant tout changement de statut, sinon le solde devient inaccessible. (3) VENTE PRÉVUE de la société : purger le CDC et l'IMRTD avant la transaction (l'acheteur paie rarement pour des comptes fiscaux, et 83(2.1) piège le CDC « acheté »). Seul le déclencheur (3) est partiellement détectable par le moteur ; (1) et (2) relèvent de la veille humaine.

**Données requises** :
- Vente d'entreprise prévue — _deja-au-dossier — Intentions.venteEntreprisePrevue_
- Changement de statut imminent de la société — _impossible-automatique — question de rencontre_
- Veille législative (taux d'inclusion, règles CDC) — _impossible-automatique — jugement humain, jamais une règle du moteur_

**Pièges** :
- L'histoire 2024-2026 coupe dans les deux sens : ceux qui ont cristallisé en juin 2024 pour devancer une hausse finalement ANNULÉE ont payé de l'impôt d'avance pour rien — une recommandation automatique fondée sur une loi non adoptée est exactement l'erreur à ne pas coder.
- Les soldes CDC calculés pendant la période transitoire 2024-2025 peuvent être erronés selon la base retenue par le préparateur — revérifier par annexe 89 avant tout versement.
- L'exonération cumulative des gains en capital (portée à 1,25 M$) concerne les actions ADMISSIBLES de petite entreprise — une société de gestion pure n'y est généralement PAS admissible (actif de placement) : ne pas confondre les deux chantiers.

**À valider par le fiscaliste** :
- Toute décision de devancer une règle annoncée mais non adoptée
- L'ordre de purge CDC/IMRTD avant une vente de société et l'interaction avec 83(2.1)
- L'admissibilité (ou non) des actions de la société de gestion à l'exonération de 1,25 M$

<sub>Sources : https://www.prospyr.ca/blog/capital-gains-inclusion-rate-canada-2026 · https://cpaquebec.ca/fr/salle-de-presse/nouvelles-et-publications/hausse-du-taux-dinclusion-du-gain-en-capital-et-dividendes-en-capital/ · https://www.taxcycle.com/fr-ca/ressources/rubriques-daide/t2-declarations-des-societes/formulaires-et-grilles-de-calcul-t2/cdc-et-le-taux-dinclusion-des-gains-en-capital/ · https://www.finance-investissement.com/nouvelles/actualites/une-bizarrerie-troublante-dans-les-regles-relatives-aux-gains-en-capital/</sub>

_Confiance : haute_

### L'IMR peut imposer une cristallisation « à impôt nul » — seuil d'alerte, jamais de calcul

**Déclencheur** : Gain cristallisé de l'année qui approche ou dépasse l'ordre de grandeur de l'exemption IMR (173 205 $ en 2024, indexée depuis), surtout s'il est absorbé par des pertes reportées ; ou gros don de titres la même année.

**Mécanique** : Depuis 2024, l'assiette de l'impôt minimum de remplacement inclut 100 % des gains en capital mais n'admet les pertes en capital d'autres années qu'à 50 % (80 % avant 2024). Un gain entièrement absorbé au calcul régulier laisse donc la MOITIÉ du gain dans le revenu imposable modifié → IMR de 20,5 % au-delà de l'exemption. Pour les dons de titres : 30 % du gain donné entre dans l'assiette (au lieu de 0 %) et le crédit de don n'y est admis qu'à 80 %. L'IMR payé est récupérable sur 7 ans — si de l'impôt régulier futur existe pour l'absorber, ce qui n'est pas garanti chez un retraité qui décaisse. Règle moteur : SEUIL D'ALERTE seulement — si le gain planifié de l'année dépasse un paramètre « exemption-imr » du CSV, bandeau « scénario IMR à faire chiffrer par le fiscaliste », et interdiction de la formule « sans impôt » dans la phrase du constat. Le formulaire T691 complet dépasse le périmètre du moteur.

**Données requises** :
- Gain cristallisé total planifié dans l'année (toutes stratégies — le grand livre du cas 2) — _deja-au-dossier — sortie du moteur une fois le livre unifié_
- Exemption et taux IMR 2026, fédéral et Québec — _baremes-csv — à ajouter, avec indexation annuelle_
- Autres éléments de l'assiette IMR (options d'achat, frais financiers, dividendes...) — _impossible-automatique — hors du dossier, c'est précisément pourquoi on alerte sans calculer_

**Pièges** :
- Le Québec a son propre IMR avec ses propres paramètres — l'harmonisation aux changements de 2024 est à faire confirmer.
- L'IMR frappe l'année de la vente même s'il est récupérable ensuite — un problème de liquidités bien réel pour le client.
- Étaler la cristallisation sur deux années sous l'exemption est la parade évidente — mais elle change les années de règlement (cas 9) et le calcul SV (cas 5) : les garde-fous se composent.

**À valider par le fiscaliste** :
- Tout : exemption et taux 2026, assiette exacte, IMR québécois, stratégie d'étalement
- Le niveau du seuil d'alerte (déclencher trop bas noie le signal, trop haut le rate)

<sub>Sources : https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-fr.pdf · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/impot-minimum-remplacement/ · https://www.rcgt.com/fr/conseils/avis-d-experts/impot-minimum-remplacement-irm-changements-2024/ · https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-charities-fr.pdf</sub>

_Confiance : haute_

### Ce qui reste au jugement du conseiller — liste fermée, hors calcul, mais DANS l'interface

**Déclencheur** : Toujours — chaque plan de récolte imprimé, chaque sélection de stratégies.

**Mécanique** : Le moteur optimise une seule dimension : le volume vendu pour une cible de gain. Il ignore, et doit continuer d'ignorer : l'attachement du client à un titre (actions de l'employeur, héritage), les convictions de placement du conseiller, le coût psychologique de vendre ses gagnants, les frais et écarts acheteur-vendeur, le risque hors marché si le rachat n'est pas simultané, les circonstances de vie (séparation, deuil, dossier fiscal ouvert — déjà la justification écrite du « rien coché par défaut » dans types.ts). Règle : le plan par densité reste une PROPOSITION triable — l'écran permet d'EXCLURE un titre ou de réordonner ligne par ligne, et le moteur recalcule le volume nécessaire sans bouger la cible de gain (mathématiquement toujours possible tant que les gains latents restants couvrent la cible ; sinon la cible baisse et le constat le dit). Chaque exclusion est datée et notée, comme un transfert résolu — jamais silencieuse, jamais par défaut. Le piège spécifique : le titre « le plus dense en gain » du plan sera souvent LE titre-fétiche du client (c'est celui qui a le plus monté) — l'exclusion doit être aussi facile que l'acceptation.

**Données requises** :
- Sélection par ligne de plan (pas seulement par stratégie) — _fiche-a-etendre — SelectionStrategies existe au niveau stratégie ; ajouter une exclusion datée+notée au niveau LignePlan_
- Note du conseiller par exclusion — _fiche-a-etendre — même modèle que TransfertResolu.note_

**Pièges** :
- Automatiser le « pourquoi » d'une exclusion (menus déroulants de raisons) inviterait à cocher sans réfléchir — champ libre, court, obligatoire.
- Un plan réordonné par le conseiller ne doit JAMAIS être re-optimisé silencieusement à l'import suivant — la sélection humaine prime jusqu'à révocation datée.

**À valider par le fiscaliste** :
- Rien (hors fiscalité) — mais la conformité iA doit voir le principe « proposition triable, pas instruction d'exécution »

<sub>Sources : src/lib/profils/types.ts (SelectionStrategies, TransfertResolu) — planificateur-rencontre</sub>

_Confiance : haute_

### Cristalliser la déduction pour gains en capital (AAPE / agricole-pêche) avant une vente d'entreprise

**Déclencheur** : intentions.venteEntreprisePrevue = 'oui' (champ EXISTANT et validé par l'API — fiche/route.ts:132-139 — mais sans contrôle à l'écran, donc jamais alimenté), ou client connu comme actionnaire d'une société opérante.

**Mécanique** : L'exonération cumulative des gains en capital est de 1 250 000 $ depuis le 25 juin 2024, indexée à compter de 2026 (~1 275 000 $ selon des sources secondaires — à confirmer). Elle exige que les actions soient AAPE au moment de la vente (90 % d'actifs actifs) et pendant les 24 mois précédents (50 %). « Cristalliser la DGC », c'est réaliser volontairement le gain pendant que les critères tiennent — typiquement par échange d'actions (art. 85) sans vendre à un tiers — pour verrouiller l'exonération avant qu'un excès d'actifs passifs ne disqualifie la société. L'incitatif aux entrepreneurs canadiens (inclusion 1/3) a été ANNULÉ au budget du 4 novembre 2025 : ne pas en tenir compte.

**Données requises** :
- Vente d'entreprise envisagée — _fiche-a-etendre — brancher le <Choix> ternaire dans EcranFiscal.tsx (bloc fiche, ~lignes 540-616) ; l'API est prête_
- Détention d'actions privées admissibles et composition d'actif de la société — _impossible-automatique — hors des relevés Croesus ; question de rencontre_
- DGC déjà utilisée par le client — _impossible-automatique — dossier fiscal personnel_
- Plafond DGC de l'année — _baremes-csv — dgc-plafond-aape,2026,CA,…,a-confirmer_

**Pièges** :
- IMR : depuis 2024, 30 % du gain admissible à la DGC entre dans l'assiette de l'impôt minimum (taux fédéral 20,5 % au-delà d'une exemption ~178 k$ indexée ; Québec harmonisé avec son propre taux 19 %). Une cristallisation DGC « sans impôt » peut donc déclencher un IMR réel — récupérable sur 7 ans seulement si l'impôt régulier remonte ensuite.
- La purification préalable (sortir les placements passifs) est souvent nécessaire et prend du temps : le drapeau doit se lever TÔT, pas l'année de la vente.
- Interaction avec le champ venteEntreprisePrevue : le moteur ne peut que DÉTECTER et router vers fiscaliste — jamais chiffrer.

**À valider par le fiscaliste** :
- Tout le cas — c'est un mandat de fiscaliste au complet (critères AAPE, art. 85, purification, IMR).
- Le montant indexé 2026 exact de la DGC avant toute entrée au CSV.

<sub>Sources : https://www.rcgt.com/fr/planiguide/modules/module-07-placements/deduction-pour-gains-en-capital/ · https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/deduction-gain-capital/ · https://www.doanegrantthornton.ca/insights/whats-the-canadian-entrepreneurs-incentive/ · https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/smart-advice/tax-savings-tips/pdfs/amt-changes-fr.pdf</sub>

_Confiance : moyenne_

---

## Ce que la critique de complétude a trouvé de MANQUANT (25)

Ces cas n'ont été couverts par aucun angle. Chacun est un candidat pour une exploration future.

- FIDUCIES — règle des 21 ans (104(4) LIR) [confiance haute, vérifié : Justice Canada art. 104 ; CPA Québec ; CTF] : disposition réputée de TOUS les biens de la fiducie à la JVM au 21e anniversaire — c'est l'équivalent fiduciaire de la disposition réputée au décès, et AUCUN angle ne l'a couvert. Deux stratégies de cristallisation en découlent : (a) cristalliser graduellement les gains de la fiducie sur les années qui précèdent l'échéance (lissage identique au cas successoral) ; (b) rouler les biens aux bénéficiaires au PBR avant l'échéance (107(2)) — ce qui NE cristallise PAS mais déplace le gain latent vers des contribuables à paliers progressifs, alors que la fiducie entre vifs est imposée au taux marginal MAXIMAL dès le premier dollar. Le moteur doit connaître la date de constitution de toute fiducie du bloc familial.
- FIDUCIES — attribution des gains aux bénéficiaires (104(21) et 104(21.2)) [confiance moyenne-haute] : une fiducie familiale qui cristallise peut ATTRIBUER le gain (avec son caractère de gain en capital) à des bénéficiaires à bas revenu — c'est la seule façon pour une structure imposée au taux max d'accéder aux bas paliers, et la désignation 104(21.2) permet de faire couler l'ECGC/AAPE vers plusieurs bénéficiaires (multiplication de l'exonération avant une vente d'entreprise, complément direct du cas AAPE déjà listé). Garde-fous propres : TOSI, 75(2) (fiducie avec droit de retour — gains attribués à l'auteur), impôt de la partie XII.2 si bénéficiaires non-résidents. Aucun angle ne traite la fiducie comme contribuable du plan.
- TOSI sur les gains des MINEURS — 120.4(4)/(5) LIR [confiance haute, vérifié : Justice Canada art. 120.4] : correction nécessaire au cas « gains dans les mains d'un enfant mineur ». Le gain d'un mineur sur des actions de société PRIVÉE (non cotée) cédées à une personne avec lien de dépendance est REQUALIFIÉ : réputé ne pas être un gain en capital, et DEUX FOIS le gain imposable est réputé dividende non déterminé imposé au taux maximal. L'affirmation « les gains en capital ne sont pas attribués » est vraie pour les titres cotés mais devient un piège majeur dès que le portefeuille familial contient des actions privées (société de gestion, gel successoral). Le moteur doit distinguer titres cotés vs privés avant toute cristallisation chez un mineur.
- SUCCESSION EN COURS (succession assujettie à l'imposition à taux progressifs, GRE) [confiance haute, vérifié : Miller Thomson ; Shajani 2026] : trois mécanismes absents. (a) La succession bénéficie des TAUX PROGRESSIFS pendant 36 mois : cristalliser les gains post-mortem DANS la succession (avant distribution aux héritiers déjà à haut revenu) est un lissage supplémentaire, avec choix des fins d'exercice de la T3. (b) Choix 164(6) : les pertes en capital de la succession (élargi aux TROIS premières années d'imposition pour les décès survenus après le 12 août 2024) se reportent contre les gains de la déclaration FINALE — cristalliser des gains dans la succession peut consommer des pertes qui auraient mieux servi en 164(6) contre la disposition réputée au taux max ; ordre d'allocation à modéliser. (c) Don testamentaire de titres cotés PAR la succession : inclusion 0 % + souplesse du GRE d'allouer le crédit entre déclaration finale et T3 — miroir successoral de la règle « don avant cristallisation ».
- OPTIONS D'ACHAT D'ACTIONS D'EMPLOYEUR [confiance haute, vérifié : Revenu Québec ; CFFP] : l'avantage à la levée est un revenu d'EMPLOI, pas un gain en capital — déduction de 50 % au fédéral (110(1)(d)) mais seulement 25 % au Québec (50 % seulement pour certaines sociétés cotées à masse salariale FSS ≥ 10 M$), plafond de 200 000 $/an d'acquisition pour les non-SPCC ; SPCC = imposition différée à la disposition des actions. Conséquences pour le moteur : le PBR des actions issues d'options = JVM à la levée (seule l'appréciation POST-levée est un gain cristallisable — confondre les deux surestime massivement le gain latent) ; l'avantage entre dans l'assiette IMR ; le don des actions dans les 30 jours de la levée donne une déduction additionnelle ; et le timing de LEVÉE est lui-même un problème de « cristallisation » d'un revenu à 100 %/75 % d'inclusion effective qui remplit les paliers avant tout gain en capital. Aucun angle ne couvre les titres d'employeur.
- IMMOBILIER LOCATIF [confiance haute, vérifié : MNP ; Revenu Québec revente précipitée] : cristalliser un immeuble n'est PAS cristalliser un titre. (a) La disposition déclenche la RÉCUPÉRATION D'AMORTISSEMENT : 100 % imposable (aucune inclusion à 50 %), et la réserve de 5 ans ne s'applique PAS à la récupération — le calcul du « gain » du moteur serait faux. (b) Règle anti-flip (depuis 2023, fédéral ET Québec) : bien résidentiel détenu moins de 365 jours = revenu d'ENTREPRISE à 100 %, aucune exemption de résidence principale, sauf événements de vie listés. (c) Changement d'usage = disposition RÉPUTÉE (cristallisation forcée) avec choix 45(2)/45(3) pour la différer — un levier de timing que le moteur ignore. (d) La réserve exige un solde de prix de vente : vendeur avec balance de prix de vente = cas concret du cas 8 déjà listé, mais jamais relié à l'immobilier.
- RÉSIDENCE PRINCIPALE — la cristallisation sans érosion [confiance haute] : le gain exonéré par la désignation de résidence principale n'entre PAS dans le revenu net — c'est la SEULE disposition qui ne déclenche ni récupération PSV, ni perte de SRG, ni érosion de crédits. Deux règles en découlent : (a) l'arbitrage de désignation année par année entre deux propriétés (résidence/chalet) — désigner le bien au gain annuel moyen le plus élevé, cristalliser l'autre ; (b) déclaration T2091/TP-274 obligatoire depuis 2016 même à gain nul — piège d'exécution. Le moteur qui voit une conversation immobilière doit connaître cette hiérarchie : résidence exonérée > tout autre bien.
- NON-RÉSIDENT PARTIEL / IMMIGRATION [confiance haute sur le mécanisme] : miroir absent de l'impôt de départ déjà couvert. (a) ARRIVÉE au Canada : acquisition réputée à la JVM (128.1(1)) — les gains accumulés avant l'immigration ne sont JAMAIS imposables au Canada ; cristalliser avant l'arrivée est inutile côté canadien mais peut l'être côté pays d'origine. (b) Année de résidence partielle : les gains réalisés pendant la portion NON-résidente sur des biens autres que des biens canadiens imposables échappent à l'impôt canadien — le timing intra-année de la cristallisation autour de la date d'arrivée/départ est décisif. (c) Non-résident qui dispose d'un bien canadien imposable : certificat art. 116 et retenue de 25 % (35 % immeubles) par l'acheteur — piège d'exécution pour un client parti à l'étranger qui garde un immeuble québécois.
- CITOYEN AMÉRICAIN OU DOUBLE ASSUJETTI [confiance moyenne-haute] : une cristallisation « à impôt nul » canadienne (pertes reportées, zone des crédits personnels, CDC) reste PLEINEMENT imposable aux États-Unis — pas d'harmonisation des pertes, pas de CDC reconnu, et la règle américaine du WASH SALE (30 jours) s'applique au volet US alors que la symétrie canadienne « aucun gain apparent » ne protège rien côté américain ; s'ajoutent PFIC (fonds/FNB canadiens) et NIIT 3,8 %. Le moteur doit au minimum porter un drapeau « citoyenneté/obligations fiscales US ? » bloquant le statut 'calcule' — aucun angle ne mentionne l'assujettissement étranger.
- DÉMÉNAGEMENT INTERPROVINCIAL [confiance haute, vérifié : Revenu Québec ; guides fiscaux] : la province de résidence au 31 DÉCEMBRE impose le revenu de TOUTE l'année. Cristalliser l'année où le client réside dans une province à taux plus bas (départ du Québec vers l'Alberta/Ontario : attendre d'être parti ; arrivée AU Québec : cristalliser avant le 31 décembre précédant l'établissement) déplace plusieurs points de pourcentage sur tout le gain. C'est un événement de vie fréquent (retraite, mutation) qu'aucun angle ne couvre.
- ASSURANCE-EMPLOI — remboursement des prestations [confiance moyenne sur le montant, vérifié : canada.ca = seuil 86 125 $ pour 2026] : 30 % de remboursement des prestations RÉGULIÈRES quand le revenu net dépasse le seuil. L'année d'une mise à pied ressemble à une « année creuse » idéale pour cristalliser (cas 1 de la liste), mais le gain imposable peut déclencher le remboursement des prestations reçues — taux caché de 30 % qui inverse la recommandation. À ajouter à la carte des seuils d'érosion.
- CELIAPP (FHSA) — absent du trio CELI/REER [confiance haute sur les paramètres standards, à re-vérifier en config] : cristalliser pour financer le CELIAPP cumule LES DEUX avantages déjà listés séparément — déduction du revenu comme le REER (peut neutraliser l'impôt de l'excédent de gain) ET sortie libre d'impôt comme le CELI ; 8 000 $/an, 40 000 $ à vie, transfert en nature = disposition réputée qui cristallise. Pour tout client (ou enfant majeur) admissible sans propriété, il passe AVANT le REER dans l'ordre d'allocation du produit de cristallisation.
- REEE ET REEI — subventions fondées sur le revenu familial [confiance moyenne, seuils à vérifier] : la SCEE supplémentaire (10-20 % sur la première tranche de 500 $), le Bon d'études canadien, et surtout le REEI (subventions de 300 %/200 % et bons selon le revenu familial net) dépendent de seuils de revenu que le gain imposable franchit. Cas aggravant : le cas « invalidité » déjà listé recommande de cristalliser dans les années creuses — sans voir qu'une famille avec bénéficiaire de REEI peut y perdre des subventions à taux de contrepartie de 300 %, pire que l'impôt épargné. À intégrer à la carte des érosions.
- PROGRAMMES QUÉBÉCOIS À SEUILS — la moitié provinciale de la carte des érosions manque [confiance moyenne, chaque seuil à vérifier] : crédit de SOLIDARITÉ (réduit selon le revenu familial), PRIME AU TRAVAIL, crédit FRAIS DE GARDE (taux dégressif selon le revenu familial), ALLOCATION FAMILLE (Retraite Québec), crédit SOUTIEN AUX AÎNÉS (remboursable, réduit selon revenu), crédit MAINTIEN À DOMICILE des aînés, PRIME du régime public d'assurance médicaments (RAMQ — cotisation fondée sur le revenu), CONTRIBUTION D'ADULTE HÉBERGÉ (CHSLD — fondée sur revenus/actifs), et AIDE FINANCIÈRE AUX ÉTUDES (revenu des parents et de l'étudiant). La liste couvre ACE/PSV/SRG (fédéral) mais aucun programme québécois nominalement — or le client type est québécois et plusieurs de ces seuils mordent plus bas que la PSV.
- PENSION ALIMENTAIRE ET SÉPARATION [confiance moyenne] : (a) le gain en capital imposable entre dans le revenu servant à fixer les pensions (modèle québécois de fixation pour enfants ; lignes directrices fédérales pour époux — revenu total ligne 15000) : cristalliser pendant ou juste avant une procédure de séparation peut gonfler durablement la pension, les tribunaux POUVANT exclure un gain non récurrent mais sans automatisme ; règle de timing : reporter la cristallisation après la fixation, ou documenter le caractère non récurrent. (b) La séparation/le divorce ÉTEINT l'attribution des gains au conjoint (74.5/74.2) : fenêtre post-séparation pour transférer des titres au PBR (73(1) s'applique aux transferts de règlement) et faire imposer la cristallisation chez l'ex-conjoint. Aucun angle ne touche la rupture d'union.
- SOCIÉTÉ DE PERSONNES [confiance moyenne] : (a) les gains de la SP arrivent au client via T5013 dans l'année où se TERMINE l'exercice de la SP — décalage de calendrier qui consomme de la place dans les paliers l'année de réception, à coordonner avec toute cristallisation personnelle ; (b) le PBR de la participation s'ajuste annuellement (parts de revenu, retraits) et un PBR NÉGATIF chez un commanditaire déclenche un gain RÉPUTÉ immédiat (40(3.1)) — cristallisation involontaire qu'un retrait mal calibré provoque ; (c) la participation elle-même est un bien cristallisable dont le PBR du relevé n'est jamais le PBR fiscal. Aucun angle ne couvre les sociétés en commandite (fréquentes en immobilier et placements privés).
- REQUALIFICATION REVENU vs CAPITAL — et le choix 39(4) [confiance moyenne] : un programme SYSTÉMATIQUE et répété de vendre-racheter des gagnants pourrait, à la marge, être requalifié en projet comportant un risque de nature commerciale (revenu à 100 %, aucune inclusion à 50 %). Le choix 39(4) LIR (tous les « titres canadiens » réputés en capital, irrévocable, interdit aux négociants) verrouille définitivement la qualification en capital — c'est LE filet de sécurité d'un moteur qui industrialise la cristallisation, et il est absent de la liste (qui ne couvre que l'absence de « gain apparent »).
- PRÊT AU CONJOINT AU TAUX PRESCRIT [confiance haute sur le mécanisme] : la liste démontre pourquoi le DON au conjoint échoue (73(1) + attribution 74.2) mais omet la solution standard : vente ou prêt au conjoint au TAUX PRESCRIT avec choix de non-roulement — contrepartie à la JVM = l'attribution ne s'applique pas, les gains FUTURS s'imposent chez le conjoint à bas revenu. Séquence type : cristalliser d'abord (PBR haut), puis transférer à la JVM financée par prêt prescrit → toute l'appréciation future change de contribuable. Taux prescrit en vigueur à vérifier trimestriellement.
- DON DE TITRES PAR LA SOCIÉTÉ — le miroir corporatif manquant [confiance haute sur le principe] : le don en nature d'un titre coté par la SOCIÉTÉ combine inclusion 0 % + déduction pour la société + 100 % DU GAIN (pas seulement la moitié) crédité au CDC → dividende en capital libre d'impôt supplémentaire pour l'actionnaire. La règle d'ordonnancement « don avant cristallisation » n'existe dans la liste que côté personnel, alors que le côté corporatif est souvent PLUS avantageux (le CDC est bonifié). À intégrer au bloc corporatif existant.
- RACHAT D'ACTIONS PRIVÉES = DIVIDENDE RÉPUTÉ (84(3)) [confiance haute] : « cristalliser » les actions de la société de gestion ELLE-MÊME via rachat par la société ne produit PAS un gain en capital mais un dividende réputé (écart entre produit et capital versé), imposé au barème des dividendes sans inclusion à 50 %. Garde-fou nécessaire : le moteur ne doit jamais traiter les actions de sociétés privées du bloc familial comme des titres cristallisables par simple « vente », et les post-mortem (pipeline vs 164(6) vs rachat) relèvent du fiscaliste.
- REPORTS QUI CONCURRENCENT LA CRISTALLISATION — art. 44.1 et 44 [confiance moyenne] : le report du gain sur actions de petite entreprise admissibles réinvesti dans d'autres actions de petite entreprise (44.1) et l'échange de biens de remplacement (44, dispositions involontaires ou biens d'entreprise) permettent de NE PAS reconnaître un gain réalisé. Cristalliser y renonce : toute règle automatique doit vérifier si le client se qualifie pour un report avant de recommander la reconnaissance du gain.
- CRISTALLISATIONS SUBIES ET ÉCHOUÉES DANS LES FONDS [confiance moyenne] : (a) les distributions de gains en capital de fin d'année des fonds/FNB créent du gain imposable SANS vente — elles consomment la place dans le palier AVANT toute cristallisation volontaire et doivent entrer dans le « grand livre unique » déjà proposé ; (b) fusion de fonds admissible = roulement automatique (impossible d'y cristalliser) ; (c) conversion entre séries du MÊME fonds = pas une disposition (une « cristallisation » tentée par switch de série échoue silencieusement) ; (d) fonds constitués en société : depuis 2017 l'échange entre catégories EST une disposition (outil de cristallisation sans sortir de la famille de fonds) ; (e) fonds distincts : attributions annuelles de gains/pertes propres. Le bloc « fonds » existant ne couvre que le PBR, pas ces événements.
- ACOMPTES PROVISIONNELS — le piège de trésorerie post-cristallisation [confiance haute sur le mécanisme] : une grosse cristallisation gonfle l'impôt de l'année N, donc les acomptes DEMANDÉS en N+1 (méthode du dernier exercice, ARC et Revenu Québec) — payer selon les rappels alors que N+1 est une année normale immobilise des liquidités ; inversement, choisir la méthode de l'année courante en N (année du gain) sans provisionner crée intérêts et pénalités aux deux paliers. Même piège côté société (et perte possible de la dispense d'acomptes d'une SPCC). Aucun angle ne traite la mécanique de paiement.
- GESTE COMBINÉ CELI — vérifications d'exécution manquantes [confiance haute] : le cas « cristalliser puis cotiser au CELI » ne vérifie ni les DROITS réels de cotisation (pénalité de 1 %/mois sur l'excédent), ni le piège du re-versement d'un RETRAIT dans la même année civile (les droits du retrait ne reviennent que le 1er janvier suivant), ni le refus DÉFINITIF de perte sur un transfert en nature d'un titre PERDANT au CELI/REER (40(2)(g)(iv) — pire qu'une perte apparente : perte perdue à jamais, pertinent si le plan jumelé gains+pertes utilise des transferts en nature). Trois garde-fous d'exécution absents.
- GEL SUCCESSORAL — le déclencheur événementiel absent [confiance moyenne] : la cristallisation de l'ECGC se réalise typiquement DANS un gel (échange 86 ou roulement 85 avec somme convenue au-dessus du PBR, sans vente à un tiers) — le cas AAPE listé mentionne « purification et cristallisation » mais aucun angle ne relie le GEL (événement fréquent chez les clients à société de gestion, y compris le re-gel à la baisse en marché baissier) à la décision de cristalliser avant/pendant, ni à l'attribution corporative 74.4(2) quand conjoint et mineurs sont actionnaires de la structure gelée. À traiter comme événement déclencheur dans le moteur, chiffrage réservé au fiscaliste.

---

## Notes de cartographie du code

CARTOGRAPHIE DU CODE (lecture seule du dépôt planificateur-rencontre ; aucun accès à C:/planificateur-donnees ni à EXECEL A PLANIF ; aucune donnée client lue ni citée).

1. PROFILCLIENT — src/lib/profils/types.ts, état de chaque champ.
ALIMENTÉS PAR LA FICHE (écran EcranFiscal.tsx → POST /api/base-locale/fiche, src/app/api/base-locale/fiche/route.ts) : demographie.age (écran :540, route :51-55), etatCivil (:544, route :56-61), conjoint.trancheRevenu (:552, route :72-78), enfants (:576-616, route :81-95), revenus.trancheRevenu + source declare/document (:548, route :98-107), droits.reerInutilises/celiInutilises/celiConjointInutilises/pertesCapitalReportees (:556-569, route :111-119, MontantDate daté), intentions.donsAnnuelsMoyens (:572, route :122-126). consolidation.comptesExternes/historiqueExterne : écran (:527-529) ; transfertsResolus : écran des transferts orphelins.
DÉRIVÉS À LA LECTURE, JAMAIS PERSISTÉS (hydraterProfil, src/lib/profils/hydrater.ts:54-84) : comptes (deriverComptes, comptes.ts:173-253, jointure relevé↔livre avec verdicts livre/confirme/ambigu/absent/non-jointable), transactionsAnnee et cotisationsAnnee (deriver.ts:115-157). historiqueVie : import du livre (historique.ts).
DORMANTS — ACCEPTÉS PAR L'API MAIS SANS CONTRÔLE À L'ÉCRAN : province (route :62-66), conjoint.age ('ageConjoint', route :67-71), ageRetraiteVise (route :127-131), venteEntreprisePrevue/achatImmobilierPrevu/testamentAJour (route :132-139, validés TERNAIRE). Pour les brancher il ne manque QUE les contrôles dans le bloc fiche d'EcranFiscal.tsx (~lignes 540-616) — un ChampNombre ou un Choix chacun — ET un consommateur côté moteur : les cas ci-dessus leur en donnent un (province+revenu→cas 1 ; ageRetraiteVise→cas 2 ; testamentAJour→cas 4 ; venteEntreprisePrevue→cas 7). detailsExternes est doublement dormant : ni écran NI clause dans la route (à ajouter sur le modèle de province) ; personne ne le lit. Rappel du contrat maison : « aucun champ improvisé — toute extension passe d'abord par docs/schema-profil-fiscal-v1.md » (types.ts:3-4).

2. CONFIG/PARAMETRES-FISCAUX.CSV. Format 5 colonnes parametre,annee,juridiction,valeur,source ; commentaires « # » ; lu et mis en cache par lireParametres (src/lib/profils/parametres-fiscaux.ts:20-42) ; sélection « dernière année ≤ année demandée » (motif de parametresReee, :108-112). Contenu actuel : plafond-celi 2009-2026, scee/iqee/cotisation-annuelle-subventionnee, plafonds à vie. Le format une-valeur-numérique-par-ligne se prête bien aux barèmes en PAIRES NOMMÉES : bareme-fed-borne-1..5 + bareme-fed-taux-1..5 (2026 : 58 523/0,14 ; ~117 047/0,205 ; ~181 4xx/0,26 ; 258 482/0,29 ; au-delà 0,33 — À CONFIRMER), bareme-qc-borne-1..4 + bareme-qc-taux-1..4 (53 255/0,14 ; 106 495/0,19 ; 129 590/0,24 ; au-delà 0,2575), mpb-federal, mpb-quebec (17 183), abattement-qc (0,165), seuil-psv-recuperation (95 323), imr-exemption-federale, imr-taux-federal (0,205), imr-exemption-qc, imr-taux-qc (0,19), dgc-plafond-aape (~1 275 000). Toutes en source « a-confirmer » : le verrou fiscaliste couvre déjà tout (revisionFiscalisteRequise=true, strategies.ts:993-995, une seule ligne à changer le jour venu). Ajouter un lecteur baremeImposition(annee, juridiction) sur le modèle de parametresReee : null si UN morceau manque → constat indisponible plutôt qu'un chiffre deviné.

3. LOGOS. src/lib/pdf/fetch-logos.ts : fournisseur FMP, endpoint public https://financialmodelingprep.com/image-stock/{SYMBOLE}.png sans clé API (:20), lots de 8 (:10,51), timeout 4 s (:9), échecs avalés → le titre retombe sur la pastille de catégorie ; retour Record<symbole, data:image/png;base64,…> (:38). AUCUN cache disque : re-téléchargé à chaque rendu. enrich-report-data.ts:31-39 filtre (hors CASH/FIXED_INCOME/OTHER, avec cible) et pose reportData.logos. Le rapport fiscal (src/app/api/base-locale/rapport-fiscal/route.ts) N'APPELLE PAS enrichReportData — pour afficher les logos du plan de récolte : (a) dans la route, collecter les symboles de constat.plan[].symbole (+ le titre de don-titres) et await fetchLogoDataUris(symboles) avant renderToBuffer ; (b) ajouter logos?: Record<string,string> à DonneesDocumentFiscal (optimisations-fiscales-document.tsx:52-58) et le propager à OptimisationsFiscalesPage ; (c) dans la table du plan (optimisations-fiscales-page.tsx:204-226), rendre <Image src={dataUri}> @react-pdf à gauche du symbole, avec repli silencieux si absent (l'icône dessinée reste la règle — cf. le refus des images du projet, mais un logo d'ÉMETTEUR dans un tableau est déjà le patron du PDF de cours cibles). CONFIDENTIALITÉ : seul le symbole boursier normalisé part vers FMP (fetch-logos.ts:13-20) — aucun nom de client, aucun montant ; conforme à docs/sorties-reseau.md §3d (« FMP (logos, prix), Yahoo… Symboles boursiers seulement », ligne 78). La règle CLAUDE.md exige quand même de METTRE À JOUR sorties-reseau.md pour dire que le document fiscal consomme désormais cette sortie. Piège réseau : la route est locale ; derrière le pare-feu iA les fetch sortants peuvent échouer (cf. fiche go-live) — la tolérance panne existante suffit (logo manquant = rien).

4. STRATÉGIE CRISTALLISATION-GAINS ACTUELLE — src/lib/profils/strategies.ts:387-502. Branches : aucun relevé (:400-407) → indisponible ; PBR manquant partout (:409-423) → indisponible ; enGain (:425-428) ; pertesDisponibles = max(0, pertesRealisees − gainsRealises) + reportées (:432-437) ; aucun gain latent (:439-446) → non-applicable ; pertes nulles ET reportées jamais demandées (:448-459) → indisponible avec question « avis de cotisation » ; pertes nulles connues (:460-467) → non-applicable dejaEnOrdre ; montant = min(gainsLatents, pertesDisponibles) (:469) ; visibilité entamée (:477-488) → montant-a-confirmer sans plan ; sinon calcule + plan (:490-502) via planifierRecolte (:188-216 — tri par densité gain/VM, dernière ligne partielle exacte car PBR = coût moyen). INSERTION DES NOUVEAUX DÉCLENCHEURS : le catalogue est la liste constats dans analyser() (:975-983) ; chaque nouvelle stratégie doit AUSSI s'ajouter à PRESETS (rapport-fiscal/route.ts:33-39), ICONES (optimisations-fiscales-page.tsx:86-118), gestesDe (demarches.ts) et l'écran de sélection — sinon elle est détectée mais jamais montrée. Recommandation : un CONSTAT PAR NATURE DE MONTANT (le champ libelleMontant existe précisément pour ça, strategies.ts:52-66) — donc de nouvelles strategieXxx() au catalogue plutôt que des branches empilées dans strategieCristallisationGains ; le commentaire :383-386 réserve déjà la variante bas-palier comme entité distincte. Et d'abord : les définir dans docs/schema-profil-fiscal-v1.md, qui fait foi.

5. COMPTES CORPO. Le type existe (TypeCompte 'corpo', types.ts:18-20 ; Titulaire 'societe', :22) et positionsNonEnregistrees les inclut (strategies.ts:162) — MAIS aucune dérivation ne produit jamais 'corpo' : TYPE_PAR_SUFFIXE (src/lib/parseur-croesus/types.ts:73-77) mappe A/B/E/F/J → 'non-enregistre' et TYPE_PAR_LETTRE_VMBL (:105-111) n'a pas de corpo ; regimeDuCompte (comptes.ts:151-155) ne peut donc rendre que les régimes de ces tables ou null. Le titulaire 'societe' n'arrive que par tranchage manuel (CompteResolu, comptes.ts:26-33, appliqué :209). CE QUI MANQUE POUR UN CAS CDA : (1) marquer corpo — étendre l'écran de tranchage pour poser type='corpo' quand titulaire='societe' (ou une table de suffixes corpo iA si elle existe — à demander à Nicolas, jamais deviner) ; (2) champs société au schéma PUIS au profil : finExerciceSociete, soldeCda (MontantDate — patron identique à droits.pertesCapitalReportees : montant + date, source comptable), pertesCapitalReporteesSociete (MontantDate), rptaExercice ; (3) côté moteur, SCINDER positionsNonEnregistrees en deux paniers (perso vs corpo).

DÉFAUTS LATENTS À SIGNALER AU FISCALISTE (hors catalogue) : (a) strategies.ts:162 fusionne perso et corpo, puis absorbe les gains corpo avec les pertes reportées PERSONNELLES de l'avis de cotisation — deux contribuables distincts ; inoffensif tant qu'aucun compte n'est marqué corpo, mais la coquille est armée. (b) deriverTransactionsAnnee (deriver.ts:115-136) somme la colonne Gains/Pertes de TOUTES les ventes du livre sans filtrer par régime : si Croesus renseigne cette colonne pour des ventes en REER/CELI/FERR, les « gains réalisés » de l'année incluent du non-imposable et gonflent le gain à absorber — à MESURER sur le livre (comptages et motifs seulement, jamais d'exemples nominatifs) avant de corriger.

CONTEXTE 2026 VÉRIFIÉ : inclusion 50 % maintenue (annulation de la hausse annoncée le 21 mars 2025, confirmée au budget du 4 novembre 2025 ; Québec harmonisé) ; incitatif aux entrepreneurs canadiens ANNULÉ ; DGC 1,25 M$ indexée dès 2026 ; IMR nouveau régime depuis 2024 (gains 100 %, reports de pertes 50 %, DGC 30 %, exemption indexée, taux 20,5 % féd / 19 % QC). Aucun changement de taux d'inclusion à l'horizon → « cristalliser avant une hausse » n'est PAS un cas en vigueur ; à re-vérifier à chaque budget.

CAS EXAMINÉS ET ÉCARTÉS (avec raison) : réserve de gains en capital (exige un produit de vente différé — jamais le cas d'une vente en bourse réglée comptant) ; départ du Canada (la disposition réputée de 128.1(4) cristallise d'office — rien à devancer, dossier de fiscaliste) ; don de titres (déjà la stratégie 4 : inclusion à 0 %, TOUJOURS supérieure à une cristallisation quand le client donne) ; fiducie familiale / règle des 21 ans (aucune donnée de fiducie au modèle — noter comme question de rencontre si « fiducie » sort en conversation) ; gel successoral (mandat fiscaliste pur, hors moteur) ; grande année de dons en argent (les crédits absorbent l'impôt d'un gain — réel mais dominé par le don en nature existant).

RIEN DE CE QUI PRÉCÈDE N'EST FINAL : chaque montant 2026 vient de sources secondaires professionnelles et porte « a-confirmer » ; le verrou revisionFiscalisteRequise (strategies.ts:995) reste levé tant que le fiscaliste n'a pas revu strategies.ts ET parametres-fiscaux.csv — c'est le circuit prévu, et ce travail est sa matière d'entrée.
