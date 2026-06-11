import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/qr/checkin/[kind]/[id] — PNG du laissez-passer (QR scanné à l'accueil le jour J)
// Le QR contient « GFSF:<kind>:<id> » ; le scan ne fait rien sans session admin.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;

  if ((kind !== 'registration' && kind !== 'member') || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 });
  }

  const payload = `GFSF:${kind}:${id.toLowerCase()}`;
  const png = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#03045e', light: '#ffffff' },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
