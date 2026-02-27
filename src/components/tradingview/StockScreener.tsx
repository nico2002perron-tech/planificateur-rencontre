'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface StockScreenerProps {
  height?: number;
  market?: string;
  className?: string;
}

export function StockScreener({
  height = 600,
  market = 'canada',
  className,
}: StockScreenerProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
      config={{
        width: '100%',
        height,
        defaultColumn: 'overview',
        defaultScreen: 'most_capitalized',
        market,
        showToolbar: true,
        colorTheme: 'light',
        locale: 'fr',
        isTransparent: true,
      }}
    />
  );
}
