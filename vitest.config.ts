import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Le moteur est du TypeScript pur (aucun DOM/React) → environnement Node.
// On réplique l'alias @ du tsconfig pour que les tests importent comme le reste du repo.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` refuse d'être chargé hors d'un composant serveur — c'est
      // exactement son rôle, et il bloque donc aussi Vitest. On le neutralise
      // pour les tests seulement : la garde reste entière dans l'application.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `.tsx` ADMIS depuis le 5 août 2026, pour UN cas précis : les pages PDF.
    // @react-pdf/renderer rend en Node — `renderToBuffer` produit un vrai PDF
    // dont on peut relire le texte, sans jsdom. C'est le seul moyen de vérifier
    // CE QUI ATTEINT LE CLIENT plutôt que la forme du JSX.
    //
    // Ça ne rend PAS les composants d'écran testables : ceux-là ont besoin d'un
    // DOM, et l'environnement reste `node`. La règle tient toujours — la
    // logique de calcul vit dans un `.ts` pur.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
  },
});
