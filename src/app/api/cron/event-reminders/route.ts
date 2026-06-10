import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEventReminder } from '@/lib/email';

// YYYY-MM-DD (UTC) — la colonne events.date est une chaîne 'YYYY-MM-DD'
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/cron/event-reminders — quotidien (Vercel Cron).
// Envoie un rappel aux inscrits des événements à J-14 et J-7.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const now = new Date();
    const d14 = ymd(new Date(now.getTime() + 14 * 86400000));
    const d7 = ymd(new Date(now.getTime() + 7 * 86400000));

    // Événements publiés à exactement J-14 ou J-7
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, date, time, location, contact_email, contact_phone, reminder_14d_sent_at, reminder_7d_sent_at')
      .eq('status', 'published')
      .in('date', [d14, d7]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let emailsSent = 0;
    const processed: string[] = [];

    for (const ev of events || []) {
      const isD14 = ev.date === d14 && !ev.reminder_14d_sent_at;
      const isD7 = ev.date === d7 && !ev.reminder_7d_sent_at;
      if (!isD14 && !isD7) continue;
      const daysUntil = isD14 ? 14 : 7;

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
          // Les coéquipiers inscrits par le capitaine sans courriel ont un placeholder « .sans-courriel »
          if (m.email && !m.email.endsWith('.sans-courriel')) recipients.set(m.email.toLowerCase(), m.first_name || '');
        }
      }

      const eventInfo = {
        title: ev.title, date: ev.date, time: ev.time, location: ev.location,
        contact_email: ev.contact_email, contact_phone: ev.contact_phone,
      };

      for (const [email, firstName] of recipients) {
        await sendEventReminder(eventInfo, email, firstName, daysUntil);
        emailsSent++;
      }

      // Marquer comme envoyé (évite les doublons)
      const update = isD14
        ? { reminder_14d_sent_at: now.toISOString() }
        : { reminder_7d_sent_at: now.toISOString() };
      await supabase.from('events').update(update).eq('id', ev.id);

      processed.push(`${ev.title} (J-${daysUntil}, ${recipients.size} destinataire(s))`);
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
