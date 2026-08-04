import type { Metadata } from "next";
import type { ReactNode, CSSProperties } from "react";
import { AVIS_PUBLIC } from "@/lib/analyse/textes";
import "./analyse.css";

export const metadata: Metadata = {
  title: "Analyse de portefeuille | Groupe Financier Ste-Foy",
  description:
    "Un regard clair et gratuit sur les frais, la concentration et la diversification de votre portefeuille.",
  robots: { index: false, follow: false },
};

const shell: CSSProperties = { minHeight: "100vh", display: "flex", flexDirection: "column" };

export default function AnalyseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="an-scope an-bg" style={shell}>
      <header
        className="an-glass"
        style={{ position: "sticky", top: 0, zIndex: 30, borderTop: "none", borderLeft: "none", borderRight: "none", borderBottom: "1px solid rgba(3,4,94,.07)" }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{ height: 38, width: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, background: "linear-gradient(135deg, var(--navy), var(--cyan))", boxShadow: "0 6px 16px rgba(0,119,182,.35)" }}
            >
              GF
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>
                Groupe Financier Ste-Foy
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Analyse de portefeuille</div>
            </div>
          </div>
          <span className="an-eyebrow" style={{ color: "var(--mid)", background: "rgba(0,180,216,.1)", padding: "6px 14px", borderRadius: 999 }}>
            Outil gratuit
          </span>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ marginTop: 44, borderTop: "1px solid rgba(3,4,94,.08)", background: "rgba(255,255,255,.5)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 20px", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: "var(--ink)" }}>Avis important.</strong> {AVIS_PUBLIC}
          </p>
          <p style={{ margin: 0 }}>
            Groupe Financier Ste-Foy — pour une évaluation adaptée à votre situation, consultez un conseiller.
          </p>
        </div>
      </footer>
    </div>
  );
}
