// LA FICHE DU CLIENT — les données que seul le client peut donner.
//
// Tout ce qui se dérive du livre se dérive (hydrater.ts). Ce qui reste ici,
// c'est ce qu'aucun export Croesus ne portera jamais : l'âge, le revenu, la
// situation familiale, les montants de l'avis de cotisation, les intentions.
//
// Route DÉDIÉE plutôt que le PUT des profils, qui écrit sans validation ce
// qu'on lui donne. Ici chaque champ est vérifié contre son énumération, et un
// champ absent du corps de la requête n'est PAS touché : l'écran envoie un
// champ à la fois, au fil de la conversation.
import { NextRequest, NextResponse } from 'next/server';
import { estLocal } from '@/lib/base-locale/mode';
import { lireProfil, ecrireProfil } from '@/lib/profils/stockage';
import type {
  ProfilClient, EtatCivil, TrancheRevenu, ReponseTernaire, EnfantBeneficiaire,
} from '@/lib/profils/types';

const ETATS: EtatCivil[] = ['celibataire', 'marie', 'conjoint-de-fait', 'veuf', 'divorce'];
const TRANCHES: TrancheRevenu[] = ['0-50k', '50-100k', '100-150k', '150-200k', '200k+'];
const TERNAIRE: ReponseTernaire[] = ['oui', 'non', 'inconnu'];

/** Un âge plausible. Rien en dehors : une coquille à 3 chiffres fausserait le plafond. */
function age(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= 0 && n <= 120 ? n : undefined;
}

/** Un montant d'avis de cotisation. Négatif refusé, arrondi au cent. */
function montant(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
  return Math.round(v * 100) / 100;
}

export async function POST(req: NextRequest) {
  if (!estLocal()) return new NextResponse('Not Found', { status: 404 });

  const corps = (await req.json()) as Record<string, unknown>;
  const id = typeof corps.id === 'string' ? corps.id : null;
  if (!id) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });

  const profil = await lireProfil(id);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const jour = new Date().toISOString().slice(0, 10);
  const refus: string[] = [];

  // ── Démographie ───────────────────────────────────────────────────────────
  if ('age' in corps) {
    const a = age(corps.age);
    if (a === undefined) refus.push('age');
    else profil.demographie.age = a;
  }
  if ('etatCivil' in corps) {
    const v = corps.etatCivil;
    if (v === null) profil.demographie.etatCivil = null;
    else if (typeof v === 'string' && ETATS.includes(v as EtatCivil)) profil.demographie.etatCivil = v as EtatCivil;
    else refus.push('etatCivil');
  }
  if ('province' in corps) {
    profil.demographie.province = typeof corps.province === 'string' && corps.province.trim()
      ? corps.province.trim().toUpperCase().slice(0, 2)
      : null;
  }
  if ('ageConjoint' in corps) {
    const a = age(corps.ageConjoint);
    if (a === undefined) refus.push('ageConjoint');
    else profil.demographie.conjoint.age = a;
  }
  if ('trancheRevenuConjoint' in corps) {
    const v = corps.trancheRevenuConjoint;
    if (v === null) profil.demographie.conjoint.trancheRevenu = null;
    else if (typeof v === 'string' && TRANCHES.includes(v as TrancheRevenu)) {
      profil.demographie.conjoint.trancheRevenu = v as TrancheRevenu;
    } else refus.push('trancheRevenuConjoint');
  }

  // ── Les enfants bénéficiaires — la matière de la stratégie REEE ───────────
  if ('enfants' in corps) {
    const brut = corps.enfants;
    if (!Array.isArray(brut)) refus.push('enfants');
    else {
      const propres: EnfantBeneficiaire[] = [];
      for (const e of brut) {
        const o = e as Record<string, unknown>;
        const prenom = typeof o?.prenom === 'string' ? o.prenom.trim().slice(0, 40) : '';
        if (!prenom) continue;                       // un enfant sans prénom n'est pas rattachable
        const a = age(o?.age ?? null);
        propres.push({ prenom, age: a === undefined ? null : a });
      }
      profil.demographie.enfants = propres;
    }
  }

  // ── Revenus ───────────────────────────────────────────────────────────────
  if ('trancheRevenu' in corps) {
    const v = corps.trancheRevenu;
    if (v === null) { profil.revenus.trancheRevenu = null; profil.revenus.dateDonnee = null; }
    else if (typeof v === 'string' && TRANCHES.includes(v as TrancheRevenu)) {
      profil.revenus.trancheRevenu = v as TrancheRevenu;
      profil.revenus.dateDonnee = jour;
      // La SOURCE change la valeur de la donnée : « dit en rencontre » et
      // « lu sur l'avis de cotisation » ne se valent pas, et le badge le montre.
      profil.revenus.source = corps.sourceRevenu === 'document' ? 'document' : 'declare';
    } else refus.push('trancheRevenu');
  }

  // ── Droits — source autoritaire : l'avis de cotisation ────────────────────
  const DROITS = ['reerInutilises', 'celiInutilises', 'celiConjointInutilises', 'pertesCapitalReportees'] as const;
  for (const champ of DROITS) {
    if (!(champ in corps)) continue;
    const m = montant(corps[champ]);
    if (m === undefined) { refus.push(champ); continue; }
    // UN MONTANT SANS DATE NE VAUT RIEN : un droit CELI lu il y a trois ans ne
    // dit rien d'aujourd'hui, et badges.ts le redemande passé douze mois.
    profil.droits[champ] = { montant: m, dateDonnee: m === null ? null : jour };
  }

  // ── Le marqueur d'essai ───────────────────────────────────────────────────
  if ('fictif' in corps) {
    if (typeof corps.fictif !== 'boolean') refus.push('fictif');
    // Le marqueur se pose A LA MAIN — c'est le garde de la couche IA d'essai.
    else profil.fictif = corps.fictif;
  }

  // ── Intentions ────────────────────────────────────────────────────────────
  if ('donsAnnuelsMoyens' in corps) {
    const m = montant(corps.donsAnnuelsMoyens);
    if (m === undefined) refus.push('donsAnnuelsMoyens');
    else profil.intentions.donsAnnuelsMoyens = m;
  }
  if ('ageRetraiteVise' in corps) {
    const a = age(corps.ageRetraiteVise);
    if (a === undefined) refus.push('ageRetraiteVise');
    else profil.intentions.ageRetraiteVise = a;
  }
  for (const champ of ['venteEntreprisePrevue', 'achatImmobilierPrevu', 'testamentAJour'] as const) {
    if (!(champ in corps)) continue;
    const v = corps[champ];
    if (v === null) profil.intentions[champ] = null;
    else if (typeof v === 'string' && TERNAIRE.includes(v as ReponseTernaire)) {
      profil.intentions[champ] = v as ReponseTernaire;
    } else refus.push(champ);
  }

  if (refus.length > 0) {
    return NextResponse.json({ error: `Valeur refusée : ${refus.join(', ')}` }, { status: 400 });
  }

  const ecrit: ProfilClient = await ecrireProfil(profil, jour);
  return NextResponse.json({
    demographie: ecrit.demographie,
    revenus: ecrit.revenus,
    droits: ecrit.droits,
    intentions: ecrit.intentions,
  });
}
