"use client";

import { useEffect, useState } from "react";

/** Compteur qui monte de 0 à `valeur` à l'entrée (respecte prefers-reduced-motion). */
export function CompteurAnime({
  valeur,
  duree = 1100,
  format,
}: {
  valeur: number;
  duree?: number;
  format?: (n: number) => string;
}) {
  const [v, setV] = useState(0);

  useEffect(() => {
    const reduit =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit) {
      setV(valeur);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duree);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(valeur * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valeur, duree]);

  return <>{format ? format(v) : Math.round(v).toLocaleString("fr-CA")}</>;
}
