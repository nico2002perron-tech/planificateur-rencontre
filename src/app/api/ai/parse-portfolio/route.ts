import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/config';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Tu es un expert en analyse de données financières. On te donne un texte brut contenant des positions de portefeuille d'investissement. Le format peut varier (Excel copié, CSV, relevé bancaire, liste de titres, etc.).

Ta tâche: extraire les positions et retourner un JSON structuré.

Pour chaque position, essaie d'identifier:
- symbol: le ticker/symbole boursier (ex: AAPL, ENB.TO, RY.TO, XIC.TO)
- name: le nom descriptif du titre (si disponible)
- quantity: le nombre d'unités/actions (si disponible, sinon 0)
- marketPrice: le prix unitaire actuel (si disponible, sinon 0)
- averageCost: le prix d'achat moyen / coût unitaire (si disponible, sinon 0)
- currency: la devise (CAD ou USD, défaut CAD)
- assetType: le type d'actif parmi EQUITY, ETF, FIXED_INCOME, FUND, PREFERRED, CASH, OTHER

Règles:
- Pour les titres canadiens, ajoute .TO si ce n'est pas déjà fait (ex: ENB → ENB.TO, RY → RY.TO)
- Pour les titres américains, pas de suffixe (ex: AAPL, MSFT)
- Les ETF (iShares, Vanguard, BMO, etc.) sont de type ETF
- Les fonds communs (Mackenzie, Manuvie, Fidelity série) sont de type FUND
- Les obligations/GIC sont de type FIXED_INCOME
- Les actions sont de type EQUITY
- Utilise le contexte des en-têtes de colonnes pour identifier les données

Retourne un JSON avec cette structure exacte:
{
  "holdings": [
    { "symbol": "ENB.TO", "name": "Enbridge Inc", "quantity": 100, "marketPrice": 55.20, "averageCost": 48.50, "currency": "CAD", "assetType": "EQUITY" }
  ],
  "detectedColumns": ["symbol", "name", "quantity", "price"]
}

Si tu ne peux extraire aucune position valide, retourne: { "holdings": [], "detectedColumns": [] }`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ holdings: [], detectedColumns: [], error: 'Groq API key not configured' });
  }

  try {
    const { rawText } = (await req.json()) as { rawText: string };
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ holdings: [], detectedColumns: [] });
    }

    // Limit input to first 100 lines to avoid token overflow
    const truncated = rawText.split('\n').slice(0, 100).join('\n');

    const groq = new Groq({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Voici les données brutes du portefeuille à analyser:\n\n${truncated}` },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ holdings: [], detectedColumns: [] });

    const parsed = JSON.parse(content) as {
      holdings: Array<{
        symbol: string;
        name?: string;
        quantity?: number;
        marketPrice?: number;
        averageCost?: number;
        currency?: string;
        assetType?: string;
      }>;
      detectedColumns?: string[];
    };

    const validTypes = ['EQUITY', 'ETF', 'FIXED_INCOME', 'FUND', 'PREFERRED', 'CASH', 'OTHER'];
    const holdings = (parsed.holdings || [])
      .filter(h => h.symbol && h.symbol.trim().length > 0)
      .map(h => ({
        ...h,
        symbol: h.symbol.trim().toUpperCase(),
        assetType: validTypes.includes(h.assetType || '') ? h.assetType : 'EQUITY',
      }));

    return NextResponse.json({
      holdings,
      detectedColumns: parsed.detectedColumns || [],
    });
  } catch (err) {
    console.warn('[AI parse-portfolio] Failed:', err);
    return NextResponse.json({ holdings: [], detectedColumns: [], error: 'AI parsing failed' });
  }
}
