import { Resend } from 'resend';
import { googleCalUrl, outlookCalUrl } from './calendar';
import { nomTerrain } from './tournament/terrains';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM || 'Groupe Financier Ste-Foy <onboarding@resend.dev>';
const APP_URL = process.env.NEXTAUTH_URL || 'https://planificateur-rencontre.vercel.app';

// Logo Groupe Financier Ste-Foy — version couleur (visible sur l'en-tête blanc des courriels).
// PNG converti depuis logo-gfsf-footer.webp et hébergé par l'app (public/) : le WebP ne s'affiche
// pas dans plusieurs clients courriel (Outlook), d'où le PNG servi en même origine que l'envoi.
const LOGO_URL = `${APP_URL}/email-logo-gfsf.png`;

interface EventInfo {
  id?: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  // Page publique en direct du tournoi — renseignée par l'appelant SEULEMENT
  // si un tournoi publié existe (voir publishedTournamentUrl) : le bouton
  // « Planning du tournoi » n'apparaît alors qu'aux bons événements.
  tournament_live_url?: string;
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

// ── Habillage de marque commun à tous les courriels (en-tête logo + filet d'accent + pied) ──
function emailShell(inner: string, contact = ''): string {
  const contactLine = contact
    ? `<p style="margin:0 0 6px;color:#64748b;font-size:12px">Une question&nbsp;? ${contact}</p>`
    : '';
  return `
  <div style="background:#eef2f6;padding:28px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
      <div style="padding:24px 24px 18px;text-align:center;background:#ffffff">
        <img src="${LOGO_URL}" alt="Groupe Financier Ste-Foy" width="210" style="max-width:210px;height:auto;display:inline-block;border:0" />
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#03045e 0%,#0077b6 50%,#00b4d8 100%)"></div>
      <div style="padding:30px 30px 8px">
        ${inner}
      </div>
      <div style="padding:20px 30px 26px;border-top:1px solid #eef2f7;text-align:center;margin-top:18px">
        ${contactLine}
        <p style="margin:6px 0 2px;color:#03045e;font-weight:bold;font-size:13px">Groupe Financier Ste-Foy</p>
        <p style="margin:0;color:#94a3b8;font-size:12px">iA Gestion privée de patrimoine</p>
        <p style="margin:11px 0 0;color:#b6c2cf;font-size:11px">Vous recevez ce courriel suite à votre inscription à un de nos événements.</p>
      </div>
    </div>
  </div>`;
}

function detailRow(label: string, val?: string): string {
  if (!val) return '';
  return `<tr><td style="padding:5px 0;width:74px;color:#94a3b8;font-size:14px;vertical-align:top">${label}</td><td style="padding:5px 0;font-weight:bold;color:#334155;font-size:14px">${val}</td></tr>`;
}

// Carte d'événement réutilisable (Date / Heure / Lieu + lignes supplémentaires optionnelles)
function eventCard(event: EventInfo, extraRows = ''): string {
  return `
    <div style="background:#f8fafc;border:1px solid #e7edf3;border-radius:12px;padding:20px;margin:0 0 20px">
      <h2 style="margin:0 0 12px;color:#03045e;font-size:19px">${event.title}</h2>
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Date', formatDate(event.date))}
        ${detailRow('Heure', event.time)}
        ${detailRow('Lieu', event.location)}
        ${extraRows}
      </table>
    </div>`;
}

function contactStr(event: EventInfo): string {
  return [
    event.contact_email ? `<a href="mailto:${event.contact_email}" style="color:#0077b6">${event.contact_email}</a>` : '',
    event.contact_phone || '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');
}

// Boutons « Ajouter à mon agenda » (Google, Outlook, Apple/.ics) — l'Apple/.ics requiert l'id de l'événement
// + bouton « Planning du tournoi » juste à côté quand l'événement a un tournoi publié
function calendarButtons(event: EventInfo): string {
  if (!event.date) return '';
  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;margin:3px 4px;padding:9px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;color:#03045e;text-decoration:none;font-size:13px;font-weight:bold">${label}</a>`;
  const icsBtn = event.id ? btn(`${APP_URL}/api/events/${event.id}/ics`, 'Apple / iCal') : '';
  const tournamentBtn = event.tournament_live_url
    ? `<a href="${event.tournament_live_url}" style="display:inline-block;margin:3px 4px;padding:9px 16px;background:#0077b6;border:1px solid #0077b6;border-radius:8px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold">&#127942; Planning du tournoi</a>`
    : '';
  return `
    <div style="text-align:center;margin:0 0 20px">
      <p style="margin:0 0 8px;color:#64748b;font-size:13px">&#128197; Ajouter à mon agenda&nbsp;:</p>
      ${btn(googleCalUrl(event), 'Google')}${btn(outlookCalUrl(event), 'Outlook')}${icsBtn}${tournamentBtn}
    </div>`;
}

const reminderBanner = `
  <div style="background:#ecfeff;border:1px solid #cffafe;border-radius:10px;padding:13px 16px;margin:0 0 8px">
    <p style="margin:0;color:#0e7490;font-size:13px;line-height:1.5">&#128197; <strong>Rien à noter de votre côté&nbsp;:</strong> nous vous enverrons un rappel automatique avant l'événement.</p>
  </div>`;

// ── Courriel au participant — confirmation d'inscription ──
export async function sendRegistrationConfirmation(event: EventInfo, registration: RegistrationInfo, _registrationId?: string) {
  const resend = getResend();
  if (!resend) return;

  const extraRows = detailRow('Équipe', registration.team_name) + detailRow('Option', registration.pricing_option);
  const inner = `
    <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">Votre place est confirmée&nbsp;!</h1>
    <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">On a hâte de vous y voir.</p>
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px;line-height:1.5">Bonjour <strong>${registration.first_name}</strong>,</p>
    <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.5">Merci de votre inscription&nbsp;! Voici les détails de l'événement&nbsp;:</p>
    ${eventCard(event, extraRows)}
    ${calendarButtons(event)}
    ${reminderBanner}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: registration.email,
      subject: `Confirmation – ${event.title}`,
      html: emailShell(inner, contactStr(event)),
    });
  } catch (err) {
    console.error('Email confirmation failed:', err);
  }
}

// ── Courriel au créateur de l'événement — notification de nouvelle inscription ──
export async function sendRegistrationNotification(creatorEmail: string, event: EventInfo, registration: RegistrationInfo) {
  const resend = getResend();
  if (!resend) return;

  const teamLine = registration.team_name ? ` (Équipe&nbsp;: ${registration.team_name})` : '';
  const inner = `
    <h1 style="margin:0 0 16px;color:#03045e;font-size:20px">Nouvelle inscription</h1>
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px"><strong>${registration.first_name} ${registration.last_name}</strong> s'est inscrit(e) à <strong>${event.title}</strong>${teamLine}.</p>
    <div style="background:#f8fafc;border:1px solid #e7edf3;border-radius:12px;padding:16px;font-size:14px;color:#334155">
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Courriel', registration.email)}
        ${detailRow('Téléphone', registration.phone)}
        ${detailRow('Type', registration.registration_type === 'team' ? 'Équipe' : 'Individuel')}
        ${detailRow('Option', registration.pricing_option)}
      </table>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: creatorEmail,
      subject: `Nouvelle inscription – ${event.title}`,
      html: emailShell(inner),
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

// ── Courriel au capitaine — équipe créée (code + lien d'invitation + lien de gestion) ──
export async function sendTeamCreatedEmail(event: EventInfo, captainEmail: string, captainFirstName: string, team: TeamCreatedInfo, _captainMemberId?: string) {
  const resend = getResend();
  if (!resend) return;

  const spotsLeft = team.max_members - team.member_count;
  const inviteBlock = spotsLeft > 0 ? `
    <p style="margin:18px 0 8px;color:#1e293b;font-size:15px;line-height:1.5"><strong>Il reste ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} dans votre équipe.</strong> Vos coéquipiers se joignent en un clic&nbsp;:</p>
    <div style="text-align:center;margin:16px 0">
      <a href="${team.share_url}" style="display:inline-block;background:#0077b6;color:#ffffff;font-weight:bold;padding:13px 26px;border-radius:10px;text-decoration:none;font-size:15px">Lien d'invitation à partager</a>
    </div>
    <p style="text-align:center;font-size:13px;color:#64748b;margin:0 0 6px">ou partagez simplement le code&nbsp;:</p>
    <div style="text-align:center;margin:6px 0 18px">
      <span style="display:inline-block;background:#e0f2fe;border:2px dashed #0077b6;border-radius:10px;padding:10px 24px;font-size:24px;font-weight:bold;letter-spacing:3px;color:#03045e">${team.team_code}</span>
    </div>` : `<p style="margin:18px 0;color:#059669;font-weight:bold;font-size:15px">Votre équipe est complète (${team.member_count}/${team.max_members}). Vous êtes prêts&nbsp;!</p>`;

  const inner = `
    <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">Votre équipe est créée&nbsp;!</h1>
    <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">Plus qu'à inviter vos coéquipiers.</p>
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px">Bonjour <strong>${captainFirstName}</strong>,</p>
    <p style="margin:0 0 18px;color:#475569;font-size:15px">Votre équipe <strong>${team.team_name}</strong> est inscrite à&nbsp;:</p>
    ${eventCard(event)}
    ${calendarButtons(event)}
    ${inviteBlock}
    <div style="border-top:1px solid #eef2f7;margin-top:8px;padding-top:16px">
      <p style="margin:0 0 6px;color:#64748b;font-size:13px">Pour voir ou gérer votre équipe en tout temps&nbsp;:</p>
      <p style="margin:0"><a href="${team.manage_url}" style="color:#0077b6;font-size:13px;word-break:break-all">${team.manage_url}</a></p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px">Gardez ce courriel&nbsp;: ce lien est votre clé de capitaine.</p>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: captainEmail,
      subject: `Votre équipe « ${team.team_name} » est créée – ${event.title}`,
      html: emailShell(inner, contactStr(event)),
    });
  } catch (err) {
    console.error('Email team created failed:', err);
  }
}

// ── Courriel à un membre qui rejoint une équipe — confirmation ──
export async function sendTeamJoinedEmail(event: EventInfo, memberEmail: string, memberFirstName: string, teamName: string, _memberId?: string) {
  const resend = getResend();
  if (!resend) return;

  const inner = `
    <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">Vous faites partie de l'équipe&nbsp;!</h1>
    <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">On a hâte de vous y voir.</p>
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px">Bonjour <strong>${memberFirstName}</strong>,</p>
    <p style="margin:0 0 18px;color:#475569;font-size:15px">Vous avez rejoint l'équipe <strong>${teamName}</strong> pour&nbsp;:</p>
    ${eventCard(event)}
    ${calendarButtons(event)}
    ${reminderBanner}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: memberEmail,
      subject: `Bienvenue dans l'équipe ${teamName} – ${event.title}`,
      html: emailShell(inner, contactStr(event)),
    });
  } catch (err) {
    console.error('Email team joined failed:', err);
  }
}

// ── Courriel au capitaine — un coéquipier a rejoint son équipe ──
export async function sendTeamMemberNotification(event: EventInfo, captainEmail: string, teamName: string, memberName: string, memberCount: number, maxMembers: number) {
  const resend = getResend();
  if (!resend) return;

  const isFull = memberCount >= maxMembers;
  const inner = `
    <h1 style="margin:0 0 16px;color:#03045e;font-size:20px">Nouveau coéquipier&nbsp;!</h1>
    <p style="margin:0 0 12px;color:#1e293b;font-size:15px"><strong>${memberName}</strong> a rejoint votre équipe <strong>${teamName}</strong> pour <strong>${event.title}</strong>.</p>
    <p style="margin:0 0 12px;color:#475569;font-size:15px">Votre équipe compte maintenant <strong>${memberCount}/${maxMembers}</strong> membre${memberCount > 1 ? 's' : ''}.</p>
    ${isFull ? '<p style="margin:0;color:#059669;font-weight:bold;font-size:15px">&#9989; Votre équipe est complète. Vous êtes prêts&nbsp;!</p>' : ''}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: captainEmail,
      subject: `${memberName} a rejoint votre équipe ${teamName} (${memberCount}/${maxMembers})`,
      html: emailShell(inner),
    });
  } catch (err) {
    console.error('Email member notification failed:', err);
  }
}

// ── Texte « quand » adapté à n'importe quel délai (rappels à dates configurables) ──
function reminderWhen(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === 7) return 'dans 1 semaine';
  if (days === 14) return 'dans 2 semaines';
  if (days > 7 && days % 7 === 0) return `dans ${days / 7} semaines`;
  return `dans ${days} jours`;
}

// ── Courriel au participant — rappel d'événement (dates configurables, repli J-14 / J-7) ──
export async function sendEventReminder(event: EventInfo, to: string, firstName: string, daysUntil: number) {
  const resend = getResend();
  if (!resend) return;

  const when = reminderWhen(daysUntil);
  const inner = `
    <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">C'est bientôt&nbsp;!</h1>
    <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">Votre événement a lieu ${when}.</p>
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px">Bonjour <strong>${firstName || ''}</strong>,</p>
    <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.5">Petit rappel amical&nbsp;: l'événement auquel vous êtes inscrit(e) a lieu <strong>${when}</strong>.</p>
    ${eventCard(event)}
    ${calendarButtons(event)}
    <p style="margin:0 0 8px;color:#475569;font-size:15px">Au plaisir de vous y voir&nbsp;!</p>`;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Rappel – ${event.title} (${when})`,
      html: emailShell(inner, contactStr(event)),
    });
  } catch (err) {
    console.error('Email reminder failed:', err);
  }
}

// ── Tournoi — horaire d'équipe (bouton « Envoyer l'horaire à tous ») ──────────

export interface TeamScheduleMatch {
  matchNumber: number;
  dayLabel?: string;       // 'ven. 14 août' — fourni seulement si le tournoi a plusieurs jours
  scheduledTime: string;   // 'HH:MM'
  court: number;
  opponentName: string;    // '' si l'adversaire n'est pas encore connu
  phase: string;           // garantie | quart | demi | bronze | finale
}

const PHASE_LABELS: Record<string, string> = {
  garantie: '', quart: 'Quart de finale', demi: 'Demi-finale', bronze: 'Match pour le bronze', finale: 'FINALE',
};

function scheduleTable(teamName: string, matches: TeamScheduleMatch[]): string {
  const rows = matches.map(m => {
    const phaseLabel = PHASE_LABELS[m.phase] || '';
    const opponent = m.opponentName || 'À déterminer';
    const when = m.dayLabel
      ? `<span style="color:#0077b6;font-size:12px">${m.dayLabel}</span><br>${m.scheduledTime}`
      : m.scheduledTime;
    return `
      <tr>
        <td style="padding:9px 12px;border-top:1px solid #e7edf3;font-weight:bold;color:#03045e;font-size:15px;white-space:nowrap">${when}</td>
        <td style="padding:9px 12px;border-top:1px solid #e7edf3;color:#475569;font-size:14px;white-space:nowrap">${nomTerrain(m.court)}</td>
        <td style="padding:9px 12px;border-top:1px solid #e7edf3;color:#334155;font-size:14px">vs <strong>${opponent}</strong>${phaseLabel ? ` <span style="color:#0077b6;font-size:12px;font-weight:bold">· ${phaseLabel}</span>` : ''}</td>
      </tr>`;
  }).join('');
  return `
    <div style="background:#f8fafc;border:1px solid #e7edf3;border-radius:12px;overflow:hidden;margin:0 0 20px">
      <div style="padding:12px 16px;background:#03045e"><p style="margin:0;color:#ffffff;font-weight:bold;font-size:15px">🏆 ${teamName}</p></div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;
}

/**
 * Envoie à chaque joueur de l'équipe son horaire du tournoi (lot Resend :
 * jusqu'à 100 courriels par appel API — évite de dépasser le temps d'exécution).
 * Retourne le nombre de courriels remis à Resend.
 */
export async function sendTournamentSchedule(
  event: EventInfo,
  teamName: string,
  recipients: { email: string; firstName: string }[],
  matches: TeamScheduleMatch[],
  liveUrl: string,
): Promise<number> {
  const resend = getResend();
  if (!resend || recipients.length === 0 || matches.length === 0) return 0;

  const emails = recipients.map(r => {
    const inner = `
      <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">Votre horaire de tournoi&nbsp;!</h1>
      <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">${event.title} · ${formatDate(event.date)}</p>
      <p style="margin:0 0 14px;color:#1e293b;font-size:15px">Bonjour <strong>${r.firstName || ''}</strong>,</p>
      <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.5">Voici les parties de votre équipe <strong>${teamName}</strong>${event.location ? ` au <strong>${event.location}</strong>` : ''}&nbsp;:</p>
      ${scheduleTable(teamName, matches)}
      <div style="text-align:center;margin:0 0 18px">
        <a href="${liveUrl}" style="display:inline-block;background:#0077b6;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">Suivre le tournoi en direct</a>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:13px 16px">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5">⏱️ <strong>Les heures peuvent bouger durant la journée.</strong> La page en direct ci-dessus fait toujours foi — gardez-la ouverte&nbsp;!</p>
      </div>`;
    return {
      from: FROM,
      to: r.email,
      subject: `Votre horaire – ${event.title} (${teamName})`,
      html: emailShell(inner, contactStr(event)),
    };
  });

  let sent = 0;
  try {
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error('Tournament schedule batch failed:', error);
        continue;
      }
      sent += chunk.length;
    }
  } catch (err) {
    console.error('Tournament schedule email failed:', err);
  }
  return sent;
}

// ── Avis libre aux participants d'un événement (correction, pluie, changement de lieu…) ──

export interface EventNotice {
  titre: string;          // gros titre du courriel
  paragraphes: string[];  // corps — HTML simple permis (<strong>, <em>) : l'appelant est authentifié
  alerte?: string;        // encadré ambre mis en évidence, optionnel
}

/**
 * Envoie un avis ponctuel aux destinataires fournis (lots Resend de 100).
 * Volontairement SANS bouton d'agenda ni lien de tournoi : un avis corrige
 * une information, il ne renvoie pas vers celle qu'on vient d'invalider.
 * Retourne le nombre de courriels remis à Resend.
 */
export async function sendEventNotice(
  event: EventInfo,
  recipients: { email: string; firstName: string }[],
  notice: EventNotice,
): Promise<number> {
  const resend = getResend();
  if (!resend || recipients.length === 0) return 0;

  const alerte = notice.alerte
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:0 0 18px">
         <p style="margin:0;color:#92400e;font-size:14px;line-height:1.55">${notice.alerte}</p>
       </div>`
    : '';

  const emails = recipients.map(r => {
    const corps = notice.paragraphes
      .map(p => `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.55">${p}</p>`)
      .join('');
    const inner = `
      <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">${notice.titre}</h1>
      <p style="margin:0 0 22px;color:#0077b6;font-size:14px;font-weight:bold">${event.title} · ${formatDate(event.date)}</p>
      <p style="margin:0 0 14px;color:#1e293b;font-size:15px">Bonjour${r.firstName ? ` <strong>${r.firstName}</strong>` : ''},</p>
      ${corps}
      ${alerte}`;
    return {
      from: FROM,
      to: r.email,
      subject: `${notice.titre} – ${event.title}`,
      html: emailShell(inner, contactStr(event)),
    };
  });

  let sent = 0;
  try {
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error('Event notice batch failed:', error);
        continue;
      }
      sent += chunk.length;
    }
  } catch (err) {
    console.error('Event notice email failed:', err);
  }
  return sent;
}

// ── Tournoi — résultat + prochaine partie (pendant le tournoi, 1 tap) ─────────

export interface MatchResultInfo {
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
}

export interface NextMatchInfo {
  dayLabel?: string;       // 'sam. 15 août' — seulement si le tournoi a plusieurs jours
  time: string;            // 'HH:MM'
  court: number;
  opponent: string;        // nom résolu, sinon source (« Gagnant M9 »), sinon 'À déterminer'
  phase: string;
}

/**
 * Courriel envoyé aux joueurs d'UNE équipe juste après sa partie :
 * le résultat + leur prochaine partie en gros (ou « journée terminée »),
 * l'image du bracket si des séries existent, et le lien de la page en direct.
 */
export async function sendMatchResultEmails(
  event: EventInfo,
  teamName: string,
  recipients: { email: string; firstName: string }[],
  result: MatchResultInfo,
  next: NextMatchInfo | null,
  liveUrl: string,
  bracketImageUrl?: string,
): Promise<number> {
  const resend = getResend();
  if (!resend || recipients.length === 0) return 0;

  const won = result.scoreFor > result.scoreAgainst;
  const tie = result.scoreFor === result.scoreAgainst;
  const resultLine = tie
    ? `Partie nulle <strong>${result.scoreFor}–${result.scoreAgainst}</strong> contre ${result.opponent}.`
    : won
      ? `Victoire <strong>${result.scoreFor}–${result.scoreAgainst}</strong> contre ${result.opponent}&nbsp;! 🎉`
      : `Défaite ${result.scoreFor}–${result.scoreAgainst} contre ${result.opponent}.`;

  const phaseLabel = next ? (PHASE_LABELS[next.phase] || '') : '';
  const nextBlock = next
    ? `
      <div style="background:linear-gradient(135deg,#0077b6,#00b4d8);border-radius:14px;padding:20px 22px;margin:0 0 18px;text-align:center">
        <p style="margin:0 0 4px;color:#ffffff;opacity:.9;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em">Votre prochaine partie${phaseLabel ? ` · ${phaseLabel}` : ''}</p>
        <p style="margin:0;color:#ffffff;font-size:34px;font-weight:800;line-height:1.1">${next.dayLabel ? `${next.dayLabel} · ` : ''}${next.time}</p>
        <p style="margin:6px 0 0;color:#ffffff;font-size:15px;font-weight:bold">${nomTerrain(next.court)} · vs ${next.opponent}</p>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 15px;margin:0 0 18px">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5">⏱️ Les heures peuvent bouger — la page en direct fait toujours foi.</p>
      </div>`
    : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:20px 22px;margin:0 0 18px;text-align:center">
        <p style="margin:0;color:#15803d;font-size:17px;font-weight:800">🏁 Aucune autre partie à votre horaire</p>
        <p style="margin:6px 0 0;color:#166534;font-size:14px">Merci d'avoir participé — consultez le classement et les séries sur la page en direct&nbsp;!</p>
      </div>`;

  const bracketBlock = bracketImageUrl
    ? `<div style="text-align:center;margin:0 0 18px">
         <img src="${bracketImageUrl}" alt="Bracket des séries" width="520" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #e7edf3" />
       </div>`
    : '';

  const emails = recipients.map(r => {
    const inner = `
      <h1 style="margin:0 0 6px;color:#03045e;font-size:23px">${teamName}</h1>
      <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.5">Bonjour <strong>${r.firstName || ''}</strong>, ${resultLine}</p>
      ${nextBlock}
      ${bracketBlock}
      <div style="text-align:center;margin:0 0 8px">
        <a href="${liveUrl}" style="display:inline-block;background:#0077b6;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">Suivre le tournoi en direct</a>
      </div>`;
    return {
      from: FROM,
      to: r.email,
      subject: next
        ? `Prochaine partie ${next.dayLabel ? `${next.dayLabel} ` : ''}${next.time} – ${teamName}`
        : `Merci ! – ${event.title} (${teamName})`,
      html: emailShell(inner, contactStr(event)),
    };
  });

  let sent = 0;
  try {
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error('Match result batch failed:', error);
        continue;
      }
      sent += chunk.length;
    }
  } catch (err) {
    console.error('Match result email failed:', err);
  }
  return sent;
}
