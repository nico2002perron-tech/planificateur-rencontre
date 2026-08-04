'use client';

import { useCallback, useState } from 'react';
import { ClipboardPaste, Check, X, HelpCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type ProfilResume = { id: string; nom: string | null; version: number; dateMiseAJour: string };

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

export function EcranProfils({ profilsInitiaux }: { profilsInitiaux: ProfilResume[] }) {
  const [profils, setProfils] = useState(profilsInitiaux);
  const [nomClient, setNomClient] = useState('');
  const [colle, setColle] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resume, setResume] = useState<ResumeImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idCourant, setIdCourant] = useState<string | null>(null);
  const [douteux, setDouteux] = useState<TransfertDouteux[]>([]);
  const [apparies, setApparies] = useState(0);

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
      const liste = await fetch('/api/base-locale/profils').then((r) => r.json());
      setProfils(liste.profils ?? []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setEnCours(false);
    }
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
    if (res.ok) await chargerTransferts(idCourant);
  }

  const aTrancher = douteux.filter((t) => t.resolution === null).length;

  return (
    <div className="space-y-6">
      {/* ── Import de l'historique complet ─────────────────────────────── */}
      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ClipboardPaste className="h-4 w-4 text-primary" />
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
            className="w-full max-w-sm rounded-lg border border-border bg-bg-light px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-border bg-bg-light px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={importer} disabled={enCours}>
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {enCours ? 'Import en cours…' : 'Importer'}
            </Button>
            {erreur && <span className="text-sm text-red-600">{erreur}</span>}
          </div>

          {resume && (
            <div className="rounded-lg border border-border bg-bg-light px-4 py-3 text-sm">
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
        <section className="rounded-lg border border-border bg-surface">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <HelpCircle className="h-4 w-4 text-primary" />
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

      {/* ── Les profils existants ──────────────────────────────────────── */}
      {profils.length > 0 && (
        <section className="rounded-lg border border-border bg-surface">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-text-main">Profils enregistrés</h2>
          </header>
          <ul className="divide-y divide-border">
            {profils.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <code className="font-mono text-xs text-text-muted">{p.id}</code>
                <span className="font-medium text-text-main">{p.nom ?? '(nom inconnu)'}</span>
                <span className="ml-auto text-xs text-text-muted">
                  version {p.version} · {p.dateMiseAJour}
                </span>
                <Button variant="secondary" onClick={() => { setIdCourant(p.id); void chargerTransferts(p.id); }}>
                  Transferts
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
