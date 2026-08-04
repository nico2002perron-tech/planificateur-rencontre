import type { CSSProperties } from "react";
import Link from "next/link";
import { Wallet, Sparkles, HandCoins } from "lucide-react";
import { SaisiePortefeuille } from "./composants/SaisiePortefeuille";

const ETAPES = [
  { icon: Wallet, tint: "var(--a-frais-bg)", color: "var(--a-frais)", t: "Vos fonds", d: "Entrez vos fonds ou FNB et les montants. Rien d'autre." },
  { icon: Sparkles, tint: "var(--a-chev-bg)", color: "var(--a-chev)", t: "Nos constats", d: "Frais, concentration et diversification, calculés à l'instant." },
  { icon: HandCoins, tint: "var(--a-geo-bg)", color: "var(--a-geo)", t: "Votre choix", d: "Gardez le rapport, ou parlez-en à un conseiller. Vous décidez." },
];

export default function AnalysePage() {
  return (
    <div>
      {/* Héros */}
      <section style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #03045e 0%, #023e8a 52%, #0077b6 100%)" }}>
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, background: "radial-gradient(720px 340px at 80% -12%, rgba(0,180,216,.55), transparent 60%), radial-gradient(600px 320px at 6% 125%, rgba(124,92,255,.38), transparent 60%)" }}
        />
        <div style={{ position: "relative", maxWidth: 1040, margin: "0 auto", padding: "66px 20px 104px", textAlign: "center" }}>
          <p className="an-eyebrow an-fadeup" style={{ color: "#8fe3f5", marginBottom: 14 }}>
            ● Groupe Financier Ste-Foy
          </p>
          <h1
            className="an-fadeup"
            style={{ "--d": "60ms", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(30px,5.4vw,50px)", lineHeight: 1.06, letterSpacing: "-.02em", color: "#fff", margin: "0 auto 18px", maxWidth: 720, textWrap: "balance" } as CSSProperties}
          >
            Votre portefeuille,
            <br />
            <span style={{ color: "#9fe9f8" }}>enfin au clair.</span>
          </h1>
          <p
            className="an-fadeup"
            style={{ "--d": "120ms", fontSize: 18, lineHeight: 1.55, color: "rgba(255,255,255,.84)", maxWidth: 560, margin: "0 auto" } as CSSProperties}
          >
            En deux minutes, un regard indépendant sur ce que vous payez en frais, votre concentration et votre
            diversification. Des constats — pas de jargon, pas d'engagement.
          </p>
        </div>
      </section>

      {/* Formulaire flottant */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>
        <div className="an-fadeup" style={{ "--d": "180ms", marginTop: -68 } as CSSProperties}>
          <SaisiePortefeuille />
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link href="/analyse/resultats?demo=1" style={{ fontSize: 14, fontWeight: 600, color: "var(--mid)" }}>
              Voir un exemple de rapport →
            </Link>
          </div>
        </div>
      </section>

      {/* Étapes */}
      <section style={{ maxWidth: 1000, margin: "56px auto 8px", padding: "0 20px" }}>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {ETAPES.map((e, i) => {
            const Icone = e.icon;
            return (
              <div key={e.t} className="an-card lift an-fadeup" style={{ "--d": `${240 + i * 80}ms`, padding: 22 } as CSSProperties}>
                <div className="an-chip" style={{ background: e.tint, color: e.color, marginBottom: 14 }}>
                  <Icone size={22} />
                </div>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "var(--navy)", margin: "0 0 5px" }}>{e.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", margin: 0 }}>{e.d}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
