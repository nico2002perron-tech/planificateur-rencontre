// « OPTIMISATIONS FISCALES » — UNE page, datée, LOCALE SEULEMENT.
//
// Rend les constats produits par `analyser()` (src/lib/profils/strategies.ts).
// ZÉRO logique fiscale ici, ZÉRO mise en page là-bas : c'est le contrat de la
// section 5 du schéma, et le tenir est ce qui rend le module vérifiable par un
// fiscaliste sans qu'il ait à lire du JSX.
//
// ─────────────────────────────────────────────────────────────────────────────
// CETTE PAGE N'EXISTE QUE DANS LE PDF, JAMAIS DANS LE RAPPORT VIVANT HTML.
//
// Décision de Nicolas, 5 août 2026. Les deux formats partagent le pipeline de
// données, et `enrich-report-data.ts` dit pourquoi : « sinon les deux formats
// raconteraient deux histoires différentes au même client ». On accepte ici une
// divergence ASSUMÉE — le rapport vivant circule, cette section ne doit pas
// circuler avant l'avis du fiscaliste. Ne pas « réparer » cette divergence sans
// le lui demander.
//
// ÉTEINTE PAR DÉFAUT. Le drapeau est `=== true`, pas `!== false` comme les
// autres sections du gabarit : chaque apparition doit être un geste volontaire.
// Et il est imposé par la ROUTE via `modeFiscalActif()`, jamais réclamé par le
// navigateur — personne ne peut demander cette page depuis Vercel.
//
// Identité de page : accent OR #c5a365 — la seule couleur de la charte encore
// non réservée (orange = parcours, cyan = activité, duoBlue/duoGreen = revenus).
//
// Gardes d'honnêteté :
// - un MONTANT n'est affiché QUE si statut === 'calcule'. Les autres statuts
//   rendent leur explication et leurs données manquantes, jamais un chiffre ;
// - la DATE vient de `resultat.date`, donc de l'appelant — jamais d'un
//   `new Date()` caché, sinon deux rendus du même dossier porteraient deux
//   dates et rien ne dirait laquelle fait foi ;
// - la mention du fiscaliste est rendue tant que `revisionFiscalisteRequise` ;
// - l'angle mort est FACTUEL, jamais vendeur : la liste EST l'argument.
//
// Pas de « ≈ » (U+2248) ni de « ✓ » (U+2713) : ces glyphes manquent aux polices
// embarquées. Les flèches n'existent qu'en Montserrat.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Page, Text, View, Svg, Path } from '@react-pdf/renderer';
import { styles, C } from './styles';
import { SectionHeader, PageFooterV12 } from './year-activity-pages';
import type { ResultatAnalyse, Constat } from '@/lib/profils/strategies';
import { gestesDe, estDejaEnOrdre } from '@/lib/profils/demarches';

// ── Helpers locaux (copies volontaires : price-targets-template importera cette
// page — importer ses helpers créerait un cycle de modules) ──
function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}
function fmtDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${iso}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}

/**
 * Le ton d'un constat.
 *
 * Trois traitements pour quatre statuts, et c'est voulu : `indisponible` et
 * `non-applicable` se ressemblent à l'œil parce qu'ils disent la même chose au
 * client — « pas de chiffre ici » —, mais leurs mots diffèrent. C'est le texte
 * qui porte la nuance, pas la couleur.
 */
const TON: Record<Constat['statut'], { fond: string; bord: string; encre: string; mot: string }> = {
  // Passage « présentation » du 5 août : les fonds viennent maintenant de la
  // palette Duolingo de la charte (styles.ts), plus francs que les gris-verts
  // d'origine. LES STATUTS EUX-MÊMES N'ONT PAS BOUGÉ — quatre statuts, quatre
  // mots, la même règle. C'est la couleur qui s'anime, pas la sémantique.
  calcule: { fond: C.duoGreenBg, bord: C.duoGreen, encre: '#2f6b12', mot: 'chiffré' },
  'montant-a-confirmer': { fond: '#fff8e7', bord: C.duoYellow, encre: '#8a5a00', mot: 'à confirmer' },
  indisponible: { fond: '#f6f8fb', bord: '#c2cddb', encre: '#4a5b70', mot: 'donnée manquante' },
  'non-applicable': { fond: '#f6f8fb', bord: '#c2cddb', encre: '#4a5b70', mot: 'sans objet' },
};

/**
 * UNE ICÔNE PAR STRATÉGIE — dessinée, jamais importée.
 *
 * Traits vectoriels sur une grille de 24, dans la couleur de la stratégie.
 * Aucune image, aucun fichier externe : le PDF reste autonome et le rendu ne
 * dépend d'aucun réseau. Les traits sont volontairement simples — à 11 pt,
 * tout détail supplémentaire devient une tache.
 */
const ICONES: Record<string, { couleur: string; traits: string[] }> = {
  // Une flèche descendante sur un axe : la perte qu'on va chercher.
  'cristallisation-pertes': {
    couleur: C.duoGreen,
    traits: ['M3 4 L3 21 L21 21', 'M7 9 L11 14 L15 10 L20 16', 'M20 11 L20 16 L15 16'],
  },
  // La flèche qui monte sur un axe : le gain qu'on va récolter.
  'cristallisation-gains': {
    couleur: C.duoYellow,
    traits: ['M3 4 L3 21 L21 21', 'M7 16 L11 11 L15 14 L20 8', 'M20 13 L20 8 L15 8'],
  },
  // Deux contenants, un titre qui passe de l'un à l'autre.
  'localisation-actifs': {
    couleur: C.duoBlue,
    traits: ['M3 7 L10 7 L10 20 L3 20 Z', 'M14 7 L21 7 L21 20 L14 20 Z', 'M10 11 L14 11'],
  },
  // Un coffre entrouvert : l'espace d'abri qui attend.
  'droits-cotisation': {
    couleur: C.blue,
    traits: ['M4 11 L20 11 L20 20 L4 20 Z', 'M4 11 L7 6 L17 6 L20 11', 'M10 15 L14 15'],
  },
  // Deux personnes côte à côte.
  'celi-conjoint': {
    couleur: C.duoPurple,
    traits: ['M9 8 A2.6 2.6 0 1 0 9 3 A2.6 2.6 0 1 0 9 8', 'M3 21 A6 6 0 0 1 15 21',
             'M17 9 A2.2 2.2 0 1 0 17 5 A2.2 2.2 0 1 0 17 9', 'M15 21 A5 5 0 0 1 22 17'],
  },
  // Une main ouverte qui tend quelque chose.
  'don-titres': {
    couleur: C.duoOrange,
    traits: ['M12 3 L12 13', 'M8 7 L12 3 L16 7', 'M4 15 A8 8 0 0 0 20 15'],
  },
  // Une liste ordonnée.
  'ordre-vente': {
    couleur: C.cyan,
    traits: ['M4 6 L7 6', 'M4 12 L7 12', 'M4 18 L7 18', 'M10 6 L20 6', 'M10 12 L20 12', 'M10 18 L20 18'],
  },
};

function IconeStrategie({ strategie, eteinte }: { strategie: string; eteinte: boolean }) {
  const icone = ICONES[strategie];
  if (!icone) return null;
  // Un constat sans chiffre porte son icône en gris : la couleur signale qu'il
  // y a quelque chose à faire, pas seulement de quoi on parle.
  const trait = eteinte ? '#94a3b8' : icone.couleur;
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 13, height: 13, marginRight: 5 }}>
      {icone.traits.map((d, i) => (
        <Path key={i} d={d} stroke={trait} strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

function CarteConstat({ constat }: { constat: Constat }) {
  const t = TON[constat.statut];
  const gestes = gestesDe(constat);
  return (
    <View
      style={{
        marginBottom: 7,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: t.fond,
        borderLeftWidth: 2.5,
        borderLeftColor: t.bord,
        borderLeftStyle: 'solid',
        borderRadius: 2,
      }}
      wrap={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconeStrategie strategie={constat.strategie} eteinte={constat.statut !== 'calcule'} />
        {/* LE TITRE CLIENT, pas le titre du catalogue. « Cristallisation de
            pertes » est du vocabulaire de metier ; l'ecran de selection le
            garde, le document remis au client dit ce que ca change pour lui. */}
        <Text style={{ fontSize: 9.5, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          {constat.titreClient}
        </Text>
        <Text style={{ marginLeft: 6, fontSize: 6.4, color: t.encre, textTransform: 'uppercase' }}>
          {t.mot}
        </Text>

        {/* LE MONTANT N'APPARAÎT QUE SI LE STATUT EST « calcule ».
            C'est la garde centrale : `montantEstime` est déjà null ailleurs
            (strategies.ts le verrouille et le teste), mais on ne dépend pas
            d'une seule barrière pour un chiffre qui atteint le client. */}
        {constat.statut === 'calcule' && constat.montantEstime !== null && (
          <Text
            style={{
              marginLeft: 'auto', fontSize: 12, fontFamily: 'Montserrat',
              fontWeight: 800, color: t.encre,
            }}
          >
            {fmt(constat.montantEstime)}
          </Text>
        )}
      </View>

      {/* CE QUE LE MONTANT EST. Sans cette ligne, trois chiffres de natures
          différentes s'alignent en colonne et se lisent comme trois économies
          comparables — alors que des droits de cotisation ne sont pas une
          économie. C'est le défaut qui a fait retirer le total de la page. */}
      {constat.statut === 'calcule' && constat.montantEstime !== null && (
        <Text style={{ marginTop: 1, fontSize: 6.4, color: t.encre, textAlign: 'right' }}>
          {constat.libelleMontant}
          {constat.recurrence === 'annuel' ? ', par année' : ', une seule fois'}
        </Text>
      )}

      <Text style={{ marginTop: 2.5, fontSize: 7.4, color: '#334155', lineHeight: 1.4 }}>
        {constat.explication}
      </Text>

      {constat.donneesManquantes.length > 0 && (
        <Text style={{ marginTop: 2.5, fontSize: 6.6, color: t.encre, lineHeight: 1.35 }}>
          Pour aller plus loin : {constat.donneesManquantes.join(' · ')}
        </Text>
      )}

      {/* LE PLAN DE RÉCOLTE — quoi vendre, pour combien, et pourquoi cet
          ordre. Présent seulement sur un constat calculé : un plan vers un
          montant non confirmé serait une marche à suivre vers un chiffre faux. */}
      {constat.plan && constat.plan.length > 0 && (
        <View style={{ marginTop: 4, paddingLeft: 6 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 1.5, borderBottomWidth: 0.6, borderBottomColor: '#cbd5e1', borderBottomStyle: 'solid' }}>
            <Text style={{ flex: 2, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>Titre</Text>
            <Text style={{ flex: 1.6, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>Vendre (environ)</Text>
            <Text style={{ flex: 1.6, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>Gain cristallisé</Text>
          </View>
          {constat.plan.map((l) => (
            <View key={l.symbole} style={{ flexDirection: 'row', paddingVertical: 1.2 }}>
              <Text style={{ flex: 2, fontSize: 7, color: '#334155' }}>
                {l.symbole}{l.partiel ? '  (en partie)' : ''}
              </Text>
              <Text style={{ flex: 1.6, fontSize: 7, color: '#334155', textAlign: 'right' }}>{fmt(l.vendre)}</Text>
              <Text style={{ flex: 1.6, fontSize: 7, color: '#334155', textAlign: 'right' }}>{fmt(l.gain)}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.3 }}>
            L’ordre va du titre au gain le plus dense au moins dense : la cible est atteinte en
            vendant-rachetant le moins possible. Vendre une partie d’une position cristallise la même
            part de son gain — le prix de base est un coût moyen par action.
          </Text>
        </View>
      )}

      {/* LES DÉMARCHES, SOUS CHAQUE GESTE.
          Un constat dit ce qui est ; un geste dit ce qu'on fait ; les démarches
          disent comment. Sans elles, la page se lit comme un diagnostic sans
          ordonnance. Toutes ces phrases viennent de gabarits déterministes
          (demarches.ts) : elles sont en nombre fini et un fiscaliste peut les
          relire une par une. */}
      {gestes.map((g, i) => (
        <View key={i} style={{ marginTop: 4, paddingLeft: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 7.4, fontFamily: 'Open Sans', fontWeight: 600, color: C.navy }}>
              {g.libelle}
            </Text>
            <Text style={{ marginLeft: 5, fontSize: 6, color: '#64748b' }}>
              {PORTEUR[g.porteur]}
            </Text>
          </View>
          {g.demarches.map((d, j) => (
            <Text key={j} style={{ marginTop: 1, fontSize: 6.8, color: '#475569', lineHeight: 1.35 }}>
              {j + 1}. {d}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Qui pose le geste — le client ne doit pas croire qu'il doit tout faire. */
const PORTEUR: Record<'client' | 'conseiller' | 'les-deux', string> = {
  client: 'vous',
  conseiller: 'nous nous en occupons',
  'les-deux': 'ensemble',
};

/**
 * « DÉJÀ EN ORDRE » — le contrepoids honnête.
 *
 * Un document qui ne parle que de ce qui cloche laisse croire que tout cloche.
 * Ce bloc dit ce qui a été regardé et n'appelle rien. Il ne contient QUE les
 * constats dont la situation est correcte — jamais ceux où il nous manque une
 * donnée, qui sont une question à poser, pas une bonne nouvelle.
 */
function BlocDejaEnOrdre({ constats }: { constats: Constat[] }) {
  return (
    <View
      style={{
        marginTop: 4, marginBottom: 7, paddingVertical: 6, paddingHorizontal: 9,
        backgroundColor: C.duoGreenBg, borderRadius: 2,
      }}
    >
      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: '#2f6b12' }}>
        Déjà en ordre
      </Text>
      <Text style={{ marginTop: 1.5, fontSize: 6.8, color: '#3f6b2a', lineHeight: 1.35 }}>
        Regardé, rien à faire de ce côté.
      </Text>
      {constats.map((c) => (
        <Text key={c.strategie} style={{ marginTop: 2, fontSize: 7, color: '#334155', lineHeight: 1.35 }}>
          {c.titreClient} — {c.explication}
        </Text>
      ))}
    </View>
  );
}

/**
 * L'angle mort — section 4 du schéma.
 *
 * TON : factuel, jamais vendeur. On ne dit pas au client ce qu'il devrait
 * faire ; on lui montre ce qu'on ne peut pas voir. La liste EST l'argument.
 */
function BlocAngleMort({ angleMort }: { angleMort: NonNullable<ResultatAnalyse['angleMort']> }) {
  return (
    <View
      style={{
        marginTop: 4,
        paddingVertical: 7,
        paddingHorizontal: 9,
        backgroundColor: C.goldPale,
        borderWidth: 0.8,
        borderColor: C.gold,
        borderStyle: 'solid',
        borderRadius: 2,
      }}
    >
      <Text style={{ fontSize: 9.5, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
        Ce que nous ne voyons pas
      </Text>
      <Text style={{ marginTop: 2, fontSize: 7.4, color: '#334155', lineHeight: 1.4 }}>
        {angleMort.constatsLimites} constat{angleMort.constatsLimites > 1 ? 's' : ''} sur{' '}
        {angleMort.total} {angleMort.constatsLimites > 1 ? 'sont limités' : 'est limité'} par des
        données détenues hors de nos livres.
      </Text>
      {angleMort.details.map((d, i) => (
        <Text key={i} style={{ marginTop: 2, fontSize: 6.8, color: '#475569', lineHeight: 1.35 }}>
          — {d}
        </Text>
      ))}
    </View>
  );
}

export function OptimisationsFiscalesPage({
  resultat,
  piedInterne = false,
  essaiIA = false,
}: {
  resultat: ResultatAnalyse;
  /** Des textes reformulés par l'IA d'essai figurent sur la page. */
  essaiIA?: boolean;
  /**
   * Rend la mention « usage interne » en pied de CETTE page aussi.
   *
   * Posé par le document autonome. Une page photographiee seule, ou imprimee
   * hors du document, doit continuer de dire ce qu'elle est.
   */
  piedInterne?: boolean;
}) {
  const dateLisible = fmtDate(resultat.date);
  const chiffres = resultat.constats.filter((c) => c.statut === 'calcule');
  // Deux familles, deux traitements : ce sur quoi on agit, et ce qui est deja
  // correct. Les melanger noierait les bonnes nouvelles dans les cartes.
  const enOrdre = resultat.constats.filter(estDejaEnOrdre);
  const aTravailler = resultat.constats.filter((c) => !estDejaEnOrdre(c));

  return (
    <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fffdf9' }]}>
      <SectionHeader
        title="Optimisations fiscales"
        subtitle={`Au ${dateLisible}, selon les données au dossier`}
        accent={C.gold}
      />

      {/* LA MENTION DU FISCALISTE — retirable en une ligne le jour où
          `revisionFiscalisteRequise` passe à false dans strategies.ts. */}
      {resultat.revisionFiscalisteRequise && (
        <View
          style={{
            marginBottom: 11,
            paddingVertical: 5,
            paddingHorizontal: 8,
            backgroundColor: '#fffbeb',
            borderWidth: 0.8,
            borderColor: '#fbbf24',
            borderStyle: 'solid',
            borderRadius: 2,
          }}
        >
          <Text style={{ fontSize: 7.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#92400e' }}>
            Document de travail — en attente de révision par un fiscaliste
          </Text>
          <Text style={{ marginTop: 1.5, fontSize: 6.6, color: '#92400e', lineHeight: 1.35 }}>
            Les règles et les paramètres qui produisent cette page n&apos;ont pas encore été revus
            par un fiscaliste. Elle sert à préparer la discussion ; elle ne doit pas être remise au
            client sous cette forme.
          </Text>
        </View>
      )}

      {/* AUCUN TOTAL, ET C'EST LE POINT.
          Le premier rendu de cette page en portait un : 69 871 $, en gros et en
          vert. Il additionnait une perte à cristalliser, des DROITS de
          cotisation du conjoint et un gain mis à l'abri — trois natures, trois
          unités, et des droits qui ne sont pas une économie. Un chiffre
          impressionnant qui ne voulait rien dire, sur un document remis en
          rencontre. Le compte, lui, est honnête : il dit combien de pistes ont
          pu être chiffrées, sans prétendre les additionner. */}
      {chiffres.length > 0 && (
        <View
          style={{
            marginBottom: 11, paddingVertical: 6, paddingHorizontal: 9,
            backgroundColor: '#f0fce8', borderRadius: 2,
          }}
        >
          <Text style={{ fontSize: 8, color: '#2f6b12' }}>
            {chiffres.length} piste{chiffres.length > 1 ? 's' : ''} chiffrée
            {chiffres.length > 1 ? 's' : ''} sur {resultat.constats.length}
            {chiffres.length > 1
              ? ' — les montants ci-dessous sont de natures différentes et ne s’additionnent pas.'
              : '.'}
          </Text>
        </View>
      )}

      {aTravailler.map((c) => (
        <CarteConstat key={c.strategie} constat={c} />
      ))}

      {enOrdre.length > 0 && <BlocDejaEnOrdre constats={enOrdre} />}

      {resultat.angleMort && <BlocAngleMort angleMort={resultat.angleMort} />}

      {resultat.questionsRencontre.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
            À valider ensemble
          </Text>
          {resultat.questionsRencontre.map((q, i) => (
            <Text key={i} style={{ marginTop: 1.5, fontSize: 7, color: '#475569', lineHeight: 1.35 }}>
              {i + 1}. {q.charAt(0).toUpperCase()}{q.slice(1)}
            </Text>
          ))}
        </View>
      )}

      {/* Note méthodologique — sur le patron de deployment-page.tsx : d'où vient
          chaque chiffre, ce qui est affiché seulement si, et la
          non-recommandation. C'est ce qui rend la page défendable. */}
      <View style={{ marginTop: 9 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
          Comment ces constats ont été établis
        </Text>
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Chaque constat part des transactions et des relevés importés au dossier, arrêtés au{' '}
          {dateLisible}. Un montant n&apos;est affiché que lorsque toutes les données nécessaires
          sont présentes et datées ; sinon le constat porte la mention « à confirmer » ou « donnée
          manquante », et la ligne « pour aller plus loin » nomme précisément ce qui manque. Un
          compte dont le régime n&apos;est pas prouvé est écarté plutôt que présumé. Les positions
          détenues ailleurs qu&apos;ici ne sont pas visibles et ne sont donc jamais incluses.
        </Text>
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Sources : profil du client et paramètres fiscaux au dossier
          {resultat.constats[0]?.sources.length ? ` (${resultat.constats[0].sources.join(', ')})` : ''}.
          Les plafonds de cotisation proviennent des montants publiés ; ceux de l&apos;année en
          cours restent à confirmer.
        </Text>
        {essaiIA && (
          <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#b45309', lineHeight: 1.34 }}>
            Essai sur dossier fictif : certains textes de cette page ont été reformulés par une IA à
            partir des chiffres du moteur, puis vérifiés — chaque nombre, réserve et échéance doit
            correspondre au calcul, sinon le texte d’origine est conservé. Aucune donnée réelle
            n’a été transmise.
          </Text>
        )}
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Ces constats sont établis à partir des données disponibles à la date indiquée : ils ne
          préjugent pas des résultats futurs et ne constituent ni une prévision, ni une
          recommandation, ni un conseil fiscal, juridique ou en placement. Toute mise en oeuvre doit
          être validée par un fiscaliste ou un comptable au regard de la situation complète du
          client. Ce document ne remplace pas les relevés officiels ni les avis de cotisation.
        </Text>
      </View>

      {piedInterne && (
        <View fixed style={{ position: 'absolute', bottom: 18, left: 44, right: 44 }}>
          <Text style={{ fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#b91c1c' }}>
            Version conseiller — usage interne. Ne pas remettre au client.
          </Text>
        </View>
      )}
      <PageFooterV12 />
    </Page>
  );
}
