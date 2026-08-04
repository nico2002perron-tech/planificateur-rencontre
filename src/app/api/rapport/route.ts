import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { RapportDiagnostic } from "@/lib/pdf/rapport-diagnostic";
import { diagnosticDemo } from "@/app/analyse/demo";
import { verifierLimite } from "@/lib/securite/rate-limit";
import type { Diagnostic } from "@/types/diagnostic";

// PDF public à téléchargement DIRECT (aucun courriel, aucun consentement requis).
// GET ?demo=1 → rapport d'exemple. POST { diagnostic } → rapport du diagnostic fourni.

function dateFr(): string {
  return new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
}

async function streamerPdf(diagnostic: Diagnostic): Promise<NextResponse> {
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(RapportDiagnostic, { diagnostic, date: dateFr() }) as any,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="analyse-portefeuille-gfsf.pdf"',
      "Content-Length": String(buffer.length),
    },
  });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("demo")) {
    return streamerPdf(diagnosticDemo());
  }
  return NextResponse.json({ erreur: "Fournir un diagnostic via POST." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const bloque = verifierLimite(request, "rapport", 10);
  if (bloque) return bloque;

  let body: { diagnostic?: Diagnostic };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }
  const diagnostic = body?.diagnostic;
  if (!diagnostic || !Array.isArray(diagnostic.axes)) {
    return NextResponse.json({ erreur: "Diagnostic manquant." }, { status: 400 });
  }
  return streamerPdf(diagnostic);
}
