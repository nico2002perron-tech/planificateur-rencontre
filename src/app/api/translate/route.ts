import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured' },
      { status: 503 }
    );
  }

  try {
    const { text, targetLang = 'français' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text parameter required' }, { status: 400 });
    }

    const trimmed = text.slice(0, 5000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Tu es un traducteur professionnel. Traduis le texte en ${targetLang}. Retourne UNIQUEMENT la traduction, rien d'autre.`,
          },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', res.status, errText);
      return NextResponse.json(
        { error: 'Translation service error', translated: trimmed },
        { status: 502 }
      );
    }

    const data = await res.json();
    const translated =
      data?.choices?.[0]?.message?.content?.trim() || trimmed;

    return NextResponse.json({ translated });
  } catch (err) {
    console.error('Translate route error:', err);
    return NextResponse.json(
      { error: 'Internal error', translated: '' },
      { status: 500 }
    );
  }
}
