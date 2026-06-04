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
  averageCost?: number; // PBR (prix de base rajusté / prix payé)
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

  // Filtre optionnel par client (index aveugle). Quand absent, comportement
  // inchangé : toutes les captures du conseiller. Utilisé par « Prêt à coller »
  // pour retrouver l'historique d'un client sans révéler son nom.
  const nameIdx = req.nextUrl.searchParams.get('nameIdx')?.trim();

  let query = supabase
    .from('price_target_snapshots')
    .select('*')
    .eq('advisor_id', session.user.id);

  if (nameIdx) query = query.eq('name_idx', nameIdx);

  const { data, error } = await query
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

  // Coffre client : le nom n'arrive JAMAIS en clair. On reçoit seulement le nom
  // chiffré (name_enc) et l'index aveugle déterministe (name_idx). L'index est
  // obligatoire — c'est lui qui regroupe/dédoublonne les captures d'un client.
  const nameEnc: string | null = typeof body.nameEnc === 'string' ? body.nameEnc : null;
  const nameIdx: string = typeof body.nameIdx === 'string' ? body.nameIdx.trim() : '';
  if (!nameIdx) {
    return NextResponse.json({ error: 'Coffre verrouillé : nameIdx requis (nom chiffré).' }, { status: 400 });
  }

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
        average_cost: num(r.averageCost),
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
  // Le dédoublonnage se fait sur l'index aveugle (déterministe), pas sur le nom.
  if (sourceKind === 'price_targets_pdf') {
    await supabase
      .from('price_target_snapshots')
      .delete()
      .eq('advisor_id', advisorId)
      .eq('source_kind', 'price_targets_pdf')
      .eq('name_idx', nameIdx)
      .eq('predicted_at', today);
  }

  const toInsert = rows.map((r) => ({
    advisor_id: advisorId,
    batch_id: batchId,
    source_kind: sourceKind,
    client_name: '', // plus jamais de nom en clair
    name_enc: nameEnc,
    name_idx: nameIdx,
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

/**
 * Migration des anciennes captures : remplace les noms stockés en clair
 * (client_name) par leur version chiffrée (name_enc) + index aveugle (name_idx),
 * calculés dans le navigateur. Body : { updates: [{ id, nameEnc, nameIdx }] }.
 * Chaque mise à jour est restreinte aux lignes du conseiller courant, et vide
 * client_name au passage.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { id?: string; nameEnc?: string; nameIdx?: string }[] = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
  if (updates.length > 2000) return NextResponse.json({ error: 'Trop de lignes à la fois' }, { status: 400 });

  const supabase = createClient();
  const advisorId = session.user.id;
  let updated = 0;

  for (const u of updates) {
    if (!u.id || typeof u.nameIdx !== 'string' || !u.nameIdx.trim()) continue;
    const { error } = await supabase
      .from('price_target_snapshots')
      .update({ name_enc: u.nameEnc ?? null, name_idx: u.nameIdx.trim(), client_name: '' })
      .eq('id', u.id)
      .eq('advisor_id', advisorId);
    if (!error) updated++;
  }

  return NextResponse.json({ updated });
}
