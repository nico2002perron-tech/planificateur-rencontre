'use client';

// LE CHAMP DES PERTES EN CAPITAL REPORTÉES — extrait de `EcranFiscal.tsx` le
// 21 août 2026, sans une ligne de logique changée.
//
// POURQUOI SON PROPRE FICHIER : ses deux comportements les plus délicats — le
// refus qui doit survivre à un clic ailleurs, et l'écriture qui ne doit pas
// repartir d'un instantané périmé — ne se prouvent qu'en montant le composant
// et en jouant de VRAIS événements du navigateur. Importer `EcranFiscal.tsx`
// pour cela chargerait le générateur de PDF, la barre d'outils et la moitié de
// l'écran ; ici le test ne charge que ce qu'il éprouve.
//
// Le module PUR voisin (`pertes-reportees-champ.ts`) garde toutes les
// décisions. Ce fichier ne fait que les habiller et gérer l'état local.
import { useEffect, useRef, useState } from 'react';
import type { PertesCapitalReportees } from '@/lib/profils/types';
import {
  OPTIONS_UNITE, OPTIONS_SOURCE, AIDE_PRINCIPALE, AIDE_SOURCE,
  lireDepuisFiche, analyserMontantSaisi, analyserDateSaisie,
  fusionner, corpsPourApi, etatLisible,
} from './pertes-reportees-champ';

/**
 * LE CHAMP DES PERTES EN CAPITAL REPORTÉES — quatre réponses, pas un nombre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL REMPLACE (21 août 2026) : une simple ligne « Pertes en capital
 * reportées » avec un `ChampNombre`. On pouvait y taper 10 000 sans que
 * personne — ni le conseiller, ni le moteur — sache ce que ce 10 000 voulait
 * dire. Or il en existe deux versions incompatibles : la perte BRUTE, et la
 * perte NETTE de l'avis de cotisation, déjà au taux d'inclusion. Le moteur
 * additionnait ce nombre à des pertes brutes venues du relevé, puis comparait
 * le total à un gain latent brut.
 *
 * Le champ ne convertit rien et ne devine rien : il DEMANDE. Toute la logique
 * vit dans `pertes-reportees-champ.ts` — un module pur, testable sans DOM,
 * comme le veut la règle du dépôt.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ChampPertesReportees({ brut, onEcrire }: {
  brut: unknown;
  onEcrire: (v: PertesCapitalReportees) => Promise<void> | void;
}) {
  const depuisProfil = lireDepuisFiche(brut);

  // ── POURQUOI UN ÉTAT LOCAL PLUTÔT QUE LA PROP DIRECTEMENT ─────────────────
  //
  // Défaut trouvé par la revue adversariale du 21 août 2026, et il était
  // sérieux. Chaque écriture envoie les QUATRE champs (c'est le contrat de
  // l'API : un objet présent remplace, il ne fusionne pas). Tant que
  // l'aller-retour POST puis rechargement n'est pas revenu, la prop porte
  // encore l'ANCIENNE valeur — et un second geste construisait donc son envoi
  // sur un instantané périmé, écrasant la réponse précédente.
  //
  // Ce n'était même pas une simple course : le cas est DÉTERMINISTE. Taper une
  // date puis cliquer un bouton déclenche mousedown → blur → click. Le blur
  // envoie la date neuve ; le click, quelques millisecondes plus tard, repart
  // du même instantané et réécrit l'ANCIENNE date. Le conseiller voyait la
  // date qu'il venait de saisir reculer sous ses doigts.
  //
  // L'écran croit donc ce qu'il vient d'envoyer, et ne réaccepte la version du
  // dossier que lorsque plus aucune écriture n'est en vol.
  const [local, setLocal] = useState<PertesCapitalReportees>(depuisProfil);
  const enVol = useRef(0);
  const file = useRef<Promise<void>>(Promise.resolve());
  const signature = `${depuisProfil.montant}|${depuisProfil.unite}|${depuisProfil.source}|${depuisProfil.dateDonnee}`;
  useEffect(() => {
    if (enVol.current === 0) setLocal(depuisProfil);
    // `signature` résume les quatre champs : la prop est un objet neuf à chaque
    // rendu, elle ne peut pas servir de dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const [montantTexte, setMontantTexte] = useState(
    local.montant === null ? '' : String(local.montant)
  );
  const [dateTexte, setDateTexte] = useState(local.dateDonnee ?? '');

  // ── DEUX REFUS SÉPARÉS, ET AUCUN N'EST EFFACÉ PAR UN AUTRE GESTE ──────────
  //
  // Second défaut de la revue : un refus unique, remis à null par `ecrire`.
  // Le conseiller tapait « 12 00O » (avec un O), voyait le message rouge,
  // cliquait ensuite « Perte en capital brute » — et le message disparaissait
  // alors que la case affichait toujours « 12 00O » et que le dossier valait
  // encore l'ancien montant. Un refus effacé sans que la saisie soit corrigée,
  // c'est exactement le « le conseiller croyait avoir enregistré » que ce
  // champ existe pour supprimer.
  const [refusMontant, setRefusMontant] = useState<string | null>(null);
  const [refusDate, setRefusDate] = useState<string | null>(null);

  const [avanceeVisible, setAvanceeVisible] = useState(
    local.unite === 'montant-normalise-utilisable'
  );

  // Le dossier fait foi quand il change : la frappe locale ne survit pas à un
  // enregistrement, sinon l'écran mentirait sur ce qui est enregistré.
  useEffect(() => {
    setMontantTexte(local.montant === null ? '' : String(local.montant));
  }, [local.montant]);
  useEffect(() => {
    setDateTexte(local.dateDonnee ?? '');
  }, [local.dateDonnee]);

  const etat = etatLisible(local);
  // ⚠ ZÉRO COMPRIS. La première version masquait les qualifications quand le
  // montant valait 0 — au motif qu'un zéro n'a pas d'unité, ce qui est vrai.
  // Mais l'unité restait ALORS EN MÉMOIRE, invisible : passer 10 000 → 0 →
  // 10 000 faisait hériter le nouveau montant de la qualification de l'ancien,
  // sans que personne ne l'ait reconfirmée. Un état caché finit toujours par
  // resservir. On montre donc tout ce qui est au dossier.
  const aUnMontant = local.montant !== null;

  /**
   * ÉCRIT UNE DIMENSION — à partir de ce que l'écran sait, pas de ce que la
   * prop portait au dernier aller-retour.
   *
   * ⚠ NE TOUCHE À AUCUN REFUS : un refus appartient au champ qui l'a produit,
   * et seul ce champ, une fois relu correctement, a le droit de l'effacer.
   *
   * ── LES ÉCRITURES SONT MISES EN FILE ──────────────────────────────────────
   * Ajouté le 21 août 2026, en écrivant le test d'ordre d'arrivée. L'état local
   * garantissait déjà que la seconde écriture PORTE les deux réponses ; il ne
   * garantissait rien sur l'ordre où les deux requêtes ARRIVENT. Deux `fetch`
   * lancés à quelques millisecondes d'intervalle n'ont aucun ordre promis, et
   * si la première atteignait le serveur en dernier, elle y réécrivait un état
   * amputé de la seconde réponse — la réponse du conseiller disparaissait,
   * sans erreur, sans trace.
   *
   * La file rend l'ordre du réseau identique à l'ordre des gestes. Le coût est
   * nul en usage normal (une écriture à la fois), et c'est ce qui rend le cas
   * « la deuxième requête aboutit avant la première » structurellement
   * impossible plutôt que simplement improbable.
   */
  function ecrire(changement: Partial<PertesCapitalReportees>): Promise<void> {
    const suivant = fusionner(local, changement);
    setLocal(suivant);
    enVol.current += 1;
    const envoi = file.current
      // Un échec précédent ne doit pas condamner la file : on enchaîne dans les
      // deux cas. L'erreur, elle, est signalée par le parent.
      .then(() => onEcrire(corpsPourApi(suivant)), () => onEcrire(corpsPourApi(suivant)))
      .then(() => undefined)
      .finally(() => { enVol.current -= 1; });
    file.current = envoi.catch(() => undefined);
    return envoi;
  }

  return (
    <div className="border-b border-gray-100 py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-main">Pertes en capital inutilisées / reportées</span>
        <span className="ml-auto flex items-center gap-1">
          <input
            value={montantTexte}
            inputMode="decimal"
            aria-label="Pertes en capital inutilisées ou reportées, en dollars"
            aria-invalid={refusMontant !== null}
            onChange={(e) => setMontantTexte(e.target.value)}
            onBlur={() => {
              const lu = analyserMontantSaisi(montantTexte);
              if (!lu.ok) { setRefusMontant(lu.motif); return; }
              setRefusMontant(null);
              // ⚠ `null` (vide) EST une valeur : il efface. Il ne devient pas 0.
              if (lu.montant !== local.montant) void ecrire({ montant: lu.montant });
            }}
            className={`w-28 rounded border bg-white px-2 py-1 text-right text-sm tabular-nums ${
              refusMontant ? 'border-red-400' : 'border-gray-200'
            }`}
            placeholder="—"
          />
          <span className="text-xs text-text-muted">$</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">{AIDE_PRINCIPALE}</p>
      {refusMontant && <p className="mt-1 text-xs font-medium text-red-600">{refusMontant}</p>}

      {/* LES TROIS QUALIFICATIONS ne s'affichent qu'une fois un montant entré :
          demander le type d'un montant absent n'a pas de sens, et un dossier
          sans pertes reportées n'a pas à porter trois questions de plus. */}
      {aUnMontant && (
        <div className="mt-2 space-y-2 rounded border border-gray-100 bg-gray-50/60 p-2">
          <div>
            <span className="text-xs font-medium text-text-main">Type de montant</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {OPTIONS_UNITE.filter((o) => !o.avancee || avanceeVisible).map((o) => (
                <button
                  key={o.valeur}
                  type="button"
                  title={o.aide}
                  aria-pressed={local.unite === o.valeur}
                  onClick={() => void ecrire({ unite: o.valeur })}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    local.unite === o.valeur
                      ? 'border-brand-primary bg-brand-primary/10 font-medium text-brand-primary'
                      : 'border-gray-200 bg-white text-text-muted hover:border-gray-300'
                  }`}
                >
                  {o.libelle}
                </button>
              ))}
              {/* §12 — « déjà normalisé » affirme qu'un humain a fait la
                  conversion. Cette affirmation coûte un geste de plus. */}
              {!avanceeVisible && (
                <button
                  type="button"
                  onClick={() => setAvanceeVisible(true)}
                  className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-text-muted hover:border-gray-400"
                >
                  Autre…
                </button>
              )}
            </span>
            <p className="mt-1 text-xs text-text-muted">
              {OPTIONS_UNITE.find((o) => o.valeur === local.unite)?.aide}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium text-text-main">Source</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {OPTIONS_SOURCE.map((o) => (
                <button
                  key={o.valeur}
                  type="button"
                  aria-pressed={local.source === o.valeur}
                  onClick={() => void ecrire({ source: o.valeur })}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    local.source === o.valeur
                      ? 'border-brand-primary bg-brand-primary/10 font-medium text-brand-primary'
                      : 'border-gray-200 bg-white text-text-muted hover:border-gray-300'
                  }`}
                >
                  {o.libelle}
                </button>
              ))}
            </span>
            <p className="mt-1 text-xs text-text-muted">{AIDE_SOURCE}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-main">Date du document ou de la donnée</span>
            <input
              type="date"
              value={dateTexte}
              aria-label="Date du document ou de la donnée"
              aria-invalid={refusDate !== null}
              onChange={(e) => setDateTexte(e.target.value)}
              onBlur={() => {
                const lu = analyserDateSaisie(dateTexte);
                if (!lu.ok) { setRefusDate(lu.motif); return; }
                setRefusDate(null);
                if (lu.date !== local.dateDonnee) void ecrire({ dateDonnee: lu.date });
              }}
              className={`rounded border bg-white px-2 py-1 text-xs ${
                refusDate ? 'border-red-400' : 'border-gray-200'
              }`}
            />
          </div>
          {refusDate && <p className="text-xs font-medium text-red-600">{refusDate}</p>}

          <p className={`text-xs ${etat.chiffrable ? 'text-text-muted' : 'font-medium text-amber-700'}`}>
            {etat.phrase}
          </p>
        </div>
      )}
    </div>
  );
}
