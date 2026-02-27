'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface CompanyProfileProps {
  symbol?: string;
  height?: number;
  className?: string;
}

export function CompanyProfile({
  symbol = 'TSX:RY',
  height = 550,
  className,
}: CompanyProfileProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js"
      config={{
        width: '100%',
        height,
        isTransparent: true,
        symbol,
        colorTheme: 'light',
        locale: 'fr',
      }}
    />
  );
}
