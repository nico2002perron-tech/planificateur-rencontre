// LE RAPPORT FISCAL AUTONOME — LOCAL SEULEMENT.
//
// C'est ici que le volet fiscal cesse d'être un passager du PDF de cours cibles
// et devient un document à part entière.
//
// GARDE : `estLocal()` d'abord, comme toutes les routes de la base locale. Cette
// route lit un profil fiscal et imprime un nom de client ; elle n'existe pas
// hors du poste du planificateur.
//
// ARCHIVAGE : le PDF est rangé dans le dossier du client, comme les cours
// cibles. L'archivage ne peut jamais faire échouer la génération.
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { estLocal } from '@/lib/base-locale/mode';
import { archiverDocument, entetesArchivage } from '@/lib/base-locale/archiver';
import { profilPourClient } from '@/lib/profils/stockage';
import { hydraterProfil, signauxDuLivre } from '@/lib/profils/hydrater';
import { analyser, restreindre } from '@/lib/profils/strategies';
import { parametresReee } from '@/lib/profils/parametres-fiscaux';
import { OptimisationsFiscalesDocument } from '@/lib/pdf/optimisations-fiscales-document';
import { logosMemorises } from '@/lib/base-locale/logos';
import { reformuler, identifiantsDuProfil } from '@/lib/profils/reformuler';
import { iaEssaiPermise, construireAppelEssai } from '@/lib/profils/appel-llm-essai';

/**
 * LES DEUX PRÉRÉGLAGES — pas deux gabarits.
 *
 * Décision du 5 août : deux gabarits distincts, c'est deux mises en page à
 * entretenir et un jour deux histoires différentes pour le même client. Un
 * préréglage, c'est une sélection de stratégies par défaut sur la MÊME page.
 *
 *   instantané — ce qui se calcule à partir du seul portefeuille ;
 *   complet    — tout le catalogue, y compris ce qui exige la fiche.
 */
const PRESETS: Record<string, string[]> = {
  instantane: ['cristallisation-pertes', 'cristallisation-gains', 'don-titres', 'ordre-vente'],
  complet: [
    'cristallisation-pertes', 'cristallisation-gains', 'droits-cotisation',
    'localisation-actifs', 'celi-conjoint', 'don-titres', 'subvention-reee',
    'ordre-vente',
  ],
};

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  try {
    const { nomClient, preset, strategies } = (await req.json()) as {
      nomClient?: string;
      preset?: 'instantane' | 'complet';
      /** Surcharge explicite. Sinon, le préréglage fait foi. */
      strategies?: string[];
    };
    if (!nomClient?.trim()) {
      return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 });
    }

    const jour = new Date().toISOString().slice(0, 10);
    const annee = Number.parseInt(jour.slice(0, 4), 10);
    const choisi = preset === 'instantane' ? 'instantane' : 'complet';

    const profil = await profilPourClient(nomClient.trim(), jour);
    const hydrate = await hydraterProfil(profil, nomClient.trim(), annee);
    const complet = analyser(hydrate, null, jour, parametresReee(annee), await signauxDuLivre(profil, nomClient.trim(), annee));

    // Une sélection explicite l'emporte sur le préréglage ; sinon on retient
    // les stratégies du préréglage QUE LE MOTEUR A RÉELLEMENT PRODUITES.
    const voulues = strategies?.length
      ? strategies
      : PRESETS[choisi].filter((s) => complet.constats.some((c) => c.strategie === s));
    const resultat = restreindre(complet, voulues);

    // ── L'IA D'ESSAI — profils FICTIFS seulement (décision du 11 août) ──────
    //
    // Sur un dossier marqué fictif, chaque constat CHIFFRÉ passe par la couche
    // de reformulation : masquage à l'aller, vérification au retour, repli sur
    // le gabarit au moindre écart. Sur un dossier réel, ce bloc entier est
    // inerte — la conformité iA n'a pas encore parlé.
    let essaiIA = false;
    if (iaEssaiPermise(hydrate)) {
      const appel = construireAppelEssai();
      if (appel) {
        const identifiants = identifiantsDuProfil(hydrate);
        for (const c of resultat.constats) {
          if (c.statut !== 'calcule') continue;
          const r = await reformuler(c.explication, c, { appelLLM: appel, identifiants });
          if (r.origine === 'reformule') {
            c.explication = r.texte;
            essaiIA = true;
          } else if (r.motifRepli && !r.motifRepli.includes('débranchée')) {
            console.warn(`[ia-essai] repli sur gabarit (${c.strategie}) : ${r.motifRepli}`);
          }
        }
      }
    }

    if (resultat.constats.length === 0) {
      return NextResponse.json(
        { error: 'Aucune stratégie retenue : le document n’aurait rien à dire.' },
        { status: 400 }
      );
    }

    // LES LOGOS DU PLAN DE RÉCOLTE — LUS SUR LE DISQUE, jamais cherchés.
    //
    // Cette route est celle du volet fiscal : elle n'a AUCUNE sortie réseau et
    // n'en gagne pas une pour une image. Les logos viennent du cache que les
    // cours cibles ont nourri (base-locale/logos.ts). Un titre sans logo en
    // cache s'affiche avec son seul symbole — comme avant.
    const symbolesDuPlan = resultat.constats.flatMap((c) => (c.plan ?? []).map((l) => l.symbole));
    const logos = symbolesDuPlan.length ? await logosMemorises(symbolesDuPlan) : {};

    const buffer = await renderToBuffer(
      React.createElement(OptimisationsFiscalesDocument, {
        donnees: { resultat, nomClient: nomClient.trim(), preset: choisi, essaiIA, logos },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );
    const octets = new Uint8Array(buffer);

    const archivage = await archiverDocument({
      octets, nomClient: nomClient.trim(), type: 'optimisations-fiscales', date: jour,
    });

    return new NextResponse(Buffer.from(octets), {
      headers: {
        'Content-Type': 'application/pdf',
        // NOM DE FICHIER NEUTRE : le nom du client reste À L'INTÉRIEUR du PDF.
        // Un en-tête Content-Disposition transite par des journaux ; le contenu
        // du document, lui, ne quitte pas le poste.
        'Content-Disposition': `attachment; filename="optimisations-fiscales-${jour}.pdf"`,
        ...entetesArchivage(archivage),
      },
    });
  } catch (err) {
    console.error('[rapport-fiscal]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération' },
      { status: 500 }
    );
  }
}
