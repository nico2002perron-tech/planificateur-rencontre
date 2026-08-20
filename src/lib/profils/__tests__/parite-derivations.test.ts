// LA PARITÉ — l'ancienne dérivation et la ligne du temps, côte à côte.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE (19 août 2026, consigne 16 de Nicolas).
//
// La ligne du temps vit EN PARALLÈLE des dérivations historiques
// (`deriverCeliParAnnee`, `deriverCotisationsAnnee`, `deriverTransactionsAnnee`)
// le temps d'être comparée. Ce fichier est la comparaison : sur les mêmes
// fixtures, là où les deux systèmes mesurent la même chose, ils doivent rendre
// LE MÊME CHIFFRE — et là où ils divergent, la divergence est ASSERTÉE DES DEUX
// CÔTÉS, documentée, et un camp est désigné.
//
// LES DIVERGENCES CONNUES, TOUTES VOULUES (la timeline est plus prudente) :
//
//   D1 · un RETRAIT dont la note cite un compte du client : l'ancien le compte
//        en retrait ; la timeline le classe virement interne (règle 3 étendue
//        aux retraits). Camp correct : LA TIMELINE — un virement vers son
//        propre compte n'est pas une sortie externe. L'ancien comportement
//        reste inchangé tant que les stratégies le consomment.
//
//   D2 · un RETRAIT EN TITRES (jambe titre) : l'ancien le compte ; la timeline
//        le laisse en confiance dégradée (l'appariement du retrait en nature
//        n'est pas fait). Camp correct : INDÉCIS — à trancher à l'étape 4.
//
//   D3 · une cotisation REEE SANS bénéficiaire dans la note : l'ancien la
//        JETTE (l'enfant ressort avec 0 cotisé) ; la timeline la garde sous
//        « (inconnu) ». Camp correct : LA TIMELINE — un montant réel ne
//        disparaît pas ; mais l'ancien reste le bon pour le CALCUL DE LA
//        SUBVENTION par enfant nommé (il ne sur-attribue jamais).
//
//   D4 · une conversion FX : l'ancien ne la voit pas du tout (elle ne touche
//        ni cotisations ni retraits enregistrés — aucune différence de chiffre,
//        mais la timeline la NOMME au lieu de l'ignorer).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps } from '../ligne-du-temps';
import { deriverCeliParAnnee, deriverCotisationsAnnee, deriverTransactionsAnnee } from '../deriver';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function tx(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2026-03-15', dateReglement: '2026-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}
const CELI = '37-FICT-W';
const CELI2 = '37-AUTR-W';
const REER = '37-FICT-S';
const REEE = '37-FICT-Z';

const montantCad = (p: Record<string, { montant: number }> | undefined) => p?.['CAD']?.montant ?? 0;

describe('là où les deux systèmes mesurent la même chose, le même chiffre', () => {
  it('cotisations CELI par année : argent neuf identique, multi-comptes, multi-années', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, date: '2024-05-01', total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2025-04-01', total: 6500 }),
      tx({ type: 'Cotisation', noCompte: CELI2, date: '2025-06-01', total: 500 }),
      // partie double : jambe argent + jambe titre étiquetée cotisation (consomme des droits)
      tx({ type: 'Cotisation', noCompte: CELI, date: '2026-02-01', total: 12000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2026-02-01', symbole: 'FNB', quantite: 100, total: -12000, note: 'COTISATION EN TITRES' }),
      // partie double : jambe titre étiquetée TRANSFERT (ne consomme rien)
      tx({ type: 'Cotisation', noCompte: CELI, date: '2026-03-01', total: 9000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2026-03-01', symbole: 'TD', quantite: 55, total: -9000, note: 'TRANSFERE A 37AUTRW' }),
      // du bruit qui ne doit toucher aucun des deux
      tx({ type: 'Achat', noCompte: CELI, date: '2025-05-01', symbole: 'XYZ', total: -3000 }),
      tx({ type: 'Dividendes', noCompte: CELI, date: '2025-07-01', symbole: 'XYZ', total: 80 }),
    ];
    const ancien = deriverCeliParAnnee(lignes);
    const t = construireLigneDuTemps(lignes);

    for (const annee of ['2024', '2025', '2026']) {
      expect(montantCad(t.parAnnee[annee]?.celi.cotisations), `cotisations ${annee}`)
        .toBe(ancien.cotisations[annee] ?? 0);
    }
    // LES LITTÉRAUX, ANCRÉS — sans eux, un même bug dans les deux systèmes
    // (ils partagent typeDeCompte et separerCotisations) passerait la parité.
    expect(ancien.cotisations['2024']).toBe(6000);
    expect(ancien.cotisations['2025']).toBe(7000);   // 6 500 + 500 sur l'autre compte
    // 2026 : 12 000 comptés (en titres = cotisation), 9 000 écartés (transfert)
    expect(ancien.cotisations['2026']).toBe(12000);
  });

  it('retraits CELI par année : identiques quand les retraits sont francs (sans note, en argent)', () => {
    const lignes = [
      tx({ type: 'Retrait', noCompte: CELI, date: '2025-09-01', total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, date: '2025-11-01', total: -1500 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2025-01-01', total: 6500 }),
    ];
    const ancien = deriverCeliParAnnee(lignes);
    const t = construireLigneDuTemps(lignes);
    expect(montantCad(t.parAnnee['2025'].celi.retraits)).toBe(ancien.retraits['2025']);
    expect(ancien.retraits['2025']).toBe(3500);
  });

  it('cotisations REER de l’année : identiques', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: REER, total: 12000 }),
      tx({ type: 'Cotisation', noCompte: REER, total: 3000 }),
    ];
    const ancien = deriverCotisationsAnnee(lignes, 2026);
    const t = construireLigneDuTemps(lignes);
    expect(montantCad(t.parAnnee['2026'].reer.cotisations)).toBe(ancien.reer);
    expect(ancien.reer).toBe(15000);
  });

  it('REEE par bénéficiaire NOMMÉ : identiques', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'CONTRIBUTION 01ENFANTA' }),
      tx({ type: 'Dépôt', noCompte: REEE, total: 1000, note: 'COTIS 02ENFANTB' }),
    ];
    const ancien = deriverCotisationsAnnee(lignes, 2026).reeeParEnfant;
    const t = construireLigneDuTemps(lignes);
    const nouveau = t.parAnnee['2026'].reee.parBeneficiaire;
    expect(montantCad(nouveau['ENFANTA'])).toBe(ancien['ENFANTA']);
    expect(montantCad(nouveau['ENFANTB'])).toBe(ancien['ENFANTB']);
    expect(ancien['ENFANTA']).toBe(2500);
    expect(ancien['ENFANTB']).toBe(1000);
  });
});

describe('les divergences connues — assertées des deux côtés, jamais ignorées', () => {
  it('D1 · retrait dont la note cite un compte : 7 000 $ pour l’ancien, virement interne pour la timeline', () => {
    const lignes = [tx({ type: 'Retrait', noCompte: CELI, total: -7000, note: 'TRANSFERE A 37FICTA' })];
    const ancien = deriverCeliParAnnee(lignes);
    const t = construireLigneDuTemps(lignes);

    expect(ancien.retraits['2026']).toBe(7000);                       // l'ancien compte
    expect(t.parAnnee['2026'].celi.retraits).toEqual({});             // la timeline, non
    expect(t.virementsInternes).toHaveLength(1);                      // elle DIT où c'est parti
    // Camp correct : la timeline — un virement vers son propre compte n'est pas
    // une sortie. MAIS l'ancien nourrit encore les droits CELI (un retrait
    // sur-compté = des droits SUR-estimés l'année suivante) : à trancher quand
    // la timeline deviendra la source, pas silencieusement ici.
  });

  it('D2 · retrait EN TITRES : compté par l’ancien, confiance dégradée dans la timeline', () => {
    const lignes = [tx({ type: 'Retrait', noCompte: CELI, symbole: 'TD', quantite: 40, total: -5000 })];
    const ancien = deriverCeliParAnnee(lignes);
    const t = construireLigneDuTemps(lignes);

    expect(ancien.retraits['2026']).toBe(5000);
    expect(t.parAnnee['2026'].celi.retraits).toEqual({});
    expect(t.diagnostics.dispositions.ambigu).toBe(1);
    // Camp : INDÉCIS — le retrait en nature existe, mais son appariement
    // (étape 4) n'est pas fait. La timeline préfère le déclarer que le sommer.
  });

  it('D3 · cotisation REEE sans bénéficiaire : JETÉE par l’ancien, « (inconnu) » dans la timeline', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'COTISATION' })];
    const ancien = deriverCotisationsAnnee(lignes, 2026).reeeParEnfant;
    const t = construireLigneDuTemps(lignes);

    expect(ancien).toEqual({});                                        // l'ancien perd le montant
    expect(montantCad(t.parAnnee['2026'].reee.parBeneficiaire['(inconnu)'])).toBe(2500);
    // Camp : la timeline pour la COMPTABILITÉ (rien ne disparaît) ; l'ancien
    // pour la SUBVENTION par enfant nommé (il ne sur-attribue jamais).
  });

  it('D4 · une conversion FX ne change AUCUN chiffre de l’ancien — la timeline la nomme au lieu de l’ignorer', () => {
    const lignes = [
      tx({ type: 'Transfert', noCompte: '37-FICT-E', total: -13252, note: 'AU F1 TAUX 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: 10000 }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
    ];
    const ancien = deriverCeliParAnnee(lignes);
    const ancienTx = deriverTransactionsAnnee(lignes, 2026);
    const t = construireLigneDuTemps(lignes);

    expect(ancien.cotisations['2026']).toBe(7000);                     // l'ancien : inchangé
    expect(ancienTx.retraitsCeli).toBe(0);
    expect(montantCad(t.parAnnee['2026'].celi.cotisations)).toBe(7000);  // la timeline : pareil…
    expect(t.parAnnee['2026'].nonEnregistre.conversionsDevise).toHaveLength(1);  // …plus la conversion, nommée
  });

  it('D5 · devises MÉLANGÉES par l’ancien : 6 000 CAD + 1 000 USD = « 7 000 » d’un côté, deux agrégats de l’autre', () => {
    // Trouvé par la contre-expertise du 19 août. Le défaut vit dans l'ANCIEN :
    // separerCotisations ignore la devise, donc les droits CELI additionnent
    // aujourd'hui des dollars US à des dollars CA. Camp correct : LA TIMELINE.
    // ⚠ À SIGNALER À NICOLAS : tout client qui cotise en USD à un régime
    // enregistré a des chiffres de droits potentiellement faux dans l'ancien
    // système — défaut PRÉ-EXISTANT, hors de ce lot, non corrigé ici.
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
    ];
    const ancien = deriverCeliParAnnee(lignes);
    const t = construireLigneDuTemps(lignes);

    expect(ancien.cotisations['2026']).toBe(7000);                    // l'ancien fond les devises
    expect(t.parAnnee['2026'].celi.cotisations['CAD'].montant).toBe(6000);
    expect(t.parAnnee['2026'].celi.cotisations['USD'].montant).toBe(1000);
  });

  it('D6 · REEE : une subvention (SCEE) et un transfert noté (REF: compte) ne sont JAMAIS des cotisations fermes dans la timeline', () => {
    const lignes = [
      // Subvention : l'ancien la JETTE (pas de bénéficiaire au motif) ; la
      // timeline la déclare ambiguë — ce n'est pas l'argent du client.
      tx({ type: 'Dépôt', noCompte: REEE, total: 500, note: 'SUBVENTION SCEE VERSEMENT' }),
      // « CONTRIBUTION REF: <compte> » : l'ancien l'attribue à un enfant nommé
      // « REF » (la regex prend le mot suivant) ; la timeline y voit la règle 5
      // — un virement, pas de l'argent neuf.
      tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'CONTRIBUTION REF: 37FICTA' }),
    ];
    const ancien = deriverCotisationsAnnee(lignes, 2026).reeeParEnfant;
    const t = construireLigneDuTemps(lignes);

    expect(ancien['REF']).toBe(2500);                                  // l'ancien invente l'enfant « REF »
    expect(ancien['SCEE']).toBeUndefined();                            // et jette la subvention
    expect(t.parAnnee['2026']?.reee.parBeneficiaire ?? {}).toEqual({}); // la timeline : RIEN de ferme
    expect(t.ambigus.length + t.virementsInternes.length).toBe(2);     // tout est déclaré
    // Camp : LA TIMELINE des deux côtés — un enfant « REF » n'existe pas, et
    // une subvention ne consomme pas le plafond à vie.
  });
});
