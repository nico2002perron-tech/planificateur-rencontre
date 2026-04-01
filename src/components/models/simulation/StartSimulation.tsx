'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { DollarSign } from 'lucide-react';
import { fmtMoney } from './constants';

export function StartSimulation({ modelId, modelName, onStarted }: { modelId: string; modelName: string; onStarted: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(100000);
  const [currency, setCurrency] = useState('CAD');
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (amount < 1000) { toast('warning', 'Le montant minimum est de 1 000$'); return; }
    setStarting(true);
    try {
      const res = await fetch(`/api/models/${modelId}/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_value: amount, currency }),
      });
      const data = await res.json();
      if (!res.ok) { toast('error', data.error || 'Erreur'); return; }
      toast('success', `Simulation démarrée avec ${data.holdings_count} positions`);
      onStarted();
    } catch { toast('error', 'Erreur lors du démarrage'); }
    finally { setStarting(false); }
  }

  const presets = [25000, 50000, 100000, 250000, 500000, 1000000];

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-extrabold text-text-main mb-2">Prêt à simuler?</h2>
        <p className="text-text-muted max-w-md mx-auto">
          Suivez <strong>{modelName}</strong> comme un vrai portefeuille avec des prix réels du marché.
        </p>
      </div>

      <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-8" style={{ boxShadow: '0 4px 0 0 #e5e7eb' }}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">Montant initial</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
              <input
                type="number" min={1000} step={1000} value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-12 pr-16 py-4 rounded-2xl border-[3px] border-gray-200 text-2xl font-extrabold text-text-main focus:border-[#58CC02] focus:ring-4 focus:ring-[#58CC02]/10 focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-text-muted">{currency}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    amount === p
                      ? 'bg-[#58CC02] text-white shadow-md'
                      : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                  }`}
                  style={amount === p ? { boxShadow: '0 3px 0 0 #46a302' } : {}}
                >{fmtMoney(p)}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-main mb-2">Devise</label>
            <div className="flex gap-3">
              {['CAD', 'USD'].map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className={`flex-1 py-3 rounded-2xl border-[3px] text-sm font-bold transition-all ${
                    currency === c
                      ? 'border-[#1CB0F6] bg-[#1CB0F6]/5 text-[#1CB0F6]'
                      : 'border-gray-200 text-text-muted hover:border-gray-300'
                  }`}
                >{c === 'CAD' ? '🇨🇦 Dollar canadien' : '🇺🇸 Dollar américain'}</button>
              ))}
            </div>
          </div>

          <div className="bg-[#1CB0F6]/10 border-2 border-[#1CB0F6]/20 rounded-2xl p-4">
            <p className="text-xs text-[#0a7fad] leading-relaxed font-medium">
              <strong>💡 Comment ça marche :</strong> Les prix du marché sont gelés comme prix d&apos;achat.
              Ensuite, les prix se mettent à jour en temps réel pour suivre la vraie performance.
            </p>
          </div>

          <button onClick={handleStart} disabled={starting}
            className="w-full py-4 rounded-2xl border-[3px] border-b-[5px] border-[#58CC02] bg-[#58CC02] text-white text-base font-extrabold uppercase tracking-wide hover:bg-[#4db802] active:border-b-[3px] active:mt-[2px] transition-all disabled:opacity-60"
            style={{ boxShadow: 'none' }}
          >
            {starting ? 'Démarrage...' : `🚀 C'est parti! — ${fmtMoney(amount, currency)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
