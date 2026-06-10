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

interface TeamCreatedInfo {
  team_name: string;
  team_code: string;
  share_url: string;
  manage_url: string;
  max_members: number;
  member_count: number;
}

// Email to captain — team created (code + share link + manage link)
export async function sendTeamCreatedEmail(event: EventInfo, captainEmail: string, captainFirstName: string, team: TeamCreatedInfo) {
  const resend = getResend();
  if (!resend) return;

  const locationLine = event.location ? `<p style="margin:4px 0"><strong>Lieu:</strong> ${event.location}</p>` : '';
  const timeLine = event.time ? `<p style="margin:4px 0"><strong>Heure:</strong> ${event.time}</p>` : '';
  const spotsLeft = team.max_members - team.member_count;

  try {
    await resend.emails.send({
      from: FROM,
      to: captainEmail,
      subject: `Votre equipe "${team.team_name}" est creee! - ${event.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#03045e;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:20px">&#127942; Votre equipe est creee!</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p>Bonjour ${captainFirstName},</p>
            <p>Votre equipe <strong>${team.team_name}</strong> est inscrite a l'evenement suivant :</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <h2 style="margin:0 0 8px;color:#03045e;font-size:18px">${event.title}</h2>
              <p style="margin:4px 0"><strong>Date:</strong> ${formatDate(event.date)}</p>
              ${timeLine}
              ${locationLine}
            </div>
            ${spotsLeft > 0 ? `
            <p style="margin:16px 0 8px"><strong>Il reste ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} dans votre equipe.</strong> Vos coequipiers peuvent se joindre en un clic :</p>
            <div style="text-align:center;margin:16px 0">
              <a href="${team.share_url}" style="display:inline-block;background:#f59e0b;color:white;font-weight:bold;padding:12px 24px;border-radius:10px;text-decoration:none">Lien d'invitation a partager</a>
            </div>
            <p style="text-align:center;font-size:13px;color:#64748b">ou partagez simplement le code :</p>
            <div style="text-align:center;margin:8px 0 16px">
              <span style="display:inline-block;background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:10px 24px;font-size:24px;font-weight:bold;letter-spacing:3px;color:#92400e">${team.team_code}</span>
            </div>` : `<p style="margin:16px 0"><strong>Votre equipe est complete (${team.member_count}/${team.max_members}).</strong> Vous etes prets!</p>`}
            <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px">
              <p style="font-size:13px;color:#64748b;margin:0 0 8px">Pour voir ou gerer les membres de votre equipe en tout temps :</p>
              <p style="margin:0"><a href="${team.manage_url}" style="color:#0077b6;font-size:13px">${team.manage_url}</a></p>
              <p style="font-size:12px;color:#94a3b8;margin-top:8px">Gardez ce courriel precieusement — ce lien est votre cle de capitaine.</p>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin-top:24px">— Groupe Financier Ste-Foy</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email team created failed:', err);
  }
}

// Email to a member who joined a team — confirmation
export async function sendTeamJoinedEmail(event: EventInfo, memberEmail: string, memberFirstName: string, teamName: string) {
  const resend = getResend();
  if (!resend) return;

  const locationLine = event.location ? `<p style="margin:4px 0"><strong>Lieu:</strong> ${event.location}</p>` : '';
  const timeLine = event.time ? `<p style="margin:4px 0"><strong>Heure:</strong> ${event.time}</p>` : '';
  const contactLines = [
    event.contact_email ? `<a href="mailto:${event.contact_email}">${event.contact_email}</a>` : '',
    event.contact_phone ? event.contact_phone : '',
  ].filter(Boolean).join(' | ');

  try {
    await resend.emails.send({
      from: FROM,
      to: memberEmail,
      subject: `Bienvenue dans l'equipe ${teamName}! - ${event.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#059669;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:20px">&#9989; Vous faites partie de l'equipe!</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p>Bonjour ${memberFirstName},</p>
            <p>Vous avez rejoint l'equipe <strong>${teamName}</strong> pour l'evenement suivant :</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <h2 style="margin:0 0 8px;color:#03045e;font-size:18px">${event.title}</h2>
              <p style="margin:4px 0"><strong>Date:</strong> ${formatDate(event.date)}</p>
              ${timeLine}
              ${locationLine}
            </div>
            <p>On a hate de vous voir!</p>
            ${contactLines ? `<p style="font-size:13px;color:#64748b">Questions? ${contactLines}</p>` : ''}
            <p style="font-size:13px;color:#94a3b8;margin-top:24px">— Groupe Financier Ste-Foy</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email team joined failed:', err);
  }
}

// Email to captain — someone joined their team
export async function sendTeamMemberNotification(event: EventInfo, captainEmail: string, teamName: string, memberName: string, memberCount: number, maxMembers: number) {
  const resend = getResend();
  if (!resend) return;

  const isFull = memberCount >= maxMembers;

  try {
    await resend.emails.send({
      from: FROM,
      to: captainEmail,
      subject: `${memberName} a rejoint votre equipe ${teamName}! (${memberCount}/${maxMembers})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#00b4d8;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:18px">&#127881; Nouveau coequipier!</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p><strong>${memberName}</strong> a rejoint votre equipe <strong>${teamName}</strong> pour <strong>${event.title}</strong>.</p>
            <p style="font-size:15px">Votre equipe compte maintenant <strong>${memberCount}/${maxMembers}</strong> membre${memberCount > 1 ? 's' : ''}.</p>
            ${isFull ? '<p style="color:#059669;font-weight:bold">&#9989; Votre equipe est complete. Vous etes prets!</p>' : ''}
            <p style="font-size:13px;color:#94a3b8;margin-top:24px">— Groupe Financier Ste-Foy</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email member notification failed:', err);
  }
}

// Email to participant — event reminder (J-14 / J-7)
export async function sendEventReminder(event: EventInfo, to: string, firstName: string, daysUntil: number) {
  const resend = getResend();
  if (!resend) return;

  const when = daysUntil >= 14 ? 'dans 2 semaines' : 'dans 1 semaine';
  const locationLine = event.location ? `<p style="margin:4px 0"><strong>Lieu:</strong> ${event.location}</p>` : '';
  const timeLine = event.time ? `<p style="margin:4px 0"><strong>Heure:</strong> ${event.time}</p>` : '';
  const contactLines = [
    event.contact_email ? `<a href="mailto:${event.contact_email}">${event.contact_email}</a>` : '',
    event.contact_phone ? event.contact_phone : '',
  ].filter(Boolean).join(' | ');

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Rappel - ${event.title} (${when})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#0077b6;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:20px">C'est bientot!</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p>Bonjour ${firstName || ''},</p>
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
      `,
    });
  } catch (err) {
    console.error('Email reminder failed:', err);
  }
}
