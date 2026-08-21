// @vitest-environment jsdom
//
// LE CHAMP DES PERTES REPORTÉES, MONTÉ POUR DE VRAI.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST LE SEUL À DEMANDER UN DOM.
//
// Deux défauts trouvés par la revue adversariale du 21 août 2026 ne vivent
// NULLE PART dans la logique pure. Ils naissent de l'ordre des événements du
// navigateur et du décalage entre ce que l'écran affiche et ce que le serveur
// a reçu :
//
//   1. LE REFUS EFFACÉ PAR UN AUTRE GESTE. Le conseiller tape « 12 00O », voit
//      le message rouge, clique ailleurs — et le message disparaissait alors
//      que la case affichait toujours sa saisie illisible. Il croyait avoir
//      enregistré.
//
//   2. L'ÉCRITURE PARTIE D'UN INSTANTANÉ PÉRIMÉ. Taper une date puis cliquer un
//      bouton produit mousedown → blur → click. Le blur envoyait la date neuve,
//      le click repartait du même instantané et réécrivait l'ANCIENNE.
//
// Aucun test de fonction pure ne peut les attraper : appeler deux fonctions à
// la suite ne reproduit ni le blur déclenché par un mousedown, ni le rendu React
// qui n'a pas encore eu lieu. On monte donc le composant et on joue de vrais
// événements — `@testing-library/user-event` produit la séquence complète
// (pointerdown, mousedown, focus/blur, pointerup, mouseup, click).
//
// L'environnement jsdom est demandé PAR CE FICHIER SEUL (la ligne de tête
// ci-dessus). Le reste de la suite garde son environnement Node, et
// `vitest.config.ts` n'est pas touché.
//
// Données entièrement fictives.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChampPertesReportees } from '../ChampPertesReportees';
import type { PertesCapitalReportees } from '@/lib/profils/types';

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────
// Le banc d'essai — un parent qui se comporte comme le vrai
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une écriture captée : ce que l'écran a ENVOYÉ, et de quoi la faire aboutir
 * quand le test le décide.
 *
 * Le vrai parent (`ecrireFiche`) fait POST puis recharge tout le profil ; la
 * prop `brut` ne change donc qu'à la fin de l'aller-retour. On reproduit
 * exactement ce décalage : `resoudre()` met la prop à jour ET dénoue la
 * promesse, dans cet ordre.
 */
type Ecriture = { envoye: PertesCapitalReportees; resoudre: () => void };

function monter(initial: PertesCapitalReportees) {
  const ecritures: Ecriture[] = [];

  function Hote() {
    const [brut, setBrut] = useState<PertesCapitalReportees>(initial);
    return React.createElement(ChampPertesReportees, {
      brut,
      onEcrire: (v: PertesCapitalReportees) =>
        new Promise<void>((resoudre) => {
          ecritures.push({
            envoye: v,
            resoudre: () => { setBrut(v); resoudre(); },
          });
        }),
    });
  }

  render(React.createElement(Hote));
  return {
    ecritures,
    /** Ce que le serveur aurait reçu en dernier. */
    dernierEnvoi: () => ecritures.at(-1)?.envoye ?? null,
    /** Fait aboutir toutes les écritures en attente, dans l'ordre donné. */
    resoudreTout: async (ordre?: number[]) => {
      const indices = ordre ?? ecritures.map((_, i) => i);
      for (const i of indices) {
        await act(async () => { ecritures[i].resoudre(); });
      }
    },
  };
}

const champMontant = () => screen.getByLabelText(/en dollars/i) as HTMLInputElement;
const champDate = () => screen.getByLabelText(/Date du document/i) as HTMLInputElement;
const bouton = (nom: RegExp) => screen.getByRole('button', { name: nom });

const AVEC_MONTANT: PertesCapitalReportees = {
  montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
};

// ═══════════════════════════════════════════════════════════════════════════
// VERROU 1 — le refus survit à un geste sur une autre dimension
// ═══════════════════════════════════════════════════════════════════════════

describe('verrou 1 · un refus de saisie ne s’efface pas tout seul', () => {
  it('« 12 00O » puis un clic sur l’unité : le message rouge RESTE, et rien n’est écrasé', async () => {
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    // Le conseiller remplace le montant valide par une saisie illisible.
    await u.clear(champMontant());
    await u.type(champMontant(), '12 00O');
    await u.tab();                                   // il quitte le champ

    const refus = await screen.findByText(/Entrez un montant en chiffres/i);
    expect(refus).toBeTruthy();
    expect(banc.ecritures).toHaveLength(0);          // RIEN n'est parti

    // Il clique ensuite sur une qualification — un geste sans rapport.
    await u.click(bouton(/^Perte en capital brute$/));
    await banc.resoudreTout();

    // ⚠ LE CŒUR DU VERROU : le message est TOUJOURS là.
    expect(screen.queryByText(/Entrez un montant en chiffres/i)).toBeTruthy();
    // La case montre toujours la saisie refusée — pas de faux succès visuel.
    expect(champMontant().value).toBe('12 00O');
    // Et ce qui est parti au serveur porte l'ANCIEN montant, jamais la chaîne.
    expect(banc.dernierEnvoi()).toEqual({
      montant: 10000, unite: 'perte-capital-brute', source: 'inconnue', dateDonnee: '2026-07-01',
    });
  });

  it('le négatif : corriger réellement le montant fait disparaître le refus', async () => {
    // Sans ce cas, un refus « collé pour toujours » passerait le test ci-dessus.
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    await u.clear(champMontant());
    await u.type(champMontant(), '12 00O');
    await u.tab();
    expect(await screen.findByText(/Entrez un montant en chiffres/i)).toBeTruthy();

    await u.clear(champMontant());
    await u.type(champMontant(), '12000');
    await u.tab();
    await banc.resoudreTout();

    expect(screen.queryByText(/Entrez un montant en chiffres/i)).toBeNull();
    expect(banc.dernierEnvoi()?.montant).toBe(12000);
  });

  it('une saisie illisible n’écrase JAMAIS la valeur au dossier', async () => {
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    for (const illisible of ['abc', '-5000', '1 234,5,6']) {
      await u.clear(champMontant());
      await u.type(champMontant(), illisible);
      await u.tab();
    }
    expect(banc.ecritures).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Les deux refus sont indépendants
// ═══════════════════════════════════════════════════════════════════════════

describe('refus du montant et refus de la date ne se confondent pas', () => {
  it('changer la DATE n’efface pas un refus de MONTANT — les deux états sont séparés', async () => {
    // ⚠ CE QUE CE TEST A APPRIS EN ÉCHOUANT D'ABORD. Il visait une date
    // IMPOSSIBLE (« 2024-02-31 ») pour déclencher un refus de date. jsdom l'a
    // ramenée à la chaîne vide — et c'est le comportement d'un VRAI navigateur :
    // un `input type="date"` assainit sa propre valeur et ne rend jamais une
    // date qui n'existe pas. Le refus de date est donc INATTEIGNABLE par ce
    // champ ; la garde calendaire d'`analyserDateSaisie` sert la défense en
    // profondeur, et c'est la route API qui la verrouille pour de bon
    // (voir pertes-reportees-champ.test.ts).
    //
    // L'indépendance des deux refus se prouve donc dans le sens atteignable :
    // une date VALIDE part, et le refus du montant ne bouge pas.
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    await u.clear(champMontant());
    await u.type(champMontant(), '12 00O');
    await u.tab();
    expect(await screen.findByText(/Entrez un montant en chiffres/i)).toBeTruthy();

    await act(async () => {
      const d = champDate();
      d.focus();
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(d, '2026-08-15');
      d.dispatchEvent(new Event('input', { bubbles: true }));
      d.dispatchEvent(new Event('change', { bubbles: true }));
      d.blur();
    });
    await banc.resoudreTout();

    // Le refus du montant a survécu à une écriture sur une autre dimension.
    expect(screen.queryByText(/Entrez un montant en chiffres/i)).toBeTruthy();
    expect(champMontant().value).toBe('12 00O');
    // Et la date neuve est bien partie, avec l'ANCIEN montant.
    expect(banc.dernierEnvoi()).toEqual({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-08-15',
    });
  });

  it('un clic sur la SOURCE n’efface aucun des deux refus', async () => {
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    await u.clear(champMontant());
    await u.type(champMontant(), 'abc');
    await u.tab();
    expect(await screen.findByText(/Entrez un montant en chiffres/i)).toBeTruthy();

    await u.click(bouton(/^Avis de cotisation$/));
    await banc.resoudreTout();

    expect(screen.queryByText(/Entrez un montant en chiffres/i)).toBeTruthy();
    expect(banc.dernierEnvoi()?.source).toBe('avis-cotisation');
    expect(banc.dernierEnvoi()?.montant).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VERROU 2 — la séquence réelle blur → click
// ═══════════════════════════════════════════════════════════════════════════

describe('verrou 2 · saisir une date puis cliquer un bouton, sans étape entre les deux', () => {
  it('la date NEUVE et l’unité neuve arrivent toutes les deux — l’ancienne date ne revient pas', async () => {
    // ⚠ C'EST LE TEST LE PLUS IMPORTANT DU FICHIER.
    //
    // Le navigateur produit mousedown → blur → click. Le blur envoie la date
    // neuve ; le click part quelques millisecondes plus tard, AVANT que le
    // moindre aller-retour serveur ait pu revenir. Si ce second envoi repart de
    // la prop, il porte l'ANCIENNE date — et l'écrase au serveur.
    const u = userEvent.setup();
    const banc = monter({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    // Le conseiller change la date. Le champ garde le focus.
    await act(async () => {
      const d = champDate();
      d.focus();
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(d, '2026-08-15');
      d.dispatchEvent(new Event('input', { bubbles: true }));
      d.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Puis il clique le bouton. AUCUNE étape artificielle : c'est `user-event`
    // qui déclenche le blur du champ date en donnant le focus au bouton.
    await u.click(bouton(/^Perte en capital brute$/));

    // Les écritures se dénouent seulement maintenant.
    await banc.resoudreTout();

    const final = banc.dernierEnvoi();
    expect(final?.dateDonnee).toBe('2026-08-15');           // la date NEUVE
    expect(final?.unite).toBe('perte-capital-brute');       // ET l'unité neuve
    // Le défaut d'origine, nommé pour qu'on le reconnaisse s'il revient :
    expect(final).not.toEqual(expect.objectContaining({ dateDonnee: '2026-07-01' }));
  });

  it('l’ordre inverse — cliquer l’unité puis saisir la date — tient aussi', async () => {
    const u = userEvent.setup();
    const banc = monter({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    await u.click(bouton(/^Perte en capital brute$/));
    await act(async () => {
      const d = champDate();
      d.focus();
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(d, '2026-08-15');
      d.dispatchEvent(new Event('input', { bubbles: true }));
      d.dispatchEvent(new Event('change', { bubbles: true }));
      d.blur();
    });
    await banc.resoudreTout();

    expect(banc.dernierEnvoi()).toEqual({
      montant: 10000, unite: 'perte-capital-brute', source: 'inconnue', dateDonnee: '2026-08-15',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES ÉCRITURES EN VOL, ET L'ORDRE OÙ ELLES ABOUTISSENT
// ═══════════════════════════════════════════════════════════════════════════

describe('écritures concurrentes', () => {
  it('une seconde interaction pendant qu’une écriture est EN ATTENTE garde les deux réponses', async () => {
    const u = userEvent.setup();
    const banc = monter({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    // Écriture 1 : l'unité. Volontairement laissée en suspens.
    await u.click(bouton(/^Perte en capital brute$/));
    expect(banc.ecritures).toHaveLength(1);
    expect(banc.ecritures[0].envoye.unite).toBe('perte-capital-brute');

    // Écriture 2 pendant que la première n'a PAS abouti : la prop porte encore
    // l'état de départ, mais l'écran, lui, sait ce qu'il vient d'envoyer.
    await u.click(bouton(/^Avis de cotisation$/));

    // LA FILE : la seconde requête n'est pas encore PARTIE — elle attend la
    // première. C'est ce qui rend l'inversion d'ordre impossible.
    expect(banc.ecritures).toHaveLength(1);

    await act(async () => { banc.ecritures[0].resoudre(); });
    expect(banc.ecritures).toHaveLength(2);
    await act(async () => { banc.ecritures[1].resoudre(); });

    // L'état final porte LES DEUX réponses, dans l'ordre des gestes.
    expect(banc.dernierEnvoi()).toEqual({
      montant: 10000, unite: 'perte-capital-brute',
      source: 'avis-cotisation', dateDonnee: '2026-07-01',
    });
  });

  it('A · la première aboutit avant la seconde — l’écran ne recule pas', async () => {
    const u = userEvent.setup();
    const banc = monter({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    await u.click(bouton(/^Perte en capital brute$/));
    await u.click(bouton(/^Avis de cotisation$/));
    await banc.resoudreTout();                        // ordre naturel : 0 puis 1

    expect(bouton(/^Perte en capital brute$/).getAttribute('aria-pressed')).toBe('true');
    expect(bouton(/^Avis de cotisation$/).getAttribute('aria-pressed')).toBe('true');
  });

  it('B · l’inversion d’ordre est STRUCTURELLEMENT impossible, pas seulement improbable', async () => {
    // Le cahier demandait un cas « écriture 2 aboutit avant écriture 1 ». Il ne
    // peut plus être écrit : la file ne LANCE la seconde requête qu'une fois la
    // première dénouée. Le test le prouve en essayant.
    const u = userEvent.setup();
    const banc = monter({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    await u.click(bouton(/^Perte en capital brute$/));
    await u.click(bouton(/^Avis de cotisation$/));

    // Il n'existe PAS d'écriture 2 à faire aboutir en premier : elle n'est pas
    // partie. Sans la file, `ecritures` en contiendrait deux, et l'inversion
    // serait possible.
    expect(banc.ecritures).toHaveLength(1);

    await act(async () => { banc.ecritures[0].resoudre(); });
    await act(async () => { banc.ecritures[1].resoudre(); });

    // Le serveur a donc reçu, dans l'ordre : l'unité, puis l'unité + la source.
    expect(banc.ecritures.map((e) => `${e.envoye.unite}/${e.envoye.source}`)).toEqual([
      'perte-capital-brute/inconnue',
      'perte-capital-brute/avis-cotisation',
    ]);
  });

  it('la prop du dossier reprend la main dès que plus rien n’est en vol', async () => {
    // Le pendant du verrou : l'état local ne doit pas devenir une vérité
    // parallèle. Un rechargement du dossier, une fois la file vide, fait foi.
    const u = userEvent.setup();
    const banc = monter(AVEC_MONTANT);

    await u.click(bouton(/^Perte en capital brute$/));
    await banc.resoudreTout();

    expect(bouton(/^Perte en capital brute$/).getAttribute('aria-pressed')).toBe('true');
    expect(banc.dernierEnvoi()?.unite).toBe('perte-capital-brute');
  });
});
