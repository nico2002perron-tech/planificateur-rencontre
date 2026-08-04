/**
 * Le dessin d'un terrain + son en-tête (« TERRAIN A »).
 *
 * Sert de titre à la colonne d'horaire de chaque terrain, sur les trois
 * surfaces web : console organisateur, page publique et mode TV. La géométrie
 * vient de `lib/tournament/terrains.ts` — la MÊME que celle de la feuille PDF,
 * pour que le terrain A soit reconnaissable partout.
 */
import type { CSSProperties } from 'react';
import {
  schemaTerrain, accentTerrain, nomTerrain, libelleSport,
  type SportId, type Forme, type RoleForme,
} from '@/lib/tournament/terrains';

type Variante = 'clair' | 'sombre';

/** Couleurs par rôle — l'accent du terrain teinte la surface de jeu. */
function palette(variante: Variante, accent: string, pale: string): Record<RoleForme, { fill: string; stroke: string; w: number }> {
  return variante === 'sombre'
    ? {
        surface: { fill: 'rgba(255,255,255,0.10)', stroke: accent, w: 1.2 },
        zone: { fill: 'rgba(255,255,255,0.16)', stroke: 'none', w: 0 },
        trait: { fill: 'none', stroke: 'rgba(255,255,255,0.5)', w: 0.9 },
        filet: { fill: 'none', stroke: 'rgba(255,255,255,0.85)', w: 1.6 },
        objet: { fill: 'rgba(255,255,255,0.9)', stroke: 'none', w: 0 },
      }
    : {
        surface: { fill: pale, stroke: accent, w: 1.2 },
        zone: { fill: 'rgba(15,42,74,0.09)', stroke: 'none', w: 0 },
        trait: { fill: 'none', stroke: 'rgba(15,42,74,0.35)', w: 0.9 },
        filet: { fill: 'none', stroke: 'rgba(15,42,74,0.6)', w: 1.6 },
        objet: { fill: 'rgba(15,42,74,0.55)', stroke: 'none', w: 0 },
      };
}

function FormeSvg({ f, p }: { f: Forme; p: ReturnType<typeof palette> }) {
  const c = p[f.role];
  const commun = {
    fill: c.fill,
    stroke: c.stroke,
    strokeWidth: c.w,
    strokeLinejoin: 'round' as const,
    ...(f.forme === 'ligne' && f.tirets ? { strokeDasharray: '2.5 2' } : {}),
  };
  switch (f.forme) {
    case 'rect':
      return <rect x={f.x} y={f.y} width={f.l} height={f.h} rx={f.r ?? 0} {...commun} />;
    case 'ligne':
      return (
        <line
          x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
          fill="none"
          stroke={c.stroke === 'none' ? c.fill : c.stroke}
          strokeWidth={c.w || 1}
          strokeLinecap="round"
          {...(f.tirets ? { strokeDasharray: '2.5 2' } : {})}
        />
      );
    case 'cercle':
      return <circle cx={f.cx} cy={f.cy} r={f.r} {...commun} />;
    case 'chemin':
      return <path d={f.d} {...commun} />;
  }
}

/** Le terrain seul, sans texte — s'étire à la largeur qu'on lui donne. */
export function DessinTerrain({
  sport, court, variante = 'clair', className, style,
}: {
  sport: SportId;
  court: number;
  variante?: Variante;
  className?: string;
  style?: CSSProperties;
}) {
  const schema = schemaTerrain(sport);
  const accent = accentTerrain(court);
  const p = palette(variante, accent.base, accent.pale);
  return (
    <svg
      viewBox={`0 0 ${schema.largeur} ${schema.hauteur}`}
      className={className}
      style={style}
      role="img"
      aria-label={`${nomTerrain(court)} — ${libelleSport(sport)}`}>
      {schema.formes.map((f, i) => <FormeSvg key={i} f={f} p={p} />)}
    </svg>
  );
}

/**
 * L'en-tête complet d'une colonne : le dessin, le nom du terrain, et une ligne
 * de contexte (sport, nombre de parties…).
 */
export default function SchemaTerrain({
  sport, court, sousTitre, variante = 'clair', compact = false,
}: {
  sport: SportId;
  court: number;
  sousTitre?: string;
  variante?: Variante;
  /** Version resserrée pour les écrans étroits. */
  compact?: boolean;
}) {
  const accent = accentTerrain(court);
  const sombre = variante === 'sombre';
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        backgroundColor: sombre ? 'rgba(255,255,255,0.06)' : accent.pale,
        border: `2px solid ${sombre ? 'rgba(255,255,255,0.18)' : `${accent.base}55`}`,
      }}>
      <DessinTerrain
        sport={sport}
        court={court}
        variante={variante}
        style={{ width: compact ? 52 : 66, height: 'auto', flexShrink: 0 }}
      />
      <div className="min-w-0">
        <p
          className={`font-extrabold leading-tight ${compact ? 'text-sm' : 'text-base'}`}
          style={{ color: sombre ? '#ffffff' : accent.fonce }}>
          {nomTerrain(court)}
        </p>
        {sousTitre && (
          <p
            className="text-[11px] font-bold leading-tight mt-0.5 truncate"
            style={{ color: sombre ? 'rgba(255,255,255,0.65)' : `${accent.fonce}b0` }}>
            {sousTitre}
          </p>
        )}
      </div>
    </div>
  );
}
