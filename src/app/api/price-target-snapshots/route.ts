import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

/**
 * Journal des cours cibles — chaque cible montrée à un client devient une
 * prédiction datée. Alimenté automatiquement à la génération d'un PDF de cours
 * cibles, et manuellement via la page Journal. Les résultats (actual_*) sont
 * remplis plus tard, quand l'horizon est atteint.
 */

type IncomingRow = {
  symbol?: string;
  name?: string;
  assetType?: string;
  quantity?: number;
  currentPrice?: number;
  targetPrice?: number;
  gainPct?: number;
  targetSource?: string;
  accountType?: string;
  accountLabel?: string;
};

function clampConviction(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= 1 && i <= 5 ? i : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 500, 2000);

  const { data, error } = await supabase
    .from('price_target_snapshots')
    .select('*')
    .eq('advisor_id', session.user.id)
    .order('predicted_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const advisorId = session.user.id;
  const body = await req.json();

  const sourceKind: 'price_targets_pdf' | 'manual' =
    body.source_kind === 'manual' ? 'manual' : 'price_targets_pdf';
  const clientName: string = (body.clientName ?? body.client_name ?? '').toString().trim();
  const conviction = clampConviction(body.conviction);
  const horizonMonths = Number.isFinite(Number(body.horizonMonths)) ? Math.round(Number(body.horizonMonths)) : 12;

  const incoming: IncomingRow[] = Array.isArray(body.rows) ? body.rows : [];

  // On ne garde que les lignes avec un symbole ET une cible réelle : ce sont
  // les seules qui constituent une prédiction.
  const rows = incoming
    .filter((r) => r && typeof r.symbol === 'string' && r.symbol.trim() && num(r.targetPrice) && Number(r.targetPrice) > 0)
    .map((r) => {
      const current = num(r.currentPrice);
      const target = num(r.targetPrice)!;
      const expectedGain =
        r.gainPct != null && Number.isFinite(Number(r.gainPct))
          ? Number(r.gainPct)
          : current && current > 0
            ? ((target - current) / current) * 100
            : null;
      return {
        symbol: r.symbol!.trim().toUpperCase(),
        name: (r.name ?? '').toString(),
        asset_type: (r.assetType ?? '').toString(),
        quantity: num(r.quantity) ?? 0,
        current_price: current,
        target_price: target,
        expected_gain_pct: expectedGain,
        target_source: (r.targetSource ?? '').toString(),
        account_type: (r.accountType ?? body.account_type ?? '').toString(),
        account_label: (r.accountLabel ?? body.account_label ?? '').toString(),
      };
    });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucune prédiction valide (symbole + cible requis)' }, { status: 400 });
  }

  const supabase = createClient();
  const batchId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

  // Dédoublonnage des captures auto : régénérer le PDF du même client le même
  // jour remplace la capture précédente (on garde la plus récente), sans
  // toucher à l'historique des autres jours ni aux saisies manuelles.
  if (sourceKind === 'price_targets_pdf') {
    await supabase
      .from('price_target_snapshots')
      .delete()
      .eq('advisor_id', advisorId)
      .eq('source_kind', 'price_targets_pdf')
      .eq('client_name', clientName)
      .eq('predicted_at', today);
  }

  const toInsert = rows.map((r) => ({
    advisor_id: advisorId,
    batch_id: batchId,
    source_kind: sourceKind,
    client_name: clientName,
    conviction,
    horizon_months: horizonMonths,
    predicted_at: today,
    ...r,
  }));

  const { data, error } = await supabase
    .from('price_target_snapshots')
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch_id: batchId, inserted: data?.length ?? 0 }, { status: 201 });
}

/**
 * Suppression d'un lot complet (toutes les lignes d'une même capture) via
 * ?batch_id=… — un PDF généré crée plusieurs lignes; ceci les retire d'un coup.
 * Pour supprimer une seule ligne, utiliser DELETE /api/price-target-snapshots/[id].
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const batchId = req.nextUrl.searchParams.get('batch_id');
  if (!batchId) {
    return NextResponse.json({ error: 'batch_id requis' }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('price_target_snapshots')
    .delete()
    .eq('advisor_id', session.user.id)
    .eq('batch_id', batchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
