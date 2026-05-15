import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// POST — import leads from CSV/Excel
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }

  // Auto-detect column mapping
  const cols = Object.keys(rows[0]);
  const mapping = detectColumns(cols);

  const supabase = createClient();
  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  for (const row of rows) {
    const name = row[mapping.name] || '';
    const phone = (row[mapping.phone] || '').replace(/[^0-9+]/g, '');

    if (!name || phone.length < 10) {
      skipped++;
      continue;
    }

    // Check DNCL
    const { data: dncl } = await supabase
      .from('dncl_numbers')
      .select('phone')
      .eq('phone', phone)
      .single();

    const { error } = await supabase.from('leads').insert({
      name,
      business_name: row[mapping.business] || null,
      profession: row[mapping.profession] || '',
      phone,
      email: row[mapping.email] || null,
      address: row[mapping.address] || null,
      city: row[mapping.city] || '',
      region: row[mapping.region] || null,
      source: isExcel ? 'import_excel' : 'import_csv',
      status: 'new',
      dncl_checked: true,
      dncl_listed: !!dncl,
    });

    if (error) {
      if (error.code === '23505') duplicates++;
      else skipped++;
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    message: 'Import terminé',
    total: rows.length,
    inserted,
    duplicates,
    skipped,
  });
}

function detectColumns(cols: string[]): Record<string, string> {
  const lower = cols.map((c) => c.toLowerCase());
  const find = (keywords: string[]) =>
    cols[lower.findIndex((c) => keywords.some((k) => c.includes(k)))] || '';

  return {
    name: find(['nom', 'name', 'contact', 'personne']),
    phone: find(['tel', 'phone', 'téléphone', 'telephone', 'cell', 'mobile']),
    email: find(['email', 'courriel', 'mail']),
    business: find(['entreprise', 'business', 'company', 'société', 'compagnie', 'clinique', 'cabinet']),
    profession: find(['profession', 'titre', 'title', 'poste', 'métier']),
    address: find(['adresse', 'address', 'rue']),
    city: find(['ville', 'city', 'municipalité']),
    region: find(['region', 'région', 'province']),
  };
}
