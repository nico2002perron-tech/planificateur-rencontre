import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured' },
      { status: 503 }
    );
  }

  try {
    const { text, targetLang = 'français' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text parameter required' }, { status: 400 });
    }

    const trimmed = text.slice(0, 5000);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Traduis le texte suivant en ${targetLang}. Retourne UNIQUEMENT la traduction, sans explication ni guillemets.\n\n${trimmed}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API error:', res.status, errText);
      return NextResponse.json(
        { error: 'Translation service error', translated: trimmed },
        { status: 502 }
      );
    }

    const data = await res.json();
    const translated =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || trimmed;

    return NextResponse.json({ translated });
  } catch (err) {
    console.error('Translate route error:', err);
    return NextResponse.json(
      { error: 'Internal error', translated: '' },
      { status: 500 }
    );
  }
}
