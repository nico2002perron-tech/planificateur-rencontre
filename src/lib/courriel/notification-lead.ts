// Notification interne : « Nouvelle analyse transmise ». Envoyée à Nicolas.
// Dégrade silencieusement sans clé Resend (comme lib/email.ts) — jamais bloquant.

import "server-only";
import { Resend } from "resend";
import { COURRIEL_NOTIFICATION } from "@/config/constantes";

const FROM = process.env.EMAIL_FROM || "Groupe Financier Ste-Foy <onboarding@resend.dev>";

export async function notifierNouveauLead(lead: {
  prenom: string;
  nom: string;
  courriel: string;
  telephone?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // dev / pas de clé → no-op

  const resend = new Resend(key);
  const tel = lead.telephone
    ? `<p style="margin:4px 0;color:#334155;font-size:14px">Téléphone : <strong>${lead.telephone}</strong></p>`
    : "";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#03045e;font-size:19px;margin:0 0 12px">Nouvelle analyse transmise</h2>
      <p style="margin:0 0 12px;color:#475569;font-size:15px">Un visiteur a transmis son analyse de portefeuille et consent à être contacté :</p>
      <div style="background:#f8fafc;border:1px solid #e7edf3;border-radius:12px;padding:16px">
        <p style="margin:4px 0;color:#334155;font-size:14px">Nom : <strong>${lead.prenom} ${lead.nom}</strong></p>
        <p style="margin:4px 0;color:#334155;font-size:14px">Courriel : <strong>${lead.courriel}</strong></p>
        ${tel}
      </div>
      <p style="margin:14px 0 0;color:#94a3b8;font-size:12px">Le détail de son portefeuille est disponible dans « Analyses reçues ».</p>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: COURRIEL_NOTIFICATION,
      subject: `Nouvelle analyse transmise — ${lead.prenom} ${lead.nom}`,
      html,
    });
  } catch (err) {
    console.error("notifierNouveauLead:", err);
  }
}
