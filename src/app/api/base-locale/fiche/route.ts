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
import { profilPourClient, lireProfil, ecrireProfil } from '@/lib/profils/stockage';
import {
  pertesCapitalReporteesVierges, UNITES_PERTES_CAPITAL, SOURCES_PERTES_CAPITAL,
} from '@/lib/profils/types';
import type {
  ProfilClient, EtatCivil, TrancheRevenu, ReponseTernaire, EnfantBeneficiaire,
  UnitePertesCapital, SourcePertesCapital,
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
  // PAR NOM AUSSI — 18 août 2026. Le composeur de cours cibles ne connaît que
  // le nom du client ; exiger un identifiant l'obligeait à quitter l'écran
  // pour répondre à une question posée sur cet écran-là.
  const nomDemande = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  if (!id && !nomDemande) {
    return NextResponse.json({ error: 'Identifiant ou nom requis' }, { status: 400 });
  }

  const jour = new Date().toISOString().slice(0, 10);
  const profil = id ? await lireProfil(id) : await profilPourClient(nomDemande, jour);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  const refus: string[] = [];

  // ── Démographie ───────────────────────────────────────────────────────────
  if ('dateNaissance' in corps) {
    const v = corps.dateNaissance;
    if (v === null) profil.demographie.dateNaissance = null;
    else if (typeof v === 'string' && /^(19|20)\d{2}-\d{2}-\d{2}$/.test(v)) {
      profil.demographie.dateNaissance = v;
    } else refus.push('dateNaissance');
  }
  // L'ANNÉE SEULE — la voie rapide (18 août 2026). Quatre chiffres suffisent
  // au plafond CELI cumulatif, et le résultat est exact : c'est l'année des
  // 18 ans qui fixe le départ. On borne à un intervalle plausible plutôt que
  // d'accepter n'importe quel entier.
  if ('anneeNaissance' in corps) {
    const v = corps.anneeNaissance;
    const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
    if (v === null || v === '') profil.demographie.anneeNaissance = null;
    else if (typeof n === 'number' && Number.isInteger(n) && n >= 1900 && n <= new Date().getFullYear()) {
      profil.demographie.anneeNaissance = n;
    } else refus.push('anneeNaissance');
  }
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
  const DROITS = ['reerInutilises', 'celiInutilises', 'celiConjointInutilises'] as const;
  for (const champ of DROITS) {
    if (!(champ in corps)) continue;
    const m = montant(corps[champ]);
    if (m === undefined) { refus.push(champ); continue; }
    // UN MONTANT SANS DATE NE VAUT RIEN : un droit CELI lu il y a trois ans ne
    // dit rien d'aujourd'hui, et badges.ts le redemande passé douze mois.
    profil.droits[champ] = { montant: m, dateDonnee: m === null ? null : jour };
  }

  // ── Les pertes reportées — un montant ET son unité ────────────────────────
  //
  // Ce champ a quitté la boucle ci-dessus le 20 août 2026 : contrairement aux
  // droits REER et CELI, dont le sens ne fait aucun doute, une perte en capital
  // reportée existe en deux unités incompatibles (brute, ou nette de l'avis de
  // cotisation). Un nombre seul ne dit donc pas ce qu'il vaut.
  //
  // DEUX FORMES ACCEPTÉES, et c'est délibéré :
  //   · un NOMBRE NU — ce que l'écran envoie encore aujourd'hui. Il est reçu,
  //     conservé, et marqué `unite: 'inconnue'`. C'est la vérité : le champ
  //     actuel ne demande pas l'unité. Le moteur refusera de le chiffrer, et
  //     c'est le comportement voulu tant que l'écran n'a pas été repris.
  //   · un OBJET { montant, unite, source } — la forme complète. Sans elle,
  //     l'unité serait un état inatteignable, et le modèle invérifiable de bout
  //     en bout. La date reste posée ICI, jamais par le client.
  if ('pertesCapitalReportees' in corps) {
    const brut = corps.pertesCapitalReportees;
    const objet = brut !== null && typeof brut === 'object' && !Array.isArray(brut)
      ? (brut as Record<string, unknown>) : null;
    const m = montant(objet ? objet.montant : brut);
    const unite = objet?.unite;
    const source = objet?.source;

    if (
      m === undefined ||
      (unite !== undefined && !UNITES_PERTES_CAPITAL.includes(unite as UnitePertesCapital)) ||
      (source !== undefined && !SOURCES_PERTES_CAPITAL.includes(source as SourcePertesCapital))
    ) {
      refus.push('pertesCapitalReportees');
    } else if (m === null) {
      // EFFACER, C'EST TOUT EFFACER : un montant retiré ne doit pas laisser
      // derrière lui l'unité de la saisie précédente.
      profil.droits.pertesCapitalReportees = pertesCapitalReporteesVierges();
    } else {
      profil.droits.pertesCapitalReportees = {
        montant: m,
        unite: (unite as UnitePertesCapital | undefined) ?? 'inconnue',
        source: (source as SourcePertesCapital | undefined) ?? 'inconnue',
        dateDonnee: jour,
      };
    }
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
