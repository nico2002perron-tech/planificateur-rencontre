/**
 * L'horaire d'une journée : les terrains dessinés en bandeau, et DESSOUS une
 * seule grille — une colonne d'heures à gauche, une colonne par terrain.
 *
 * Les heures ne sont écrites qu'une fois : c'est la grille elle-même qui
 * garantit que 10:05 du terrain A et 10:05 du terrain B sont sur la même
 * ligne, et qu'un terrain sans partie à cette heure montre un trou « Libre ».
 *
 * Partagé par la console organisateur et la page publique : chacune passe sa
 * propre carte de partie (`rendreCase`), la mise en page reste commune.
 */
import { Fragment, type ReactNode } from 'react';
import SchemaTerrain from './SchemaTerrain';
import { LIBELLE_CASE_LIBRE, type GrilleTerrains, type SportId } from '@/lib/tournament/terrains';

export default function GrilleHoraire<M extends { id: string }>({
  grille,
  sport,
  rendreCase,
  largeurHeures = 46,
}: {
  grille: GrilleTerrains<M>;
  sport: SportId;
  /** La carte d'une partie, dessinée par la page appelante. */
  rendreCase: (partie: M, terrain: number) => ReactNode;
  largeurHeures?: number;
}) {
  const colonnes = `${largeurHeures}px repeat(${grille.colonnes.length}, minmax(0, 1fr))`;
  return (
    <div className="grid gap-x-2 gap-y-1.5 items-start" style={{ gridTemplateColumns: colonnes }}>
      {/* Bandeau : le coin des heures reste vide, puis un terrain par colonne */}
      <div aria-hidden />
      {grille.colonnes.map(col => (
        <SchemaTerrain
          key={`entete-${col.terrain}`}
          sport={sport}
          court={col.terrain}
          compact
          sousTitre={col.nbParties === 0
            ? 'Aucune partie'
            : `${col.nbParties} partie${col.nbParties > 1 ? 's' : ''}`}
        />
      ))}

      {/* Une ligne par heure, commune aux deux terrains */}
      {grille.heures.map((heure, iHeure) => (
        <Fragment key={heure}>
          <div className="pt-3 text-right">
            <span className="text-[11px] font-extrabold text-slate-400 tabular-nums">{heure}</span>
          </div>
          {grille.colonnes.map(col => (
            <div key={`${col.terrain}-${heure}`} className="min-w-0 space-y-1.5">
              {col.cases[iHeure].length === 0 ? (
                <div className="rounded-2xl px-2 py-4 text-center text-[11px] font-extrabold border-2 border-dashed border-slate-200 text-slate-300">
                  {LIBELLE_CASE_LIBRE}
                </div>
              ) : (
                col.cases[iHeure].map(partie => (
                  <Fragment key={partie.id}>{rendreCase(partie, col.terrain)}</Fragment>
                ))
              )}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
