import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Endpoint PUBLIC : le formulaire de signalement des outils (site GFSF) envoie ici
// en POST anonyme (CORS *). Aucune session requise — voir middleware (publicPaths).
function corsJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

const ALLOWED_TOOLS = ['compas', 'budget', 'hypotheque', 'dashboard', 'outils', ''];

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: 'Requête invalide' }, 400);
  }

  const message = String(body.message || '').trim();
  if (!message) return corsJson({ error: 'Merci de décrire le problème.' }, 400);
  if (message.length > 4000) return corsJson({ error: 'Message trop long (4000 caractères max).' }, 400);

  const email = String(body.email || '').trim().slice(0, 200);
  // Validation courriel souple (le champ est facultatif → vide = anonyme)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsJson({ error: 'Courriel invalide (ou laissez-le vide pour rester anonyme).' }, 400);
  }

  let tool = String(body.tool || '').trim().toLowerCase().slice(0, 50);
  if (!ALLOWED_TOOLS.includes(tool)) tool = '';

  const page_url = String(body.page_url || '').trim().slice(0, 500);
  const user_agent = (request.headers.get('user-agent') || '').slice(0, 400);

  const supabase = createClient();
  const { error } = await supabase.from('tool_feedback').insert({
    tool, message, email, page_url, user_agent,
  });

  if (error) return corsJson({ error: error.message }, 500);
  return corsJson({ ok: true }, 201);
}

export async function OPTIONS() {
  return corsJson(null, 204);
}
