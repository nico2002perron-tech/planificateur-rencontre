'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface AdvancedChartProps {
  symbol?: string;
  height?: number;
  theme?: 'light' | 'dark';
  interval?: string;
  className?: string;
}

export function AdvancedChart({
  symbol = 'TSX:RY',
  height = 500,
  theme = 'light',
  interval = 'D',
  className,
}: AdvancedChartProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
      config={{
        autosize: true,
        symbol,
        interval,
        timezone: 'America/Toronto',
        theme,
        style: '1',
        locale: 'fr',
        allow_symbol_change: true,
        calendar: false,
        support_host: 'https://www.tradingview.com',
        height,
        width: '100%',
        hide_side_toolbar: false,
        studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
      }}
    />
  );
}
