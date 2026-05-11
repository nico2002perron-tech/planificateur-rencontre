import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// GET /api/test-email — Temporary: test Resend config
// DELETE THIS FILE after testing
export async function GET() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Groupe Financier Ste-Foy <onboarding@resend.dev>';

  if (!key) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set', hasKey: false });
  }

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: 'delivered@resend.dev',
      subject: 'Test email depuis planificateur',
      html: '<p>Si tu vois ce message, Resend fonctionne!</p>',
    });

    if (error) {
      return NextResponse.json({ error: error.message, resendError: error, from, keyPrefix: key.substring(0, 10) + '...' }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id, from, keyPrefix: key.substring(0, 10) + '...' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, from, keyPrefix: key.substring(0, 10) + '...' }, { status: 500 });
  }
}
