import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import type { PriceTargetReportData, PdfRenderOptions } from '@/lib/pdf/price-targets-template';
import { enrichReportData } from '@/lib/pdf/enrich-report-data';
import { buildFilmData, type TransparencySnapshot } from '@/lib/film/build-film-data';
import { renderFilmHtml } from '@/lib/film/render-html';

// Lecture de polices et d'images sur le disque + enrichissements réseau.
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/exports/price-targets/html — « Rapport vivant ».
 *
 * Même contrat de corps que l'export PDF (`../route.ts`), plus `priorSnapshots` :
 * l'historique des prédictions du client, que SEUL le navigateur peut aller
 * chercher (l'index du coffre est calculé côté client — voir
 * PLAN-RAPPORT-VIVANT.md §2.4). La route ne le cherche jamais elle-même.
 *
 * Renvoie un fichier HTML AUTONOME : polices, logo, styles, script et données
 * incorporés. Aucun hébergement, aucune donnée conservée côté serveur.
 */
export async function POST(req: NextRequest) {
  // Le nom du client transite dans le corps pour être affiché dans le document :
  // on exige une session dans le handler lui-même (défense en profondeur), comme
  // pour l'export PDF.
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fundCodes, priorSnapshots, options, clientName, ...rest } =
      body as PriceTargetReportData & {
        fundCodes?: string[];
        priorSnapshots?: TransparencySnapshot[];
        options?: PdfRenderOptions;
      };
    // Les codes de fonds ne servent qu'au PDF : on les écarte du corps pour ne pas
    // les incorporer inutilement dans le fichier HTML remis au client.
    void fundCodes;
    const base: PriceTargetReportData = { ...rest, options, clientName };

    if (!base.holdings || base.holdings.length === 0) {
      return NextResponse.json({ error: 'Aucune position fournie' }, { status: 400 });
    }

    // Exactement les mêmes enrichissements que le PDF — c'est ce qui garantit que
    // les deux formats ne raconteront jamais deux histoires différentes.
    const reportData = await enrichReportData(base);

    const film = buildFilmData({
      report: reportData,
      priorSnapshots: Array.isArray(priorSnapshots) ? priorSnapshots : undefined,
      advisor: session.user?.name || undefined,
    });
    const { html } = renderFilmHtml(film, reportData);

    // Nom de fichier NEUTRE : le nom du client n'apparaît jamais dans l'en-tête
    // Content-Disposition (loggable par les proxies/CDN). Il ne vit qu'à
    // l'intérieur du document, qui est le livrable destiné au client.
    const date = new Date().toISOString().split('T')[0];
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="rapport-vivant-${date}.html"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('HTML export error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération du rapport vivant' },
      { status: 500 }
    );
  }
}
