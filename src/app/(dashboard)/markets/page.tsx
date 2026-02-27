'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { AdvancedChart } from '@/components/tradingview/AdvancedChart';
import { TechnicalAnalysis } from '@/components/tradingview/TechnicalAnalysis';
import { FundamentalData } from '@/components/tradingview/FundamentalData';
import { CompanyProfile } from '@/components/tradingview/CompanyProfile';
import { StockScreener } from '@/components/tradingview/StockScreener';
import { EconomicCalendar } from '@/components/tradingview/EconomicCalendar';
import { MiniChart } from '@/components/tradingview/MiniChart';
import { Search } from 'lucide-react';

const marketTabs = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'analysis', label: 'Analyse titre' },
  { id: 'screener', label: 'Screener' },
  { id: 'calendar', label: 'Calendrier' },
];

const majorIndices = [
  { symbol: 'TSX:TX60', label: 'S&P/TSX 60' },
  { symbol: 'FOREXCOM:SPXUSD', label: 'S&P 500' },
  { symbol: 'NASDAQ:NDX', label: 'NASDAQ 100' },
  { symbol: 'FX_IDC:USDCAD', label: 'USD/CAD' },
  { symbol: 'TVC:USOIL', label: 'Pétrole WTI' },
  { symbol: 'AMEX:GLD', label: 'Or' },
];

export default function MarketsPage() {
  const [searchSymbol, setSearchSymbol] = useState('TSX:RY');
  const [activeSymbol, setActiveSymbol] = useState('TSX:RY');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchSymbol.trim()) {
      setActiveSymbol(searchSymbol.trim().toUpperCase());
    }
  }

  return (
    <div>
      <PageHeader
        title="Marchés"
        description="Données de marché en temps réel via TradingView"
      />

      <Card padding="none">
        <Tabs tabs={marketTabs}>
          {(activeTab) => (
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {majorIndices.map((idx) => (
                      <div key={idx.symbol} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="px-3 pt-2 text-xs font-semibold text-text-muted">{idx.label}</div>
                        <MiniChart symbol={idx.symbol} height={180} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="font-semibold text-text-main mb-3">Graphique interactif</h3>
                    <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 500 }}>
                      <AdvancedChart symbol="TSX:TX60" height={500} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  <form onSubmit={handleSearch} className="flex gap-3 items-end max-w-lg">
                    <div className="flex-1">
                      <Input
                        label="Symbole TradingView"
                        placeholder="Ex: TSX:RY, NASDAQ:AAPL, TSX:ENB"
                        value={searchSymbol}
                        onChange={(e) => setSearchSymbol(e.target.value)}
                        hint="Format: EXCHANGE:SYMBOL (ex: TSX:TD, NASDAQ:MSFT)"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-brand-primary text-white rounded-full font-semibold text-sm hover:bg-brand-accent transition-colors flex items-center gap-2"
                    >
                      <Search className="h-4 w-4" />
                      Analyser
                    </button>
                  </form>

                  <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 500 }}>
                    <AdvancedChart symbol={activeSymbol} height={500} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-text-main mb-3">Analyse technique</h3>
                      <div className="rounded-xl overflow-hidden border border-gray-100">
                        <TechnicalAnalysis symbol={activeSymbol} height={425} />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-main mb-3">Profil entreprise</h3>
                      <div className="rounded-xl overflow-hidden border border-gray-100">
                        <CompanyProfile symbol={activeSymbol} height={425} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-text-main mb-3">Données fondamentales</h3>
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      <FundamentalData symbol={activeSymbol} height={830} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'screener' && (
                <div>
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <StockScreener height={650} market="canada" />
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div>
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <EconomicCalendar height={550} />
                  </div>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
