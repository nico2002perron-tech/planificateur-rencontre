'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface EconomicCalendarProps {
  height?: number;
  className?: string;
}

export function EconomicCalendar({
  height = 500,
  className,
}: EconomicCalendarProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
      config={{
        width: '100%',
        height,
        colorTheme: 'light',
        isTransparent: true,
        locale: 'fr',
        importanceFilter: '-1,0,1',
        countryFilter: 'ca,us',
      }}
    />
  );
}
