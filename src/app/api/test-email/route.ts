import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// GET /api/test-email?to=courriel&days=14|7 — Envoie un APERÇU du courriel de rappel d'événement.
// Reproduit fidèlement le gabarit de sendEventReminder (lib/email.ts).
// ⚠️ Route TEMPORAIRE de test — à supprimer après vérification.

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export async function GET(request: NextRequest) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Groupe Financier Ste-Foy <onboarding@resend.dev>';
  if (!key) return NextResponse.json({ error: 'RESEND_API_KEY non configurée', hasKey: false }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const to = searchParams.get('to') || 'nico2002.perron@gmail.com';
  const days = searchParams.get('days') === '7' ? 7 : 14;
  const when = days >= 14 ? 'dans 2 semaines' : 'dans 1 semaine';
  const firstName = 'Marie';

  // Événement-exemple (uniquement pour la prévisualisation)
  const event = {
    title: 'Tournoi de golf annuel (TEST)',
    date: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
    time: '9h00',
    location: 'Club de golf de Québec, 2505 boul. Laurier',
    contact_email: 'nicolas.perron@iagestionprivee.ca',
    contact_phone: '418-577-2087',
  };

  const locationLine = event.location ? `<p style="margin:4px 0"><strong>Lieu:</strong> ${event.location}</p>` : '';
  const timeLine = event.time ? `<p style="margin:4px 0"><strong>Heure:</strong> ${event.time}</p>` : '';
  const contactLines = [
    event.contact_email ? `<a href="mailto:${event.contact_email}">${event.contact_email}</a>` : '',
    event.contact_phone ? event.contact_phone : '',
  ].filter(Boolean).join(' | ');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#0077b6;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:20px">C'est bientot!</h1>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <p>Bonjour ${firstName},</p>
        <p>Petit rappel : l'evenement auquel vous etes inscrit(e) a lieu <strong>${when}</strong>.</p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
          <h2 style="margin:0 0 8px;color:#03045e;font-size:18px">${event.title}</h2>
          <p style="margin:4px 0"><strong>Date:</strong> ${formatDate(event.date)}</p>
          ${timeLine}
          ${locationLine}
        </div>
        <p>Au plaisir de vous y voir!</p>
        ${contactLines ? `<p style="font-size:13px;color:#64748b">Questions? ${contactLines}</p>` : ''}
        <p style="font-size:13px;color:#94a3b8;margin-top:24px">— Groupe Financier Ste-Foy</p>
      </div>
    </div>
  `;

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Rappel - ${event.title} (${when})`,
      html,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message, from, sentTo: to }, { status: 500 });
    }
    return NextResponse.json({ success: true, emailId: data?.id, sentTo: to, days, from });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ success: false, error: message, from, sentTo: to }, { status: 500 });
  }
}
