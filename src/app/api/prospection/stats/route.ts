import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const supabase = createClient();

  // Pool stats
  const { count: totalPool } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .is('claimed_by', null)
    .eq('dncl_listed', false);

  // My leads
  const { data: myLeads } = await supabase
    .from('leads')
    .select('status')
    .eq('claimed_by', userId);

  // My activities
  const { count: myActivities } = await supabase
    .from('lead_activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // By profession
  const { data: byProfession } = await supabase
    .from('leads')
    .select('profession')
    .eq('claimed_by', userId);

  // Count by status
  const statusCounts: Record<string, number> = {};
  (myLeads || []).forEach((l: { status: string }) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  // Count by profession
  const profCounts: Record<string, number> = {};
  (byProfession || []).forEach((l: { profession: string }) => {
    if (l.profession) profCounts[l.profession] = (profCounts[l.profession] || 0) + 1;
  });

  const myTotal = myLeads?.length || 0;
  const myClients = statusCounts['client'] || 0;

  return NextResponse.json({
    total_pool: totalPool || 0,
    my_leads: myTotal,
    my_calls: myActivities || 0,
    my_meetings: statusCounts['meeting'] || 0,
    my_conversions: myClients,
    conversion_rate: myTotal > 0 ? Math.round((myClients / myTotal) * 100) : 0,
    by_status: statusCounts,
    by_profession: Object.entries(profCounts)
      .map(([profession, count]) => ({ profession, count }))
      .sort((a, b) => b.count - a.count),
  });
}
