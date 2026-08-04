import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import { getProfile } from '@/lib/fmp/client';
import { renderPropositionReport, type PropositionRow } from '@/lib/pdf/proposition-report';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Télécharge un logo distant en data URI (borné, tolérant aux échecs).
async function fetchLogo(url?: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/png';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 400_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

function parseRange(range?: string): [number, number] | undefined {
  if (!range) return undefined;
  const m = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (!m) return undefined;
  const lo = parseFloat(m[1]), hi = parseFloat(m[2]);
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? [lo, hi] : undefined;
}

// POST /api/proposition/pdf — « Proposition de portefeuille » PDF (présentation
// complète : couverture, diversification, revenu, fiches de titres, projection).
// Le corps porte les lignes déjà calculées et en CAD ; la route enrichit chaque
// titre (secteur, pays, dividende, ratios, fourchette 52 sem, description, logo)
// via /profile. Rendu ponctuel — le nom du client n'est ni stocké ni journalisé.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });

  const client = String(body.client || '').trim();
  const amount = Number(body.amount);
  const context = body.context === 'elsewhere' ? 'elsewhere' : 'new';
  if (!client) return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
  if (!Array.isArray(body.rows) || body.rows.length === 0) return NextResponse.json({ error: 'Aucun titre' }, { status: 400 });

  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const baseRows: PropositionRow[] = body.rows.slice(0, 60).map((r: Record<string, unknown>) => ({
    symbol: String(r.symbol || '').slice(0, 20),
    name: String(r.name || r.symbol || '').slice(0, 80),
    currency: r.currency === 'USD' ? 'USD' : 'CAD',
    weight: num(r.weight),
    price: num(r.price),
    target: num(r.target),
    targetLow: num(r.targetLow),
    targetHigh: num(r.targetHigh),
    alloc: num(r.alloc),
    gainPct: r.gainPct === null || r.gainPct === undefined ? null : num(r.gainPct),
    source: r.source ? String(r.source).slice(0, 40) : undefined,
    pe: num(r.pe) || undefined,
  }));

  // Enrichissement par titre (profil + logo), tolérant aux échecs individuels.
  const rows = await Promise.all(baseRows.map(async (r) => {
    const profile = await getProfile(r.symbol).catch(() => null);
    if (!profile) return r;
    const nativePrice = profile.price || 0;
    const fx = nativePrice > 0 && r.price > 0 ? r.price / nativePrice : 1;
    const nativeRange = parseRange(profile.range);
    const range52: [number, number] | undefined = nativeRange ? [nativeRange[0] * fx, nativeRange[1] * fx] : undefined;
    const divYield = nativePrice > 0 && profile.lastDiv > 0 ? profile.lastDiv / nativePrice : 0;
    const logoDataUri = await fetchLogo(profile.image);
    return {
      ...r,
      sector: profile.sector || undefined,
      country: profile.country || undefined,
      description: profile.description ? String(profile.description).slice(0, 320) : undefined,
      beta: profile.beta || undefined,
      marketCap: profile.mktCap || undefined,
      range52,
      divYield,
      logoDataUri,
    } as PropositionRow;
  }));

  const generatedAt = typeof body.generatedAt === 'string' && !isNaN(new Date(body.generatedAt).getTime())
    ? body.generatedAt
    : new Date().toISOString();

  const buffer = await renderPropositionReport({ client, context, amount, rows, generatedAt, advisor: 'Nicolas Perron' });

  const slug = client.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="proposition-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
