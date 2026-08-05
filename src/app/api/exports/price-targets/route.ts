import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceTargetsDocument, type PriceTargetReportData, type PdfRenderOptions } from '@/lib/pdf/price-targets-template';
import { mergeFundPdfs } from '@/lib/pdf/merge-fund-pdfs';
import { enrichReportData } from '@/lib/pdf/enrich-report-data';
import { archiverDocument, entetesArchivage } from '@/lib/base-locale/archiver';
import { modeFiscalActif } from '@/lib/base-locale/mode';
import { profilPourClient } from '@/lib/profils/stockage';
import { analyser, restreindre } from '@/lib/profils/strategies';

export async function POST(req: NextRequest) {
  // Le nom du client transite ici (dans le body) pour être imprimé dans le PDF.
  // C'est une donnée sensible : on exige une session authentifiée dans le
  // handler lui-même (pas seulement via le middleware), par défense en profondeur.
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fundCodes, options, clientName, ...rest } = body as PriceTargetReportData & { fundCodes?: string[]; options?: PdfRenderOptions };
    const base: PriceTargetReportData = { ...rest, options, clientName };

    if (!base.holdings || base.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    // Enrichissements serveur (logos, secteurs/descriptions, calendrier des
    // revenus) — PARTAGÉS avec l'export HTML interactif pour que les deux
    // formats partent exactement des mêmes données. Voir enrich-report-data.ts.
    const reportData = await enrichReportData(base);

    // ── SECTION FISCALE : jointe ICI, jamais reçue du navigateur ──────────────
    //
    // Trois verrous, et il faut les trois :
    //   1. `modeFiscalActif()` — évalué à l'exécution côté serveur. Sur Vercel,
    //      il est faux, et ce bloc entier ne s'exécute pas. Personne ne peut
    //      réclamer cette section depuis la production, même en forgeant le
    //      corps de la requête ;
    //   2. le drapeau `includeOptimisationsFiscales === true` — le geste
    //      volontaire du planificateur dans le composeur ;
    //   3. une sélection non vide dans le profil du client. Le moteur DÉTECTE
    //      cinq pistes ; seules celles que le planificateur a cochées, avec
    //      leur date, entrent dans le document.
    //
    // Si l'un des trois manque, `optimisationsFiscales` reste `undefined` et le
    // gabarit ne rend rien. L'échec est silencieux À DESSEIN : une erreur ici
    // ne doit jamais empêcher la génération du rapport de cours cibles, qui est
    // le livrable principal.
    if (modeFiscalActif() && options?.includeOptimisationsFiscales === true && clientName?.trim()) {
      try {
        const jour = new Date().toISOString().split('T')[0];
        const profil = await profilPourClient(clientName.trim(), jour);
        const retenues = profil.selectionStrategies?.strategies ?? [];
        if (retenues.length > 0) {
          reportData.optimisationsFiscales = restreindre(analyser(profil, null, jour), retenues);
        }
      } catch (e) {
        console.error('[fiscal] section non jointe :', e);
      }
    }

    const element = React.createElement(PriceTargetsDocument, { data: reportData });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    // Merge fund fact PDFs if fund codes provided
    let finalPdfBytes: Uint8Array;
    if (fundCodes && fundCodes.length > 0) {
      finalPdfBytes = await mergeFundPdfs(buffer, fundCodes);
    } else {
      finalPdfBytes = new Uint8Array(buffer);
    }

    const date = new Date().toISOString().split('T')[0];
    // Nom de fichier NEUTRE : le nom du client n'appara\u00EEt jamais dans l'en-t\u00EAte
    // Content-Disposition (loggable par les proxies/CDN/Vercel). Il reste
    // uniquement \u00E0 l'int\u00E9rieur du PDF, qui est le livrable destin\u00E9 au client.
    const filename = `cours-cibles-${date}.pdf`;

    // ARCHIVAGE LOCAL (phase 1 de la base locale) : en exécution locale, le
    // document est aussi rangé dans C:\planificateur-donnees\documents\<Client>\.
    // Sur Vercel, `archiverDocument` sort immédiatement et n'ajoute aucun
    // en-tête : la réponse est identique à ce qu'elle était avant, au bit près.
    // L'archivage ne peut jamais faire échouer la génération.
    const archivage = await archiverDocument({
      octets: finalPdfBytes,
      nomClient: clientName,
      type: 'cours-cibles',
      date,
    });

    return new NextResponse(Buffer.from(finalPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...entetesArchivage(archivage),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération PDF' },
      { status: 500 }
    );
  }
}
