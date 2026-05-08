import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_profiles')
    .select('display_name, role_title, bio, photo_url, certifications, languages, years_experience, linkedin_url, instagram_url, facebook_url, twitter_url, website_url, badge, category, initials, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by category
  const grouped: Record<string, typeof data> = {};
  for (const profile of data) {
    const cat = profile.category || 'conseiller';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(profile);
  }

  const response = NextResponse.json({ profiles: data, grouped });

  // CORS headers for the public site
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET');
  response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
