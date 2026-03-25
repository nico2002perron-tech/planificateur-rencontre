import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'fund-facts';

/** GET - Download a fund document PDF */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  const { data: doc } = await supabase
    .from('fund_documents')
    .select('file_path, file_name, fund_code')
    .eq('id', id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  const { data: fileData, error } = await supabase.storage
    .from(BUCKET)
    .download(doc.file_path);

  if (error || !fileData) {
    return NextResponse.json({ error: 'Erreur de téléchargement' }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.fund_code}_${doc.file_name}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
