import { NextRequest, NextResponse } from 'next/server';

// Proxy de géocodage / autocomplétion d'adresse via Nominatim (OpenStreetMap).
// Gratuit, sans clé API. On passe par le serveur pour respecter la politique
// d'usage (User-Agent valide) et éviter les soucis CORS côté navigateur.
// Biais Canada + français pour des résultats pertinents au Québec.

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  address?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 3) return NextResponse.json([]);

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      countrycodes: 'ca',
      'accept-language': 'fr',
    }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim exige un User-Agent identifiant l'application.
        'User-Agent': 'PlanificateurRencontre/1.0 (groupefinancierstefoy.com)',
        'Accept-Language': 'fr',
      },
      // Cache léger : limite les appels répétés et respecte la limite de débit.
      next: { revalidate: 600 },
    });

    if (!res.ok) return NextResponse.json([]);
    const data: NominatimItem[] = await res.json();

    const results = (data || []).map(item => {
      const a = item.address || {};
      // Libellé court : nom du lieu / numéro+rue, puis ville, province.
      const line1 =
        item.name ||
        [a.house_number, a.road].filter(Boolean).join(' ') ||
        a.amenity ||
        a.tourism ||
        '';
      const city = a.city || a.town || a.village || a.municipality || a.hamlet || '';
      const region = a.state || a.province || '';
      const short = [line1, city, region].filter(Boolean).join(', ') || item.display_name;
      return {
        label: short,
        full: item.display_name,
        lat: item.lat,
        lon: item.lon,
        // Lien Google Maps précis (pin sur les coordonnées).
        maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lon}`)}`,
      };
    });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
