import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// POST — upload DNCL list (CSV/Excel with phone numbers)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const supabase = createClient();
  let added = 0;

  for (const row of rows) {
    // Try to find a phone column
    const values = Object.values(row);
    for (const val of values) {
      const phone = String(val).replace(/[^0-9+]/g, '');
      if (phone.length >= 10) {
        const { error } = await supabase
          .from('dncl_numbers')
          .upsert({ phone }, { onConflict: 'phone' });
        if (!error) added++;
        break;
      }
    }
  }

  // Flag existing leads as DNCL-listed
  const { data: dnclNumbers } = await supabase.from('dncl_numbers').select('phone');
  if (dnclNumbers && dnclNumbers.length > 0) {
    const phones = dnclNumbers.map((d: { phone: string }) => d.phone);
    await supabase
      .from('leads')
      .update({ dncl_checked: true, dncl_listed: true })
      .in('phone', phones);
  }

  return NextResponse.json({
    message: `${added} numéros DNCL ajoutés`,
    added,
  });
}
