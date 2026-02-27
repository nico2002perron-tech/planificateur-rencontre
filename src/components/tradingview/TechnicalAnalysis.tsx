'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface TechnicalAnalysisProps {
  symbol?: string;
  height?: number;
  className?: string;
}

export function TechnicalAnalysis({
  symbol = 'TSX:RY',
  height = 425,
  className,
}: TechnicalAnalysisProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
      config={{
        interval: '1D',
        width: '100%',
        isTransparent: true,
        height,
        symbol,
        showIntervalTabs: true,
        displayMode: 'single',
        locale: 'fr',
        colorTheme: 'light',
      }}
    />
  );
}
