/**
 * Destinataires des courriels de tournoi = LE CAPITAINE de chaque équipe, un seul
 * par équipe (volume minimal le jour du tournoi — décidé avec Nicolas).
 *
 * Ordre de priorité, robuste aux données imparfaites :
 *   1. le membre confirmé marqué `is_captain` ;
 *   2. le membre confirmé dont le courriel = `captain_email` de l'équipe ;
 *   3. à défaut, `captain_email` seul (toujours présent sur event_teams).
 * Les fausses adresses « …sans-courriel » sont écartées.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Recipient {
  email: string;
  firstName: string;
}

const valid = (e?: string | null): e is string => !!e && !e.toLowerCase().endsWith('.sans-courriel');

export async function fetchTeamCaptains(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<Map<string, Recipient>> {
  if (teamIds.length === 0) return new Map();

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from('event_teams').select('id, captain_email').in('id', teamIds),
    supabase.from('event_team_members').select('team_id, first_name, email, is_captain').in('team_id', teamIds).eq('status', 'confirmed'),
  ]);

  const byTeam = new Map<string, Recipient>();
  for (const id of teamIds) {
    const mem = (members || []).filter(m => m.team_id === id && valid(m.email));
    const captainEmail = (teams || []).find(t => t.id === id)?.captain_email ?? '';
    const captainLc = captainEmail.toLowerCase();

    const flagged = mem.find(m => m.is_captain);
    const matchCe = mem.find(m => m.email.toLowerCase() === captainLc);

    if (flagged) byTeam.set(id, { email: flagged.email, firstName: flagged.first_name || '' });
    else if (matchCe) byTeam.set(id, { email: matchCe.email, firstName: matchCe.first_name || '' });
    else if (valid(captainEmail)) byTeam.set(id, { email: captainEmail, firstName: '' });
  }
  return byTeam;
}
