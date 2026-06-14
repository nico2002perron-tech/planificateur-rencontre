import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildIcs } from '@/lib/calendar';

// GET /api/events/[id]/ics — fichier calendrier (.ics) public pour Apple Calendrier / Outlook bureau.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const { data: ev, error } = await supabase
    .from('events')
    .select('id, title, date, time, location, description')
    .eq('id', id)
    .single();

  if (error || !ev) return new NextResponse('Evenement introuvable', { status: 404 });

  const ics = buildIcs(ev);
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="evenement.ics"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
