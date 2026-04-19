import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface HoldingInput {
  symbol: string;
  name: string;
  maturityDate?: string;
  couponRate?: number;
}

interface ExtractedMaturity {
  symbol: string;
  maturityDate: string;
  couponRate?: number;
}

const SYSTEM_PROMPT = `Tu es un expert en titres à revenu fixe canadiens. On te donne des descriptions de titres de revenu fixe provenant du système Croesus.

Ta tâche: extraire la DATE D'ÉCHÉANCE et le TAUX DE COUPON de chaque description.

FORMATS COURANTS dans Croesus:
- Les 6 derniers caractères de la description contiennent souvent la date: "16SP26" = 16 septembre 2026
- Codes de mois Croesus: JA=janvier, FE=février, MR=mars, AL=avril, MA=mai, JN=juin, JL=juillet, AU=août, SP=septembre, OC=octobre, NO=novembre, DE=décembre
- Le taux coupon apparaît souvent avant le % : "2.961%" ou "4,5%"
- Format ISO possible: "2028-06-01"
- Parfois juste l'année: "2034"

Exemples:
- "FORD CRED CB 2.961%16SP26" → maturityDate: "16 sep 2026", couponRate: 2.961
- "VIDEOTRON RED 4.5% 15JA30" → maturityDate: "15 jan 2030", couponRate: 4.5
- "LEVIS ICS   4.2%   23AU34" → maturityDate: "23 aoû 2034", couponRate: 4.2
- "COAST CAP 7.005%   28SP26" → maturityDate: "28 sep 2026", couponRate: 7.005
- "SEPT-ILES ICS 4.25% 8SP35" → maturityDate: "8 sep 2035", couponRate: 4.25
- "Canada 3,500% 2028-06-01"  → maturityDate: "2028-06-01", couponRate: 3.5
- "NB POWER 3.65% 27FE34"    → maturityDate: "27 fév 2034", couponRate: 3.65

IMPORTANT:
- Analyse CHAQUE description attentivement, surtout les 6 derniers caractères
- Si tu ne trouves PAS de date, NE PAS inventer — omets ce titre du résultat
- Le format de date retourné doit être: "DD mmm YYYY" (ex: "16 sep 2026") ou ISO "YYYY-MM-DD"
- Mois en format court français: jan, fév, mar, avr, mai, jun, jul, aoû, sep, oct, nov, déc

Retourne un JSON:
{
  "maturities": [
    { "symbol": "T482B6", "maturityDate": "16 sep 2026", "couponRate": 2.961 }
  ]
}

Si aucune date trouvée pour aucun titre: { "maturities": [] }`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ maturities: [] });
  }

  try {
    const { holdings } = (await req.json()) as { holdings: HoldingInput[] };
    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ maturities: [] });
    }

    const holdingsList = holdings.map(h => {
      let info = `${h.symbol} | Description: "${h.name}"`;
      if (h.maturityDate) info += ` | Date actuelle: ${h.maturityDate}`;
      if (h.couponRate) info += ` | Coupon actuel: ${h.couponRate}%`;
      return info;
    }).join('\n');

    const userPrompt = `Voici ${holdings.length} titres à revenu fixe à analyser. Extrais la date d'échéance et le coupon de CHAQUE description:\n\n${holdingsList}`;

    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 2000,
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
    if (!content) return NextResponse.json({ maturities: [] });

    const parsed = JSON.parse(content) as { maturities: ExtractedMaturity[] };
    const maturities = (parsed.maturities || []).filter(
      m => m.symbol && m.maturityDate && m.maturityDate.trim().length > 0
    );

    return NextResponse.json({ maturities });
  } catch (err) {
    console.warn('[AI extract-maturities] Failed:', err);
    return NextResponse.json({ maturities: [] });
  }
}
