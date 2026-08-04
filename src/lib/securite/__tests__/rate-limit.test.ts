import { describe, it, expect } from "vitest";
import { limiter } from "@/lib/securite/rate-limit";

describe("limiter — fenêtre glissante en mémoire", () => {
  it("autorise jusqu'à `max`, puis bloque", () => {
    const t = 1000;
    expect(limiter("k1", 3, 1000, t).ok).toBe(true);
    expect(limiter("k1", 3, 1000, t).ok).toBe(true);
    expect(limiter("k1", 3, 1000, t).ok).toBe(true);
    expect(limiter("k1", 3, 1000, t).ok).toBe(false); // 4e refusé
  });

  it("réinitialise après la fenêtre", () => {
    expect(limiter("k2", 1, 1000, 5000).ok).toBe(true);
    expect(limiter("k2", 1, 1000, 5000).ok).toBe(false);
    expect(limiter("k2", 1, 1000, 6500).ok).toBe(true); // nouvelle fenêtre
  });
});
