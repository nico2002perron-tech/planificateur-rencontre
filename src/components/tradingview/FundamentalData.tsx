'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface FundamentalDataProps {
  symbol?: string;
  height?: number;
  className?: string;
}

export function FundamentalData({
  symbol = 'TSX:RY',
  height = 830,
  className,
}: FundamentalDataProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-financials.js"
      config={{
        isTransparent: true,
        largeChartUrl: '',
        displayMode: 'regular',
        width: '100%',
        height,
        symbol,
        colorTheme: 'light',
        locale: 'fr',
      }}
    />
  );
}
