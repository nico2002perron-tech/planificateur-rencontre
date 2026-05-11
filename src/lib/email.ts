import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM || 'Groupe Financier Ste-Foy <onboarding@resend.dev>';

interface EventInfo {
  title: string;
  date: string;
  time?: string;
  location?: string;
  contact_email?: string;
  contact_phone?: string;
}

interface RegistrationInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  registration_type: string;
  team_name?: string;
  pricing_option?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Email to participant — registration confirmation
export async function sendRegistrationConfirmation(event: EventInfo, registration: RegistrationInfo) {
  const resend = getResend();
  if (!resend) return;

  const locationLine = event.location ? `<p style="margin:4px 0"><strong>Lieu:</strong> ${event.location}</p>` : '';
  const timeLine = event.time ? `<p style="margin:4px 0"><strong>Heure:</strong> ${event.time}</p>` : '';
  const teamLine = registration.team_name ? `<p style="margin:4px 0"><strong>Equipe:</strong> ${registration.team_name}</p>` : '';
  const pricingLine = registration.pricing_option ? `<p style="margin:4px 0"><strong>Option:</strong> ${registration.pricing_option}</p>` : '';
  const contactLines = [
    event.contact_email ? `<a href="mailto:${event.contact_email}">${event.contact_email}</a>` : '',
    event.contact_phone ? event.contact_phone : '',
  ].filter(Boolean).join(' | ');

  try {
    await resend.emails.send({
      from: FROM,
      to: registration.email,
      subject: `Confirmation - ${event.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#03045e;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:20px">Inscription confirmee!</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p>Bonjour ${registration.first_name},</p>
            <p>Votre inscription a l'evenement suivant est confirmee:</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <h2 style="margin:0 0 8px;color:#03045e;font-size:18px">${event.title}</h2>
              <p style="margin:4px 0"><strong>Date:</strong> ${formatDate(event.date)}</p>
              ${timeLine}
              ${locationLine}
              ${teamLine}
              ${pricingLine}
            </div>
            ${contactLines ? `<p style="font-size:13px;color:#64748b">Questions? ${contactLines}</p>` : ''}
            <p style="font-size:13px;color:#94a3b8;margin-top:24px">— Groupe Financier Ste-Foy</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email confirmation failed:', err);
  }
}

// Email to event creator — new registration notification
export async function sendRegistrationNotification(creatorEmail: string, event: EventInfo, registration: RegistrationInfo) {
  const resend = getResend();
  if (!resend) return;

  const teamLine = registration.team_name ? ` (Equipe: ${registration.team_name})` : '';

  try {
    await resend.emails.send({
      from: FROM,
      to: creatorEmail,
      subject: `Nouvelle inscription - ${event.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#00b4d8;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:18px">Nouvelle inscription</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p><strong>${registration.first_name} ${registration.last_name}</strong> s'est inscrit(e) a <strong>${event.title}</strong>${teamLine}.</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:12px 0;font-size:14px">
              <p style="margin:4px 0"><strong>Courriel:</strong> ${registration.email}</p>
              <p style="margin:4px 0"><strong>Telephone:</strong> ${registration.phone}</p>
              <p style="margin:4px 0"><strong>Type:</strong> ${registration.registration_type === 'team' ? 'Equipe' : 'Individuel'}</p>
              ${registration.pricing_option ? `<p style="margin:4px 0"><strong>Option:</strong> ${registration.pricing_option}</p>` : ''}
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email notification failed:', err);
  }
}
