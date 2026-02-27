'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface SymbolInfoProps {
  symbol?: string;
  className?: string;
}

export function SymbolInfo({
  symbol = 'TSX:RY',
  className,
}: SymbolInfoProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js"
      config={{
        symbol,
        width: '100%',
        locale: 'fr',
        colorTheme: 'light',
        isTransparent: true,
      }}
    />
  );
}
