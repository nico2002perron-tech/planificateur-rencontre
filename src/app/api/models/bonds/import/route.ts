import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { parseBondsExcel } from '@/lib/parsers/bonds-excel-parser';

/**
 * POST — Import d'un fichier Excel de bonds (Bonds CAD.xlsm ou Bonds US.xlsm)
 * Accepte multipart/form-data avec un champ "file".
 * Détecte automatiquement CAD ou US via le nom du fichier.
 * Insère les bonds dans bonds_universe (upsert sur cusip+coupon+maturity).
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
  const { bonds, stats } = parseBondsExcel(buffer, fileName);

  if (bonds.length === 0) {
    return NextResponse.json({
      error: 'Aucune obligation detectee dans le fichier',
      stats,
    }, { status: 400 });
  }

  // Insérer en batch dans Supabase
  const supabase = createClient();
  const source = fileName.toUpperCase().includes('CAD') ? 'CAD' : 'US';

  // Supprimer les anciens bonds de cette source avant d'importer
  // (remplacement complet pour éviter les doublons)
  const { error: deleteError } = await supabase
    .from('bonds_universe')
    .delete()
    .eq('source', source)
    .eq('is_mandatory', false); // ne pas supprimer les bonds obligatoires manuels

  if (deleteError) {
    return NextResponse.json({ error: `Erreur nettoyage: ${deleteError.message}` }, { status: 500 });
  }

  // Insérer par batch de 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < bonds.length; i += BATCH_SIZE) {
    const batch = bonds.slice(i, i + BATCH_SIZE).map(b => ({
      description: `${b.issuer} ${b.coupon ?? ''}% ${b.maturity ?? ''}`.trim(),
      issuer: b.issuer,
      cusip: b.cusip,
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
    stats: {
      ...stats,
      inserted,
      errors: errors.length,
    },
    ...(errors.length > 0 && { errors }),
  });
}
