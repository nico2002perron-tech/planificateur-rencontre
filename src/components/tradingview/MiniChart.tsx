'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface MiniChartProps {
  symbol?: string;
  height?: number;
  dateRange?: '1D' | '1M' | '3M' | '12M' | '60M' | 'ALL';
  className?: string;
}

export function MiniChart({
  symbol = 'TSX:RY',
  height = 220,
  dateRange = '12M',
  className,
}: MiniChartProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
      config={{
        symbol,
        width: '100%',
        height,
        locale: 'fr',
        dateRange,
        colorTheme: 'light',
        isTransparent: true,
        autosize: false,
        largeChartUrl: '',
      }}
    />
  );
}
