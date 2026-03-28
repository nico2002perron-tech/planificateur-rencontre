import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import {
  parseBondsExcel,
  parseRepartitionExcel,
  isRepartitionFormat,
} from '@/lib/parsers/bonds-excel-parser';

/**
 * POST — Import d'un fichier Excel de bonds.
 * Auto-detecte le format:
 *   - "Répartition d'actifs.xlsx" (Croesus mensuel IA) → parseRepartitionExcel
 *   - "Bonds CAD.xlsm / Bonds US.xlsm" → parseBondsExcel
 * Accepte multipart/form-data avec un champ "file".
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
  }

  const fileName = file.name;
  if (!fileName.match(/\.(xlsx|xlsm|xls)$/i)) {
    return NextResponse.json({ error: 'Format invalide. Fichiers acceptes : .xlsx, .xlsm, .xls' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // Auto-detect format
  const isRepartition = isRepartitionFormat(buffer);
  const { bonds, stats } = isRepartition
    ? parseRepartitionExcel(buffer, fileName)
    : parseBondsExcel(buffer, fileName);

  if (bonds.length === 0) {
    return NextResponse.json({
      error: 'Aucune obligation detectee dans le fichier',
      stats,
    }, { status: 400 });
  }

  const supabase = createClient();

  // Determine source for cleanup
  const source = isRepartition
    ? 'CAD'
    : (fileName.toUpperCase().includes('CAD') ? 'CAD' : 'US');

  // Supprimer les anciens bonds de cette source avant d'importer
  const { error: deleteError } = await supabase
    .from('bonds_universe')
    .delete()
    .eq('source', source)
    .eq('is_mandatory', false);

  if (deleteError) {
    return NextResponse.json({ error: `Erreur nettoyage: ${deleteError.message}` }, { status: 500 });
  }

  // ── Déduplication : récupérer les bonds restants (mandatory, manual, autre source) ──
  const { data: remainingBonds } = await supabase
    .from('bonds_universe')
    .select('id, cusip, description, is_mandatory');

  const existingCusips = new Set<string>();
  const existingDescs = new Set<string>();
  const mandatoryToUpdate: Map<string, string> = new Map(); // cusip/desc key → id

  for (const rb of (remainingBonds || [])) {
    if (rb.cusip?.trim()) {
      const key = rb.cusip.trim().toUpperCase();
      existingCusips.add(key);
      if (rb.is_mandatory) mandatoryToUpdate.set(`cusip:${key}`, rb.id);
    }
    if (rb.description?.trim()) {
      const key = rb.description.trim().toUpperCase();
      existingDescs.add(key);
      if (rb.is_mandatory) mandatoryToUpdate.set(`desc:${key}`, rb.id);
    }
  }

  // Filtrer les doublons (vs existants + au sein du fichier)
  const seenCusips = new Set<string>();
  const seenDescs = new Set<string>();
  let skippedDuplicates = 0;
  const mandatoryUpdates: { id: string; data: Record<string, unknown> }[] = [];

  const uniqueBonds = bonds.filter(b => {
    const cusip = (b.cusip || '').trim().toUpperCase();
    const desc = (b.description_raw || `${b.issuer} ${b.coupon ?? ''}% ${b.maturity ?? ''}`.trim()).trim().toUpperCase();

    // Doublon intra-fichier
    if (cusip && seenCusips.has(cusip)) { skippedDuplicates++; return false; }
    if (!cusip && desc && seenDescs.has(desc)) { skippedDuplicates++; return false; }

    // Marquer comme vu
    if (cusip) seenCusips.add(cusip);
    if (desc) seenDescs.add(desc);

    // Match un bond mandatory → mettre à jour au lieu de dupliquer
    const mandatoryId = (cusip && mandatoryToUpdate.get(`cusip:${cusip}`))
      || mandatoryToUpdate.get(`desc:${desc}`);
    if (mandatoryId) {
      mandatoryUpdates.push({
        id: mandatoryId,
        data: { price: b.price, yield: b.yield, spread: b.spread, coupon: b.coupon, updated_at: new Date().toISOString() },
      });
      skippedDuplicates++;
      return false;
    }

    // Match un bond existant (manual ou autre source) → skip
    if (cusip && existingCusips.has(cusip)) { skippedDuplicates++; return false; }
    if (!cusip && desc && existingDescs.has(desc)) { skippedDuplicates++; return false; }

    return true;
  });

  // ── Mettre à jour les bonds mandatory avec les données fraîches ──
  let updatedMandatory = 0;
  for (const { id, data } of mandatoryUpdates) {
    const { error: updErr } = await supabase
      .from('bonds_universe')
      .update(data)
      .eq('id', id);
    if (!updErr) updatedMandatory++;
  }

  // ── Insérer les bonds uniques par batch de 500 ──
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < uniqueBonds.length; i += BATCH_SIZE) {
    const batch = uniqueBonds.slice(i, i + BATCH_SIZE).map(b => ({
      description: b.description_raw || `${b.issuer} ${b.coupon ?? ''}% ${b.maturity ?? ''}`.trim(),
      issuer: b.issuer,
      cusip: b.cusip || null,
      coupon: b.coupon,
      maturity: b.maturity,
      price: b.price,
      yield: b.yield,
      spread: b.spread,
      category: b.category,
      source: b.source,
      rating_sp: b.rating_sp || null,
      rating_dbrs: b.rating_dbrs || null,
      is_mandatory: false,
      created_by: session.user.id,
    }));

    const { error } = await supabase
      .from('bonds_universe')
      .insert(batch);

    if (error) {
      errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return NextResponse.json({
    source,
    fileName,
    format: isRepartition ? 'repartition' : 'bonds',
    stats: {
      ...stats,
      inserted,
      updatedMandatory,
      skippedDuplicates,
      errors: errors.length,
    },
    ...(errors.length > 0 && { errors }),
  });
}
