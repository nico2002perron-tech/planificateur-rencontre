import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Le moteur est du TypeScript pur (aucun DOM/React) → environnement Node.
// On réplique l'alias @ du tsconfig pour que les tests importent comme le reste du repo.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.{ts,mjs}"],
  },
});
