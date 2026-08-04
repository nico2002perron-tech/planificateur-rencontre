// Schémas Zod — chaque payload d'API publique est validé AVANT traitement.
// Les routes tournent avec la clé service-role (bypass RLS) : la validation ici est
// la vraie ligne de défense.

import { z } from "zod";
import { LIMITE_POSITIONS } from "@/config/constantes";

export const typeCompteSchema = z.enum([
  "celi",
  "reer",
  "cri",
  "non_enregistre",
  "societe",
]);

export const positionSchema = z.object({
  code: z.string().trim().min(1).max(20),
  montant: z.number().positive().max(1_000_000_000),
  typeCompte: typeCompteSchema.optional(),
});

export const diagnosticInputSchema = z.object({
  positions: z.array(positionSchema).min(1).max(LIMITE_POSITIONS),
  trancheAge: z.string().max(20).optional(),
  sourceUtm: z.string().max(80).optional(),
});

export type DiagnosticInput = z.infer<typeof diagnosticInputSchema>;

// Transmission au conseiller — le consentement DOIT être true (rejet sinon).
export const transmissionSchema = z.object({
  diagnosticId: z.string().uuid().optional(),
  prenom: z.string().trim().min(1).max(100),
  nom: z.string().trim().min(1).max(100),
  courriel: z.string().trim().email().max(200),
  telephone: z.string().trim().max(30).optional(),
  consentement: z.literal(true),
});

export type TransmissionInput = z.infer<typeof transmissionSchema>;
