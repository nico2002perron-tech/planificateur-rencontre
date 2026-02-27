import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const supabase = createClient();

    // Verify report belongs to this advisor
    const { data: report } = await supabase
      .from('reports')
      .select('id')
      .eq('id', id)
      .eq('advisor_id', session.user.id)
      .single();

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Report delete error:', error);
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
