import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'fund-facts';

/** DELETE - Remove a fund document */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createClient();

  // Get file path before deleting
  const { data: doc } = await supabase
    .from('fund_documents')
    .select('file_path')
    .eq('id', id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  // Delete from storage
  if (doc.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
  }

  // Delete from database
  const { error } = await supabase
    .from('fund_documents')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
