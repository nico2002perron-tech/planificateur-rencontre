import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { fetchFundFactsPdf } from '@/lib/providers/funds/fetcher';
import { findManufacturer } from '@/lib/providers/funds/registry';

const BUCKET = 'fund-facts';

/**
 * POST - Auto-fetch a Fund Facts PDF by fund code.
 * Tries to download from the manufacturer's website automatically.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const fundCode = (body.fund_code as string)?.trim().toUpperCase();
  const fundName = (body.fund_name as string)?.trim() || '';

  if (!fundCode) {
    return NextResponse.json({ error: 'Code du fonds requis' }, { status: 400 });
  }

  const mfr = findManufacturer(fundCode);
  if (!mfr) {
    return NextResponse.json({
      error: `Manufacturier inconnu pour le code ${fundCode}. Veuillez uploader le PDF manuellement.`,
      supported: false,
    }, { status: 422 });
  }

  const result = await fetchFundFactsPdf(fundCode);

  if (!result.success || !result.buffer) {
    return NextResponse.json({
      error: result.error || `Impossible de télécharger le Fund Facts pour ${fundCode}`,
      manufacturer: mfr.name,
      supported: true,
    }, { status: 404 });
  }

  const supabase = createClient();

  // Check if fund already exists
  const { data: existing } = await supabase
    .from('fund_documents')
    .select('id, file_path')
    .eq('fund_code', fundCode)
    .single();

  // Delete old file if updating
  if (existing?.file_path) {
    await supabase.storage.from(BUCKET).remove([existing.file_path]);
  }

  // Upload to storage
  const fileName = `${fundCode}_fund-facts.pdf`;
  const filePath = `${fundCode}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, result.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 });
  }

  // Upsert database record
  const docData = {
    fund_code: fundCode,
    fund_name: fundName || `${mfr.name} — ${fundCode}`,
    file_name: fileName,
    file_path: filePath,
    file_size: result.buffer.length,
    uploaded_by: session.user.id,
  };

  if (existing) {
    await supabase.from('fund_documents').update(docData).eq('id', existing.id);
  } else {
    await supabase.from('fund_documents').insert(docData);
  }

  return NextResponse.json({
    success: true,
    fund_code: fundCode,
    manufacturer: mfr.name,
    source_url: result.url,
    file_size: result.buffer.length,
    message: existing
      ? `${fundCode} mis à jour depuis ${mfr.name}`
      : `${fundCode} téléchargé automatiquement depuis ${mfr.name}`,
  }, { status: existing ? 200 : 201 });
}
