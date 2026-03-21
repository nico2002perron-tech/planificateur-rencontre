import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface HoldingInput {
  symbol: string;
  name: string;
  assetType: string;
  modifiedDuration?: number;
  couponRate?: number;
  maturityDate?: string;
}

interface CorrectedHolding {
  symbol: string;
  assetType: string;
  reason?: string;
}

const SYSTEM_PROMPT = `Tu es un expert en classification de titres financiers canadiens.

On te donne une liste de positions d'un portefeuille avec leur type actuel (EQUITY, ETF, FIXED_INCOME, FUND, PREFERRED, CASH, OTHER).

Ta tâche: vérifier chaque classification et corriger les erreurs.

Règles:
- EQUITY: actions ordinaires cotées (ex: RY.TO = Banque Royale, MFC.TO = Manuvie, ENB.TO = Enbridge)
- ETF/FNB: fonds négociés en bourse (ex: XIC.TO = iShares TSX, ZAG.TO = BMO obligations)
- FIXED_INCOME: obligations, débentures, GIC, titres avec coupon/échéance/durée modifiée
- FUND: fonds communs de placement NON cotés (ex: Mackenzie Série F, Manuvie Fonds d'actions)
- PREFERRED: actions privilégiées (ex: BNS.PR.I, CM.PR.Q)
- CASH: liquidités, solde du compte, 1CAD, 1USD
- OTHER: tout ce qui ne rentre pas dans les catégories ci-dessus

IMPORTANT:
- Une compagnie d'assurance/banque (MFC, SLF, IAG, GWO) est EQUITY, PAS un FUND
- Un FNB (iShares, Vanguard, BMO ETF, Horizons) est ETF, PAS un FUND
- Un titre avec durée modifiée > 0 est FIXED_INCOME
- "SOLDE DU COMPTE" est toujours CASH

Retourne un JSON avec uniquement les positions qui doivent être CORRIGÉES:
{
  "corrections": [
    { "symbol": "MFC.TO", "assetType": "EQUITY", "reason": "Manulife Financial est une action, pas un fonds" }
  ]
}

Si tout est correct, retourne: { "corrections": [] }`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ corrections: [] });
  }

  try {
    const { holdings } = (await req.json()) as { holdings: HoldingInput[] };
    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ corrections: [] });
    }

    // Build concise prompt with holdings data
    const holdingsList = holdings.map(h => {
      let info = `${h.symbol} | ${h.name} | Type: ${h.assetType}`;
      if (h.modifiedDuration && h.modifiedDuration > 0) info += ` | Dur.mod: ${h.modifiedDuration}`;
      if (h.couponRate && h.couponRate > 0) info += ` | Coupon: ${h.couponRate}%`;
      if (h.maturityDate) info += ` | Éch: ${h.maturityDate}`;
      return info;
    }).join('\n');

    const userPrompt = `Voici les ${holdings.length} positions à vérifier:\n\n${holdingsList}`;

    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ corrections: [] });

    const parsed = JSON.parse(content) as { corrections: CorrectedHolding[] };
    const validTypes = ['EQUITY', 'ETF', 'FIXED_INCOME', 'FUND', 'PREFERRED', 'CASH', 'OTHER'];
    const corrections = (parsed.corrections || []).filter(
      c => c.symbol && validTypes.includes(c.assetType)
    );

    return NextResponse.json({ corrections });
  } catch (err) {
    console.warn('[AI classify] Failed:', err);
    return NextResponse.json({ corrections: [] });
  }
}
