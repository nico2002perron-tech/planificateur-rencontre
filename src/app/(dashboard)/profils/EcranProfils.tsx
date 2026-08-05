'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Check, X, HelpCircle, Loader2, ArrowRight, RotateCcw, Wallet, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/Button';
// L'ALIAS EST OBLIGATOIRE : `Badge` est aussi le nom du composant d'interface.
import type { Badge as BadgeProfil, CouleurBadge } from '@/lib/profils/badges';

type ResumeCeli = {
  cotisationsTotales: number | null;
  apportsEnNature: number | null;
  retraitsAnneesPassees: number | null;
  dateOuverture: string | null;
  dateImport: string | null;
  plafond: number | null;
  plafondDepuis: number | null;
  plafondMaximalFauteDage: boolean;
  statut: 'calcule' | 'montant-a-confirmer' | 'indisponible' | 'non-applicable';
  montant: number | null;
  borne: number | null;
  motifs: string[];
  transfertsATrancher: number;
  transfertsApparies: number;
  nbLignes: number;
};

type CompteDerive = {
  numero: string | null;
  suffixe: string;
  provenanceNumero: 'livre' | 'confirme' | 'ambigu' | 'absent' | 'non-jointable';
  candidats: string[];
  type: string | null;
  dateReleve: string | null;
  positions: Array<{ symbole: string; devise: string; valeurMarchande: number | null }>;
  encaisse: Array<{ devise: string; montant: number }>;
};

type Constat = {
  strategie: string;
  titre: string;
  statut: 'calcule' | 'montant-a-confirmer' | 'indisponible' | 'non-applicable';
  montantEstime: number | null;
  libelleMontant: string;
  explication: string;
  donneesManquantes: string[];
};

/**
 * Le ton d'un constat à l'écran — le MÊME code couleur que sur le PDF.
 * Le planificateur doit reconnaître au premier coup d'œil ce qui sortira.
 */
const TON_CONSTAT: Record<Constat['statut'], { classe: string; mot: string }> = {
  calcule: { classe: 'border-emerald-300 bg-emerald-50', mot: 'chiffré' },
  'montant-a-confirmer': { classe: 'border-amber-300 bg-amber-50', mot: 'à confirmer' },
  indisponible: { classe: 'border-gray-200 bg-gray-50', mot: 'donnée manquante' },
  'non-applicable': { classe: 'border-gray-200 bg-gray-50', mot: 'sans objet' },
};

type ProfilResume = {
  id: string; nom: string | null; version: number; dateMiseAJour: string;
  celi: ResumeCeli | null;
  constats?: Constat[];
  selection?: { strategies: string[]; dateSelection: string | null };
  badges?: BadgeProfil[];
  questions?: string[];
  compteurs?: { auto: number; manuel: number; manquant: number; aReconfirmer: number };
  comptes?: { comptes: CompteDerive[]; multiClients: boolean } | null;
};

/** La couleur d'un badge dit la PROVENANCE du champ, jamais sa fraîcheur. */
const TON: Record<CouleurBadge, string> = {
  auto: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  manuel: 'border-amber-200 bg-amber-50 text-amber-900',
  manquant: 'border-gray-200 bg-gray-50 text-text-muted',
};

const MOT_PROVENANCE: Record<CompteDerive['provenanceNumero'], string> = {
  livre: 'numéro trouvé au grand livre',
  confirme: 'numéro confirmé en rencontre',
  ambigu: 'plusieurs comptes portent ce suffixe — à trancher',
  absent: 'aucun compte du livre ne porte ce suffixe',
  'non-jointable': 'compte VMBL : le relevé et le livre ne se comparent pas',
};

type TransfertDouteux = {
  cle: string; compte: string; date: string; montant: number;
  note: string; resolution: 'interne' | 'externe' | null; dateConfirmation: string | null;
};

type ResumeImport = {
  lues: number; nouvelles: number; doublons: number; ignorees: number;
  totalApres: number; comptes: string[]; premiereDate: string | null;
  derniereDate: string | null; dossier: string;
};

const argent = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`;
const ouRien = (n: number | null) => (n === null ? '—' : argent(n));

export function EcranProfils({ profilsInitiaux }: { profilsInitiaux: ProfilResume[] }) {
  const [profils, setProfils] = useState(profilsInitiaux);
  const [nomClient, setNomClient] = useState('');
  const [colle, setColle] = useState('');
  const [collePositions, setCollePositions] = useState('');
  const [resumePositions, setResumePositions] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resume, setResume] = useState<ResumeImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idCourant, setIdCourant] = useState<string | null>(null);
  const [douteux, setDouteux] = useState<TransfertDouteux[]>([]);
  const [apparies, setApparies] = useState(0);

  const rafraichirProfils = useCallback(async () => {
    const r = await fetch('/api/base-locale/profils');
    if (!r.ok) return;
    const d = await r.json();
    setProfils(d.profils ?? []);
  }, []);

  useEffect(() => { void rafraichirProfils(); }, [rafraichirProfils]);

  const chargerTransferts = useCallback(async (id: string) => {
    const res = await fetch(`/api/base-locale/transferts?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const d = await res.json();
    setDouteux(d.douteux ?? []);
    setApparies(d.apparies ?? 0);
  }, []);

  async function importer() {
    setErreur(null);
    if (!nomClient.trim()) { setErreur('Indiquez le nom du client.'); return; }
    if (!colle.trim()) { setErreur('Collez d’abord l’historique.'); return; }
    setEnCours(true);
    try {
      const res = await fetch('/api/base-locale/historique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nomClient.trim(), texte: colle }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Import impossible');
      const d = await res.json();
      setResume(d.resume);
      setIdCourant(d.profil.id);
      setColle('');
      await chargerTransferts(d.profil.id);
      await rafraichirProfils();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setEnCours(false);
    }
  }

  async function importerPositions() {
    setErreur(null);
    setResumePositions(null);
    if (!nomClient.trim()) { setErreur('Indiquez le nom du client.'); return; }
    if (!collePositions.trim()) { setErreur('Collez d’abord le relevé.'); return; }
    setEnCours(true);
    try {
      const res = await fetch('/api/base-locale/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomClient: nomClient.trim(), texte: collePositions }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Import impossible');
      const d = await res.json();
      if (d.refus) { setErreur(d.refus); return; }
      const ambigus = (d.aTrancher ?? []).length;
      setResumePositions(
        `${d.comptes.length} compte(s) lus` +
          (ambigus > 0 ? ` · ${ambigus} suffixe(s) ambigus` : '') +
          (d.livreVide ? ' · aucun grand livre importé pour ce client' : '')
      );
      setCollePositions('');
      await rafraichirProfils();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setEnCours(false);
    }
  }

  /**
   * Coche ou décoche une stratégie et l'enregistre aussitôt.
   *
   * ENREGISTREMENT IMMÉDIAT, sans bouton « Sauvegarder » : le planificateur
   * coche pendant qu'il parle au client, et un bouton oublié voudrait dire un
   * PDF qui ne correspond pas à ce qu'il a décidé. Le serveur date la
   * sélection et refuse toute stratégie hors catalogue.
   */
  async function basculerStrategie(profil: ProfilResume, strategie: string) {
    const actuelles = profil.selection?.strategies ?? [];
    const suivantes = actuelles.includes(strategie)
      ? actuelles.filter((s) => s !== strategie)
      : [...actuelles, strategie];

    // Réponse optimiste : la case bouge tout de suite, la vérité serveur
    // arrive au rafraîchissement.
    setProfils((liste) =>
      liste.map((p) =>
        p.id === profil.id
          ? { ...p, selection: { strategies: suivantes, dateSelection: p.selection?.dateSelection ?? null } }
          : p
      )
    );

    const res = await fetch('/api/base-locale/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: profil.id, strategies: suivantes }),
    });
    if (!res.ok) setErreur('Sélection non enregistrée.');
    await rafraichirProfils();
  }

  async function resoudre(t: TransfertDouteux, resolution: 'interne' | 'externe') {
    if (!idCourant) return;
    const res = await fetch('/api/base-locale/transferts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idCourant, compte: t.compte, date: t.date, montant: t.montant, resolution,
      }),
    });
    // Trancher un transfert change DEUX badges côté serveur : celui des
    // transferts résolus, et — sur une résolution « externe » —
    // `historiqueExterne`. Sans ce second rafraîchissement, les puces mentent
    // jusqu'au prochain rechargement de page.
    if (res.ok) {
      await chargerTransferts(idCourant);
      await rafraichirProfils();
    }
  }

  const aTrancher = douteux.filter((t) => t.resolution === null).length;

  return (
    <div className="space-y-6">
      {/* ── Import de l'historique complet ─────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <ClipboardPaste className="h-4 w-4 text-brand-primary" />
          <h2 className="font-semibold text-text-main">Importer l&apos;historique complet</h2>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-sm text-text-muted">
            Collez l&apos;export Croesus depuis l&apos;ouverture des comptes. Chaque collage est
            archivé tel quel — il restera relisible si le parseur s&apos;améliore — et seules
            les transactions inédites sont ajoutées au grand livre du client.
          </p>
          <input
            type="text"
            value={nomClient}
            onChange={(e) => setNomClient(e.target.value)}
            placeholder="Nom du client — le même que sur le rapport"
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-bg-light px-3 py-2 text-sm"
          />
          {nomClient.trim() && (
            <p className="text-xs text-text-muted">
              Sera rangé dans <code className="font-mono">transactions\{nomClient.trim()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[\/:*?"<>|'’.,]/g, '').replace(/[\s_]+/g, '-')}</code>
            </p>
          )}
          <textarea
            value={colle}
            onChange={(e) => setColle(e.target.value)}
            placeholder="Collez ici les lignes de transactions (20 colonnes, séparées par des tabulations)…"
            rows={6}
            className="w-full rounded-lg border border-gray-200 bg-bg-light px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={importer} disabled={enCours}>
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {enCours ? 'Import en cours…' : 'Importer'}
            </Button>
            {erreur && <span className="text-sm text-red-600">{erreur}</span>}
          </div>

          {/* ── Le relevé de positions : un SECOND collage, à part ──────────
              Un relevé est un instantané, pas un cumul : le plus récent fait
              foi et rien n'est fusionné. Fusionner deux instantanés ferait
              ressusciter les titres vendus. */}
          <div className="border-t border-gray-200 pt-3">
            <p className="text-sm text-text-muted">
              Et, si vous l&apos;avez sous la main, le <strong>relevé de positions</strong> du même
              client (13 colonnes). Il donne les comptes et leur valeur ; le grand livre lui donne
              son numéro complet quand il peut le prouver.
            </p>
            <textarea
              value={collePositions}
              onChange={(e) => setCollePositions(e.target.value)}
              placeholder="Collez ici le relevé de positions…"
              rows={4}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-bg-light px-3 py-2 font-mono text-xs"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="secondary" onClick={importerPositions} disabled={enCours}>
                <Wallet className="h-4 w-4" />
                Importer le relevé
              </Button>
              {resumePositions && (
                <span className="text-sm text-text-muted">{resumePositions}</span>
              )}
            </div>
          </div>

          {resume && (
            <div className="rounded-lg border border-gray-200 bg-bg-light px-4 py-3 text-sm">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">
                <span className="text-text-muted">Lignes lues</span>
                <strong className="tabular-nums text-text-main">{resume.lues}</strong>
                <span className="text-text-muted">Nouvelles</span>
                <strong className="tabular-nums text-text-main">{resume.nouvelles}</strong>
                <span className="text-text-muted">Doublons ignorés</span>
                <strong className="tabular-nums text-text-main">{resume.doublons}</strong>
                <span className="text-text-muted">Total au livre</span>
                <strong className="tabular-nums text-text-main">{resume.totalApres}</strong>
              </div>
              {resume.premiereDate && (
                <p className="mt-2 text-text-muted">
                  Couverture : {resume.premiereDate} → {resume.derniereDate} ·{' '}
                  {resume.comptes.length} compte{resume.comptes.length > 1 ? 's' : ''}
                </p>
              )}
              {resume.dossier && (
                <p className="mt-1 font-mono text-xs text-text-muted">{resume.dossier}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Résolution des transferts orphelins ────────────────────────── */}
      {idCourant && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <HelpCircle className="h-4 w-4 text-brand-primary" />
            <h2 className="font-semibold text-text-main">Transferts entrants à confirmer</h2>
            <span className="ml-auto text-xs text-text-muted">
              {aTrancher} à trancher · {apparies} appariés automatiquement
            </span>
          </header>
          <div className="p-4">
            <p className="mb-3 text-sm text-text-muted">
              Un transfert dont le livre ne prouve pas l&apos;origine est présumé venir
              d&apos;une autre institution — ce qui bloque le calcul des droits CELI. Après
              en avoir parlé au client, tranchez : le calcul se met à jour aussitôt.
            </p>
            {douteux.length === 0 ? (
              <p className="text-sm text-text-muted">
                Aucun transfert douteux — les droits CELI sont calculables si les autres
                conditions sont réunies.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {douteux.map((t) => (
                  <li key={t.cle} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="tabular-nums text-text-muted">{t.date}</span>
                    <strong className="tabular-nums text-text-main">{argent(t.montant)}</strong>
                    <code className="font-mono text-xs text-text-muted">{t.compte}</code>
                    {t.note && <span className="truncate text-xs text-text-muted">« {t.note} »</span>}
                    <div className="ml-auto flex items-center gap-2">
                      {t.resolution ? (
                        <span className={t.resolution === 'interne' ? 'text-emerald-700' : 'text-amber-700'}>
                          {t.resolution === 'interne' ? 'interne confirmé' : 'externe confirmé'}
                          {t.dateConfirmation ? ` · ${t.dateConfirmation}` : ''}
                        </span>
                      ) : null}
                      <Button variant="secondary" onClick={() => resoudre(t, 'interne')}>
                        <Check className="h-3.5 w-3.5" /> Interne
                      </Button>
                      <Button variant="secondary" onClick={() => resoudre(t, 'externe')}>
                        <X className="h-3.5 w-3.5" /> Externe
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ── Ce que le moteur a dérivé, client par client ───────────────── */}
      {profils.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-text-main">Ce que le moteur a dérivé</h2>
          {profils.map((p) => (
            <article key={p.id} className="rounded-lg border border-gray-200 bg-white">
              <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
                <span className="font-semibold text-text-main">{p.nom ?? '(nom inconnu)'}</span>
                <code className="font-mono text-xs text-text-muted">{p.id}</code>
                <span className="ml-auto text-xs text-text-muted">
                  version {p.version} · {p.dateMiseAJour}
                </span>
                <Button variant="secondary" onClick={() => { setIdCourant(p.id); void chargerTransferts(p.id); }}>
                  Transferts
                </Button>
              </header>

              {!p.celi || p.celi.nbLignes === 0 ? (
                <p className="px-4 py-3 text-sm text-text-muted">
                  Aucune ligne de compte CELI dans l&apos;historique importé.
                </p>
              ) : (
                <div className="space-y-3 px-4 py-3 text-sm">
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Cotisations CELI (argent neuf)</span>
                      <strong className="tabular-nums text-text-main">{ouRien(p.celi.cotisationsTotales)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Apports en nature (écartés)</span>
                      <span className="tabular-nums text-text-muted">{ouRien(p.celi.apportsEnNature)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Retraits des années passées</span>
                      <strong className="tabular-nums text-text-main">{ouRien(p.celi.retraitsAnneesPassees)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Ouverture du CELI</span>
                      <strong className="tabular-nums text-text-main">{p.celi.dateOuverture ?? '—'}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Plafond théorique retenu</span>
                      <span className="tabular-nums text-text-muted">
                        {ouRien(p.celi.plafond)}
                        {p.celi.plafondDepuis ? ` (depuis ${p.celi.plafondDepuis})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-text-muted">Transferts entrants</span>
                      <span className="tabular-nums text-text-muted">
                        {p.celi.transfertsATrancher} à trancher · {p.celi.transfertsApparies} appariés
                      </span>
                    </div>
                  </div>

                  <div className={
                    p.celi.statut === 'calcule'
                      ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3'
                      : 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3'
                  }>
                    {p.celi.statut === 'calcule' ? (
                      <p className="text-emerald-900">
                        <strong>Droits CELI : {ouRien(p.celi.montant)}</strong>
                        <span className="ml-2 text-xs">calculé — les trois conditions sont réunies</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-amber-900">
                          <strong>Borne supérieure : {ouRien(p.celi.borne)}</strong>
                          <span className="ml-2 text-xs">
                            à confirmer — ce n&apos;est PAS le droit réel
                          </span>
                        </p>
                        <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                          {p.celi.motifs.map((m) => <li key={m}>{m}</li>)}
                        </ul>
                      </>
                    )}
                  </div>

                  {p.celi.plafondMaximalFauteDage && (
                    <p className="text-xs text-text-muted">
                      L&apos;âge du client est inconnu : le plafond cumulé part de 2009, soit le
                      maximum possible. Renseigner l&apos;âge resserrerait la borne.
                    </p>
                  )}
                </div>
              )}

              {/* ── Les comptes du relevé, et ce que la jointure a pu prouver ──
                  FRÈRE de la ternaire CELI, jamais dedans : un client sans
                  ligne CELI est justement celui dont tout est à demander. */}
              {p.comptes && p.comptes.comptes.length > 0 && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Wallet className="h-3.5 w-3.5" />
                    {p.comptes.comptes.length} compte{p.comptes.comptes.length > 1 ? 's' : ''} au
                    dernier relevé
                    {p.comptes.comptes[0]?.dateReleve ? ` · ${p.comptes.comptes[0].dateReleve}` : ''}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {p.comptes.comptes.map((c) => {
                      const vm = c.positions.reduce((s, x) => s + (x.valeurMarchande ?? 0), 0)
                        + c.encaisse.reduce((s, x) => s + x.montant, 0);
                      const prouve = c.provenanceNumero === 'livre' || c.provenanceNumero === 'confirme';
                      return (
                        <li key={c.suffixe} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-mono text-text-main">
                            {c.numero ?? `…-${c.suffixe}`}
                          </span>
                          <span className="text-text-muted">{c.type ?? 'régime inconnu'}</span>
                          <span className="tabular-nums text-text-main">{argent(vm)}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] ${
                              prouve ? TON.auto : TON.manquant
                            }`}
                            title={c.candidats.length > 1 ? c.candidats.join(' · ') : undefined}
                          >
                            {MOT_PROVENANCE[c.provenanceNumero]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* ── LES STRATÉGIES À PRÉSENTER ─────────────────────────────
                  RIEN N'EST COCHÉ PAR DÉFAUT. Le moteur détecte, le
                  planificateur décide : une piste juste sur papier peut être
                  inopportune en rencontre pour des raisons que le moteur ne
                  connaît pas. Seules les cases cochées entrent dans le PDF. */}
              {(p.constats ?? []).length > 0 && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-text-main">
                      <ListChecks className="h-3.5 w-3.5" />
                      Stratégies à présenter au client
                    </p>
                    <span className="text-xs text-text-muted">
                      {(p.selection?.strategies ?? []).length} retenue
                      {(p.selection?.strategies ?? []).length > 1 ? 's' : ''} sur {(p.constats ?? []).length}
                      {p.selection?.dateSelection ? ` · choisi le ${p.selection.dateSelection}` : ''}
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1.5">
                    {(p.constats ?? []).map((c) => {
                      const coche = (p.selection?.strategies ?? []).includes(c.strategie);
                      const ton = TON_CONSTAT[c.statut];
                      return (
                        <li key={c.strategie}>
                          <label
                            className={`flex cursor-pointer gap-2 rounded border px-2.5 py-2 ${ton.classe} ${
                              coche ? 'ring-1 ring-brand-primary' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={coche}
                              onChange={() => void basculerStrategie(p, c.strategie)}
                              className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-medium text-text-main">{c.titre}</span>
                                <span className="text-[11px] uppercase text-text-muted">{ton.mot}</span>
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
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  {(p.selection?.strategies ?? []).length === 0 && (
                    <p className="mt-2 text-xs text-text-muted">
                      Aucune case cochée : la section « Optimisations fiscales » n&apos;apparaîtra pas
                      dans le PDF.
                    </p>
                  )}
                </div>
              )}

              {/* ── D'où vient chaque champ, et ce qu'il reste à demander ── */}
              {(p.badges ?? []).length > 0 && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <p className="text-xs text-text-muted">
                    {p.compteurs?.auto ?? 0} automatiques · {p.compteurs?.manuel ?? 0} saisis ·{' '}
                    {p.compteurs?.manquant ?? 0} manquants
                    {p.compteurs?.aReconfirmer ? ` · ${p.compteurs.aReconfirmer} à reconfirmer` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(p.badges ?? []).map((b) => (
                      <span
                        key={b.champ}
                        title={b.date ?? undefined}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${TON[b.couleur]} ${
                          b.aReconfirmer ? 'border-amber-400' : ''
                        }`}
                      >
                        {b.libelle}
                        {/* Déjà formatée par badges.ts — la reformater donnerait NaN. */}
                        {b.valeur && <span className="font-medium tabular-nums">{b.valeur}</span>}
                        {b.aReconfirmer && <RotateCcw className="h-3 w-3" />}
                      </span>
                    ))}
                  </div>

                  {(p.questions ?? []).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-text-main">À demander en rencontre</p>
                      <ol className="mt-1 list-inside list-decimal text-xs text-text-muted">
                        {(p.questions ?? []).map((q) => <li key={q}>{q}</li>)}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
