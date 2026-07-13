import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEventReminder } from '@/lib/email';
import { publishedTournamentUrl } from '@/lib/tournament/state';

// YYYY-MM-DD (UTC) — la colonne events.date est une chaîne 'YYYY-MM-DD'
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Dates de rappel effectives : celles configurées par l'organisateur, sinon défaut J-14 et J-7.
function effectiveReminderDates(eventDate: string, configured: string[]): string[] {
  if (configured.length > 0) return configured;
  const base = new Date(eventDate + 'T12:00:00Z').getTime();
  return [ymd(new Date(base - 14 * 86400000)), ymd(new Date(base - 7 * 86400000))];
}

// GET /api/cron/event-reminders — quotidien (Vercel Cron).
// Envoie un rappel aux inscrits le jour de chaque date de rappel configurée (ou J-14/J-7 par défaut).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const now = new Date();
    const today = ymd(now);

    // Événements publiés encore à venir (date >= aujourd'hui)
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, date, time, location, contact_email, contact_phone, reminder_dates, reminders_sent')
      .eq('status', 'published')
      .gte('date', today);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let emailsSent = 0;
    const processed: string[] = [];

    for (const ev of events || []) {
      const configured = Array.isArray(ev.reminder_dates) ? (ev.reminder_dates as string[]) : [];
      const sent = Array.isArray(ev.reminders_sent) ? (ev.reminders_sent as string[]) : [];
      const dates = effectiveReminderDates(ev.date, configured);

      // Un rappel part-il aujourd'hui ? (date de rappel atteinte et pas déjà envoyée)
      if (!dates.includes(today) || sent.includes(today)) continue;

      // Destinataires : inscrits individuels + membres d'équipe (dédupliqués par courriel)
      const recipients = new Map<string, string>(); // email -> prénom

      const { data: regs } = await supabase
        .from('event_registrations')
        .select('first_name, email')
        .eq('event_id', ev.id)
        .eq('status', 'confirmed');
      for (const r of regs || []) {
        if (r.email) recipients.set(r.email.toLowerCase(), r.first_name || '');
      }

      const { data: teams } = await supabase
        .from('event_teams')
        .select('id')
        .eq('event_id', ev.id);
      const teamIds = (teams || []).map((t) => t.id);
      if (teamIds.length) {
        const { data: members } = await supabase
          .from('event_team_members')
          .select('first_name, email')
          .in('team_id', teamIds)
          .eq('status', 'confirmed');
        for (const m of members || []) {
          // Les coéquipiers inscrits sans courriel ont un placeholder « .sans-courriel »
          if (m.email && !m.email.endsWith('.sans-courriel')) recipients.set(m.email.toLowerCase(), m.first_name || '');
        }
      }

      const eventInfo = {
        id: ev.id, title: ev.title, date: ev.date, time: ev.time, location: ev.location,
        contact_email: ev.contact_email, contact_phone: ev.contact_phone,
        // Bouton « Planning du tournoi » dans le rappel si l'horaire est publié
        tournament_live_url: await publishedTournamentUrl(supabase, ev.id),
      };

      // Jours restants avant l'événement (pour le texte « dans X jours / 1 semaine / ... »)
      const daysUntil = Math.round(
        (new Date(ev.date + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000
      );

      for (const [email, firstName] of recipients) {
        await sendEventReminder(eventInfo, email, firstName, daysUntil);
        emailsSent++;
      }

      // Marquer cette date comme envoyée (anti-doublon)
      await supabase.from('events').update({ reminders_sent: [...sent, today] }).eq('id', ev.id);

      processed.push(`${ev.title} (${today}, ${recipients.size} destinataire(s))`);
    }

    return NextResponse.json({
      message: 'Rappels traités',
      emailsSent,
      events: processed,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('Event reminders cron error:', err);
    return NextResponse.json({ error: 'Reminder failed' }, { status: 500 });
  }
}
