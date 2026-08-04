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
    include: ["src/**/*.test.ts", "scripts/**/*.test.{ts,mjs}"],
  },
});
