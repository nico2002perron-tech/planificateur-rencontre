import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Forward to Groq Whisper API
    const groqForm = new FormData();
    groqForm.append('file', file, file.name);
    groqForm.append('model', 'whisper-large-v3');
    groqForm.append('language', 'fr');
    groqForm.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      console.warn('[Transcribe] Groq error:', err);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || '' });
  } catch (err) {
    console.warn('[Transcribe] Failed:', err);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
