import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { scrapePagesJaunes } from '@/lib/prospection/scraper';

// POST — trigger a scrape
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { profession, city, max_results = 50 } = await req.json();
  if (!profession || !city) {
    return NextResponse.json({ error: 'Profession et ville requises' }, { status: 400 });
  }

  const limit = Math.min(max_results, 50); // Cap at 50 per day

  try {
    const scraped = await scrapePagesJaunes(profession, city, limit);

    if (scraped.length === 0) {
      return NextResponse.json({
        message: 'Aucun résultat trouvé. Le site a peut-être changé de structure.',
        inserted: 0,
        duplicates: 0,
      });
    }

    const supabase = createClient();
    let inserted = 0;
    let duplicates = 0;

    for (const lead of scraped) {
      // Check DNCL
      const { data: dncl } = await supabase
        .from('dncl_numbers')
        .select('phone')
        .eq('phone', lead.phone)
        .single();

      const { error } = await supabase.from('leads').insert({
        name: lead.name,
        business_name: lead.business_name,
        profession: lead.profession,
        phone: lead.phone,
        address: lead.address,
        city: lead.city,
        source: 'scrape_pj',
        status: 'new',
        dncl_checked: !!dncl || true,
        dncl_listed: !!dncl,
      });

      if (error) {
        if (error.code === '23505') {
          duplicates++;
        }
      } else {
        inserted++;
      }
    }

    return NextResponse.json({
      message: `Scraping terminé`,
      scraped: scraped.length,
      inserted,
      duplicates,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur de scraping: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
