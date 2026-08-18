'use client';

// LE PARCOURS FISCAL — un créateur de document, sur le moule de « Cours cibles ».
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI A CHANGÉ LE 6 AOÛT 2026, ET POURQUOI.
//
// L'écran précédent était un TABLEAU DE BORD : tout s'y affichait à plat, on
// pouvait tout consulter, et on ne pouvait rien produire. Nicolas : « j'ai
// l'impression que c'est juste un truc qui fait rien ». Il avait raison, et le
// diagnostic était double — le moteur était affamé (corrigé en phase 0), et il
// n'existait aucun bouton pour sortir un document.
//
// Celui-ci est un PARCOURS : on choisit un client, on colle, on répond, on voit
// ce qui a été trouvé, on génère. Cinq étapes, une seule à l'écran à la fois.
//
// LE PRINCIPE CENTRAL : à chaque étape, l'écran dit CE QUE LA PROCHAINE DONNÉE
// RAPPORTE. Une liste de « donnée manquante » ne fait rien faire à personne ;
// « répondez à ceci et une piste devient chiffrée » fait agir. C'est ce qui
// sépare un détecteur d'opportunités d'un formulaire.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardPaste, Check, X, HelpCircle, Loader2, ArrowRight, ArrowLeft, RotateCcw,
  Wallet, ListChecks, UserPlus, Users, FileText, Download, Search, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ouvrirPdf } from '@/lib/pdf/ouvrir-pdf';
import type { Badge as BadgeProfil, CouleurBadge } from '@/lib/profils/badges';

// ── Types de la charge utile servie par /api/base-locale/profils ─────────────

type Constat = {
  strategie: string; titre: string; titreClient: string;
  statut: 'calcule' | 'montant-a-confirmer' | 'indisponible' | 'non-applicable';
  montantEstime: number | null; libelleMontant: string; explication: string;
  donneesManquantes: string[]; dejaEnOrdre: boolean;
};

type Manque = {
  donnee: string; bloque: number; debloqueImmediatement: number; strategies: string[];
};

type Detection = {
  chiffrees: number; aConfirmer: number; bloquees: number; dejaEnOrdre: number;
  total: number; prochainePriorite: Manque | null;
};

type Fiche = {
  fictif?: boolean;
  dateNaissance?: string | null;
  age: number | null;
  etatCivil: string | null;
  enfants: Array<{ prenom: string; age: number | null }>;
  trancheRevenu: string | null;
  trancheRevenuConjoint: string | null;
  droits: Record<string, { montant: number | null; dateDonnee: string | null }>;
  donsAnnuelsMoyens: number | null;
};

type CompteDerive = {
  numero: string | null; suffixe: string;
  provenanceNumero: 'livre' | 'confirme' | 'ambigu' | 'absent' | 'non-jointable';
  type: string | null; dateReleve: string | null;
  presence?: 'au-releve' | 'livre-seulement';
  derniereActivite?: string | null;
  dernierSolde?: number | null;
  positions: Array<{ symbole: string; valeurMarchande: number | null }>;
  encaisse: Array<{ devise: string; montant: number }>;
};

type Profil = {
  id: string; nom: string | null; version: number; dateMiseAJour: string;
  constats?: Constat[]; detection?: Detection | null; manques?: Manque[]; fiche?: Fiche | null;
  selection?: { strategies: string[]; dateSelection: string | null };
  consolidation?: { comptesExternes: string; historiqueExterne: string; dateConfirmation: string | null } | null;
  comptes?: { comptes: CompteDerive[] } | null;
  badges?: BadgeProfil[]; questions?: string[];
  compteurs?: { auto: number; manuel: number; manquant: number; aReconfirmer: number };
  celi?: { nbLignes: number } | null;
};

type Etape = 'hub' | 'donnees' | 'fiche' | 'detecteur' | 'rapport';

// ── Vocabulaire ──────────────────────────────────────────────────────────────

const argent = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`;

const TON: Record<Constat['statut'], { classe: string; mot: string }> = {
  calcule: { classe: 'border-emerald-300 bg-emerald-50', mot: 'chiffré' },
  'montant-a-confirmer': { classe: 'border-amber-300 bg-amber-50', mot: 'à confirmer' },
  indisponible: { classe: 'border-gray-200 bg-gray-50', mot: 'donnée manquante' },
  'non-applicable': { classe: 'border-gray-200 bg-gray-50', mot: 'sans objet' },
};

const TON_BADGE: Record<CouleurBadge, string> = {
  auto: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  manuel: 'border-amber-200 bg-amber-50 text-amber-900',
  manquant: 'border-gray-200 bg-gray-50 text-text-muted',
};

const ETATS_CIVILS = [
  ['celibataire', 'Célibataire'], ['marie', 'Marié'], ['conjoint-de-fait', 'Conjoint de fait'],
  ['veuf', 'Veuf'], ['divorce', 'Divorcé'],
];
const TRANCHES = [
  ['0-50k', '0 – 50 k'], ['50-100k', '50 – 100 k'], ['100-150k', '100 – 150 k'],
  ['150-200k', '150 – 200 k'], ['200k+', '200 k et +'],
];

const ETAPES: Array<{ cle: Etape; libelle: string }> = [
  { cle: 'donnees', libelle: 'Données' },
  { cle: 'fiche', libelle: 'Fiche' },
  { cle: 'detecteur', libelle: 'Détecteur' },
  { cle: 'rapport', libelle: 'Rapport' },
];

// ── Petits composants ────────────────────────────────────────────────────────

/** Un groupe de boutons-radio. La valeur courante est cerclée, jamais devinée. */
function Choix({ valeur, options, onChoisir }: {
  valeur: string | null;
  options: string[][];
  onChoisir: (v: string | null) => void;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {options.map(([v, libelle]) => (
        <button
          key={v}
          onClick={() => onChoisir(valeur === v ? null : v)}
          className={`rounded border px-2 py-0.5 text-xs ${
            valeur === v
              ? 'border-brand-primary bg-brand-primary/10 font-medium text-brand-primary'
              : 'border-gray-200 bg-white text-text-muted hover:border-gray-300'
          }`}
        >
          {libelle}
        </button>
      ))}
    </span>
  );
}

/** Un champ numérique enregistré à la sortie du champ, jamais à chaque frappe. */
function ChampNombre({ valeur, suffixe, onValider }: {
  valeur: number | null;
  suffixe?: string;
  onValider: (v: number | null) => void;
}) {
  const [texte, setTexte] = useState(valeur === null ? '' : String(valeur));
  useEffect(() => { setTexte(valeur === null ? '' : String(valeur)); }, [valeur]);
  return (
    <span className="flex items-center gap-1">
      <input
        value={texte}
        inputMode="decimal"
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => {
          const t = texte.replace(/[\s$]/g, '').replace(',', '.');
          if (t === '') { onValider(null); return; }
          const n = Number.parseFloat(t);
          if (Number.isFinite(n)) onValider(n);
        }}
        className="w-28 rounded border border-gray-200 bg-white px-2 py-1 text-right text-sm tabular-nums"
        placeholder="—"
      />
      {suffixe && <span className="text-xs text-text-muted">{suffixe}</span>}
    </span>
  );
}

/** Une ligne de question : l'intitulé à gauche, la réponse à droite. */
function Ligne({ question, aide, children }: {
  question: string; aide?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 last:border-0">
      <span className="text-sm text-text-main">
        {question}
        {aide && <span className="ml-2 text-xs text-text-muted">{aide}</span>}
      </span>
      <span className="ml-auto">{children}</span>
    </div>
  );
}

// ── L'écran ──────────────────────────────────────────────────────────────────

export function EcranFiscal({ racine }: { racine: string }) {
  const [etape, setEtape] = useState<Etape>('hub');
  const [profils, setProfils] = useState<Profil[]>([]);
  const [idCourant, setIdCourant] = useState<string | null>(null);
  const [nomClient, setNomClient] = useState('');
  const [recherche, setRecherche] = useState('');
  const [colleTx, setColleTx] = useState('');
  const [collePos, setCollePos] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preset, setPreset] = useState<'instantane' | 'complet'>('complet');

  const courant = profils.find((p) => p.id === idCourant) ?? null;

  const rafraichir = useCallback(async () => {
    const r = await fetch('/api/base-locale/profils');
    if (!r.ok) return;
    const d = await r.json();
    setProfils(d.profils ?? []);
  }, []);
  useEffect(() => { void rafraichir(); }, [rafraichir]);

  /** Écrit un champ de fiche et rafraîchit — enregistrement immédiat, sans bouton. */
  async function ecrireFiche(champ: string, valeur: unknown) {
    if (!idCourant) return;
    const r = await fetch('/api/base-locale/fiche', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idCourant, [champ]: valeur }),
    });
    if (!r.ok) setErreur((await r.json()).error ?? 'Valeur refusée');
    else setErreur(null);
    await rafraichir();
  }

  async function repondreConsolidation(champ: string, valeur: string) {
    if (!idCourant) return;
    await fetch('/api/base-locale/consolidation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idCourant, [champ]: valeur }),
    });
    await rafraichir();
  }

  async function basculerStrategie(strategie: string) {
    if (!courant) return;
    const actuelles = courant.selection?.strategies ?? [];
    const suivantes = actuelles.includes(strategie)
      ? actuelles.filter((s) => s !== strategie) : [...actuelles, strategie];
    await fetch('/api/base-locale/strategies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: courant.id, strategies: suivantes }),
    });
    await rafraichir();
  }

  async function importer(quoi: 'transactions' | 'positions') {
    setErreur(null); setInfo(null);
    const nom = nomClient.trim() || courant?.nom || '';
    if (!nom) { setErreur('Indiquez le nom du client.'); return; }
    const texte = quoi === 'transactions' ? colleTx : collePos;
    if (!texte.trim()) { setErreur('Collez d’abord les données.'); return; }
    setEnCours(true);
    try {
      const url = quoi === 'transactions'
        ? '/api/base-locale/historique' : '/api/base-locale/positions';
      const corps = quoi === 'transactions' ? { nom, texte } : { nomClient: nom, texte };
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Import impossible');
      if (d.refus) { setErreur(d.refus); return; }
      if (quoi === 'transactions') {
        setIdCourant(d.profil.id);
        setColleTx('');
        setInfo(`${d.resume.nouvelles} transaction(s) ajoutée(s) au grand livre.`);
      } else {
        setCollePos('');
        setInfo(`${d.comptes.length} compte(s) lus au relevé.`);
      }
      await rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Import impossible');
    } finally { setEnCours(false); }
  }

  async function genererRapport() {
    if (!courant?.nom) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const res = await fetch('/api/base-locale/rapport-fiscal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomClient: courant.nom,
          preset,
          strategies: courant.selection?.strategies?.length ? courant.selection.strategies : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Génération impossible');
      const chemin = res.headers.get('X-Archive-Chemin');
      const blob = await res.blob();
      // Le document s'OUVRE (17 août 2026) : il est relu avant d'être remis, et
      // il est de toute façon déjà archivé dans le dossier du client.
      const sortie = ouvrirPdf(blob, `optimisations-fiscales-${new Date().toISOString().slice(0, 10)}.pdf`);
      const geste = sortie === 'ouvert' ? 'PDF ouvert dans un nouvel onglet' : 'PDF téléchargé';
      setInfo(chemin ? `${geste} · archivé dans ${chemin}` : `${geste}.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Génération impossible');
    } finally { setEnCours(false); }
  }

  function choisirClient(p: Profil) {
    setIdCourant(p.id);
    setNomClient(p.nom ?? '');
    setEtape('donnees');
  }

  // ── HUB ────────────────────────────────────────────────────────────────────
  if (etape === 'hub') {
    const filtres = profils.filter((p) =>
      (p.nom ?? '').toLowerCase().includes(recherche.trim().toLowerCase()));
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => { setIdCourant(null); setNomClient(''); setEtape('donnees'); }}
            className="rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition hover:border-brand-primary"
          >
            <UserPlus className="h-8 w-8 text-brand-primary" />
            <p className="mt-3 text-lg font-bold text-text-main">Nouveau client</p>
            <p className="mt-1 text-sm text-text-muted">
              Coller l’historique Croesus et le relevé de positions, répondre à quelques questions,
              obtenir le rapport.
            </p>
          </button>
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6">
            <Users className="h-8 w-8 text-brand-primary" />
            <p className="mt-3 text-lg font-bold text-text-main">Client existant</p>
            <p className="mt-1 text-sm text-text-muted">
              {profils.length} dossier{profils.length > 1 ? 's' : ''} sur ce poste.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher un client…"
                className="w-full text-sm outline-none"
              />
            </div>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {filtres.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => choisirClient(p)}
                    className="flex w-full items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-left hover:border-brand-primary"
                  >
                    <span className="text-sm font-medium text-text-main">{p.nom}</span>
                    {p.detection && p.detection.chiffrees > 0 && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800">
                        {p.detection.chiffrees} piste{p.detection.chiffrees > 1 ? 's' : ''}
                      </span>
                    )}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-text-muted" />
                  </button>
                </li>
              ))}
              {filtres.length === 0 && (
                <li className="px-1 py-2 text-xs text-text-muted">Aucun dossier ne correspond.</li>
              )}
            </ul>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Les dossiers vivent dans <code className="font-mono">{racine}</code> et ne quittent jamais
          ce poste.
        </p>
      </div>
    );
  }

  // ── Ossature commune des étapes ────────────────────────────────────────────
  const indexEtape = ETAPES.findIndex((e) => e.cle === etape);
  const d = courant?.detection ?? null;

  return (
    <div className="space-y-5">
      {/* Fil des étapes */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEtape('hub')}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-text-muted hover:border-gray-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clients
        </button>
        {ETAPES.map((e, i) => (
          <button
            key={e.cle}
            onClick={() => setEtape(e.cle)}
            disabled={!courant && e.cle !== 'donnees'}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              e.cle === etape
                ? 'bg-brand-primary font-semibold text-white'
                : i < indexEtape
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-gray-100 text-text-muted disabled:opacity-40'
            }`}
          >
            {i + 1}. {e.libelle}
          </button>
        ))}
        {courant?.nom && (
          <span className="ml-auto text-sm font-medium text-text-main">{courant.nom}</span>
        )}
      </div>

      {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}

      {/* LE BANDEAU DU DÉTECTEUR — présent à toutes les étapes, parce que la
          prochaine action est toujours la même question : que manque-t-il ? */}
      {d && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-sm font-bold text-text-main">
              <Sparkles className="h-4 w-4 text-brand-primary" />
              {d.chiffrees} piste{d.chiffrees > 1 ? 's' : ''} chiffrée{d.chiffrees > 1 ? 's' : ''} sur {d.total}
            </span>
            <span className="text-xs text-text-muted">
              {d.aConfirmer} à confirmer · {d.bloquees} bloquée{d.bloquees > 1 ? 's' : ''}
              {d.dejaEnOrdre > 0 ? ` · ${d.dejaEnOrdre} déjà en ordre` : ''}
            </span>
          </div>
          {d.prochainePriorite && (
            <p className="mt-1.5 text-sm text-text-main">
              <span className="text-text-muted">La donnée qui rapporte le plus maintenant :</span>{' '}
              <strong>{d.prochainePriorite.donnee}</strong>
              <span className="text-text-muted">
                {' '}— {d.prochainePriorite.debloqueImmediatement > 0
                  ? `elle rend ${d.prochainePriorite.debloqueImmediatement} piste${d.prochainePriorite.debloqueImmediatement > 1 ? 's' : ''} chiffrable${d.prochainePriorite.debloqueImmediatement > 1 ? 's' : ''} tout de suite`
                  : `elle bloque ${d.prochainePriorite.bloque} piste${d.prochainePriorite.bloque > 1 ? 's' : ''}`}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── ÉTAPE 1 · DONNÉES ─────────────────────────────────────────────── */}
      {etape === 'donnees' && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <ClipboardPaste className="h-4 w-4 text-brand-primary" />
            <h2 className="font-semibold text-text-main">Les données du client</h2>
          </header>
          <div className="space-y-4 p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-main">
                Nom du client — il nomme aussi son dossier sur le disque
              </span>
              <input
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
                placeholder="Ex. Michel Tremblay"
                className="w-full max-w-sm rounded-lg border border-gray-200 bg-bg-light px-3 py-2 text-sm"
              />
            </label>

            <div>
              <p className="text-sm text-text-muted">
                <strong>Historique complet</strong> depuis l’ouverture des comptes (18 ou 20 colonnes).
                Chaque collage est archivé tel quel ; seules les transactions inédites sont ajoutées.
              </p>
              <textarea
                value={colleTx} onChange={(e) => setColleTx(e.target.value)} rows={4}
                placeholder="Collez les transactions…"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-bg-light px-3 py-2 font-mono text-xs"
              />
              <Button onClick={() => void importer('transactions')} disabled={enCours} className="mt-2">
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Importer l’historique
              </Button>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-text-muted">
                <strong>Relevé de positions</strong> (13 colonnes). C’est lui qui donne les gains et
                pertes latents — sans lui, aucune piste de cristallisation n’est calculable.
              </p>
              <textarea
                value={collePos} onChange={(e) => setCollePos(e.target.value)} rows={3}
                placeholder="Collez le relevé de positions…"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-bg-light px-3 py-2 font-mono text-xs"
              />
              <Button variant="secondary" onClick={() => void importer('positions')} disabled={enCours} className="mt-2">
                <Wallet className="h-4 w-4" /> Importer le relevé
              </Button>
            </div>

            {courant?.comptes && courant.comptes.comptes.length > 0 && (
              <ul className="border-t border-gray-200 pt-3">
                {courant.comptes.comptes.map((c) => {
                  const vm = c.positions.reduce((s, x) => s + (x.valeurMarchande ?? 0), 0)
                    + c.encaisse.reduce((s, x) => s + x.montant, 0);
                  // UN COMPTE VU AU LIVRE SEULEMENT n'a plus de position
                  // aujourd'hui. On dit CE QU'ON OBSERVE — « plus de position
                  // depuis <date> » — jamais « fermé », qui serait une
                  // déduction : le compte peut être fermé, transféré ou vidé.
                  const dormant = c.presence === 'livre-seulement';
                  return (
                    <li
                      key={c.numero ?? c.suffixe}
                      className={`flex flex-wrap items-baseline gap-2 text-sm ${dormant ? 'opacity-70' : ''}`}
                    >
                      <span className="font-mono text-text-main">{c.numero ?? `…-${c.suffixe}`}</span>
                      <span className="text-text-muted">{c.type ?? 'régime inconnu'}</span>
                      {dormant ? (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                          plus de position
                          {c.derniereActivite ? ` depuis ${c.derniereActivite}` : ''}
                        </span>
                      ) : (
                        <span className="tabular-nums text-text-main">{argent(vm)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {courant && (
              <div className="flex justify-end border-t border-gray-200 pt-3">
                <Button onClick={() => setEtape('fiche')}>
                  Continuer <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── ÉTAPE 2 · FICHE ───────────────────────────────────────────────── */}
      {etape === 'fiche' && courant && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <HelpCircle className="h-4 w-4 text-brand-primary" />
            <h2 className="font-semibold text-text-main">Ce que seul le client peut dire</h2>
            <span className="ml-auto text-xs text-text-muted">
              Enregistré à mesure — aucun bouton à cliquer
            </span>
          </header>
          <div className="px-4 py-2">
            <Ligne question="Dossier fictif — bac d’essai"
              aide="active l’IA de reformulation sur ce dossier seulement (aucune donnée réelle)">
              <Choix
                valeur={courant.fiche?.fictif ? 'oui' : 'non'}
                options={[['non', 'Non'], ['oui', 'Oui']]}
                onChoisir={(v) => void ecrireFiche('fictif', v === 'oui')}
              />
            </Ligne>
            <Ligne question="Détenez-vous des comptes de placement ailleurs qu’ici ?"
              aide="commande la portée de tous les constats">
              <Choix
                valeur={courant.consolidation?.comptesExternes ?? 'inconnu'}
                options={[['non', 'Non'], ['oui', 'Oui'], ['inconnu', 'Pas demandé']]}
                onChoisir={(v) => void repondreConsolidation('comptesExternes', v ?? 'inconnu')}
              />
            </Ligne>
            <Ligne question="Avez-vous déjà eu un CELI ailleurs, même fermé depuis ?">
              <Choix
                valeur={courant.consolidation?.historiqueExterne ?? 'inconnu'}
                options={[['jamais', 'Jamais'], ['deja-eu', 'Déjà eu'], ['inconnu', 'Pas demandé']]}
                onChoisir={(v) => void repondreConsolidation('historiqueExterne', v ?? 'inconnu')}
              />
            </Ligne>
            <Ligne question="Date de naissance" aide="donne l’année des 18 ans — le plafond CELI exact">
              <input
                type="date"
                defaultValue={courant.fiche?.dateNaissance ?? ''}
                onBlur={(e) => void ecrireFiche('dateNaissance', e.target.value || null)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-sm"
              />
            </Ligne>
            <Ligne question="État civil">
              <Choix valeur={courant.fiche?.etatCivil ?? null} options={ETATS_CIVILS}
                onChoisir={(v) => void ecrireFiche('etatCivil', v)} />
            </Ligne>
            <Ligne question="Tranche de revenu imposable">
              <Choix valeur={courant.fiche?.trancheRevenu ?? null} options={TRANCHES}
                onChoisir={(v) => void ecrireFiche('trancheRevenu', v)} />
            </Ligne>
            <Ligne question="Tranche de revenu du conjoint">
              <Choix valeur={courant.fiche?.trancheRevenuConjoint ?? null} options={TRANCHES}
                onChoisir={(v) => void ecrireFiche('trancheRevenuConjoint', v)} />
            </Ligne>
            <Ligne question="Droits CELI inutilisés" aide="avis de cotisation">
              <ChampNombre valeur={courant.fiche?.droits?.celiInutilises?.montant ?? null} suffixe="$"
                onValider={(v) => void ecrireFiche('celiInutilises', v)} />
            </Ligne>
            <Ligne question="Droits CELI du conjoint" aide="son propre avis de cotisation">
              <ChampNombre valeur={courant.fiche?.droits?.celiConjointInutilises?.montant ?? null} suffixe="$"
                onValider={(v) => void ecrireFiche('celiConjointInutilises', v)} />
            </Ligne>
            <Ligne question="Droits REER inutilisés" aide="avis de cotisation">
              <ChampNombre valeur={courant.fiche?.droits?.reerInutilises?.montant ?? null} suffixe="$"
                onValider={(v) => void ecrireFiche('reerInutilises', v)} />
            </Ligne>
            <Ligne question="Pertes en capital reportées">
              <ChampNombre valeur={courant.fiche?.droits?.pertesCapitalReportees?.montant ?? null} suffixe="$"
                onValider={(v) => void ecrireFiche('pertesCapitalReportees', v)} />
            </Ligne>
            <Ligne question="Dons de bienfaisance annuels">
              <ChampNombre valeur={courant.fiche?.donsAnnuelsMoyens ?? null} suffixe="$"
                onValider={(v) => void ecrireFiche('donsAnnuelsMoyens', v)} />
            </Ligne>

            {/* Les enfants — la matière de la subvention REEE (30 % combiné). */}
            <div className="border-t border-gray-100 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-main">
                  Enfants bénéficiaires d’un REEE
                  <span className="ml-2 text-xs text-text-muted">
                    la subvention vaut 30 % — 20 % du fédéral, 10 % du Québec
                  </span>
                </span>
                <button
                  onClick={() => void ecrireFiche('enfants',
                    [...(courant.fiche?.enfants ?? []), { prenom: 'Enfant', age: null }])}
                  className="ml-auto rounded border border-gray-200 px-2 py-0.5 text-xs text-text-muted hover:border-gray-300"
                >
                  Ajouter
                </button>
              </div>
              {(courant.fiche?.enfants ?? []).map((e, i) => (
                <div key={i} className="mt-1.5 flex items-center gap-2">
                  <input
                    defaultValue={e.prenom}
                    onBlur={(ev) => {
                      const liste = [...(courant.fiche?.enfants ?? [])];
                      liste[i] = { ...liste[i], prenom: ev.target.value };
                      void ecrireFiche('enfants', liste);
                    }}
                    className="w-40 rounded border border-gray-200 px-2 py-1 text-sm"
                    placeholder="Prénom — comme dans les notes Croesus"
                  />
                  <ChampNombre
                    valeur={e.age}
                    suffixe="ans"
                    onValider={(v) => {
                      const liste = [...(courant.fiche?.enfants ?? [])];
                      liste[i] = { ...liste[i], age: v };
                      void ecrireFiche('enfants', liste);
                    }}
                  />
                  <button
                    onClick={() => void ecrireFiche('enfants',
                      (courant.fiche?.enfants ?? []).filter((_, j) => j !== i))}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-text-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-200 px-4 py-3">
            <Button onClick={() => setEtape('detecteur')}>
              Voir ce que le moteur a trouvé <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* ── ÉTAPE 3 · DÉTECTEUR ───────────────────────────────────────────── */}
      {etape === 'detecteur' && courant && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <ListChecks className="h-4 w-4 text-brand-primary" />
            <h2 className="font-semibold text-text-main">Les pistes trouvées</h2>
            <span className="ml-auto text-xs text-text-muted">
              {(courant.selection?.strategies ?? []).length} retenue(s) pour le rapport
            </span>
          </header>
          <ul className="space-y-2 p-4">
            {(courant.constats ?? []).map((c) => {
              const coche = (courant.selection?.strategies ?? []).includes(c.strategie);
              const t = TON[c.statut];
              return (
                <li key={c.strategie}>
                  <label className={`flex cursor-pointer gap-2 rounded border px-3 py-2 ${t.classe} ${
                    coche ? 'ring-1 ring-brand-primary' : ''}`}>
                    <input type="checkbox" checked={coche}
                      onChange={() => void basculerStrategie(c.strategie)}
                      className="mt-1 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        {/* LE TITRE TECHNIQUE À L'ÉCRAN, le titre client au
                            document — corrigé le 17 août 2026, la convention
                            était inversée ici. Le planificateur cherche une
                            stratégie par le nom qu'il connaît (« Cristallisation
                            de pertes ») ; c'est ce nom qu'il coche, et c'est ce
                            nom qui figure dans le mandat du fiscaliste. */}
                        <span className="text-sm font-medium text-text-main">{c.titre}</span>
                        <span className="text-[11px] uppercase text-text-muted">{t.mot}</span>
                        {c.statut === 'calcule' && c.montantEstime !== null && (
                          <span className="text-sm font-semibold tabular-nums text-text-main">
                            {argent(c.montantEstime)}
                            <span className="ml-1 text-[11px] font-normal text-text-muted">
                              {c.libelleMontant}
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">{c.explication}</span>
                      {c.donneesManquantes.length > 0 && (
                        <span className="mt-1 block text-[11px] text-amber-800">
                          Pour aller plus loin : {c.donneesManquantes.join(' · ')}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {(courant.badges ?? []).length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-text-muted">
                {courant.compteurs?.auto ?? 0} automatiques · {courant.compteurs?.manuel ?? 0} saisis ·{' '}
                {courant.compteurs?.manquant ?? 0} manquants
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(courant.badges ?? []).map((b) => (
                  <span key={b.champ} title={b.date ?? undefined}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${TON_BADGE[b.couleur]}`}>
                    {b.libelle}
                    {b.valeur && <span className="font-medium tabular-nums">{b.valeur}</span>}
                    {b.aReconfirmer && <RotateCcw className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-gray-200 px-4 py-3">
            <Button onClick={() => setEtape('rapport')}>
              Composer le rapport <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* ── ÉTAPE 4 · RAPPORT ─────────────────────────────────────────────── */}
      {etape === 'rapport' && courant && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <FileText className="h-4 w-4 text-brand-primary" />
            <h2 className="font-semibold text-text-main">Le document</h2>
          </header>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              {([
                ['instantane', 'Instantané', 'Ce que le portefeuille dit aujourd’hui — sans la fiche.'],
                ['complet', 'Bilan complet', 'Tout le catalogue, y compris ce qui exige la fiche.'],
              ] as const).map(([cle, titre, texte]) => (
                <button key={cle} onClick={() => setPreset(cle)}
                  className={`rounded-xl border-2 p-4 text-left ${
                    preset === cle ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 bg-white'}`}>
                  <p className="text-sm font-bold text-text-main">{titre}</p>
                  <p className="mt-1 text-xs text-text-muted">{texte}</p>
                </button>
              ))}
            </div>

            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Version conseiller — usage interne.</strong> Tant que les règles et les barèmes
              n’ont pas été revus par un fiscaliste, le document porte ce marquage sur sa couverture
              et en pied de chaque page. Il ne se remet pas au client.
            </p>

            <div className="flex items-center gap-3">
              <Button onClick={() => void genererRapport()} disabled={enCours}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {enCours ? 'Génération…' : 'Générer le PDF'}
              </Button>
              <span className="text-xs text-text-muted">
                {(courant.selection?.strategies ?? []).length > 0
                  ? `${courant.selection!.strategies.length} stratégie(s) retenue(s) à l’étape précédente`
                  : `aucune sélection : le préréglage « ${preset === 'complet' ? 'Bilan complet' : 'Instantané'} » fait foi`}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
