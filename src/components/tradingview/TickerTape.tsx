'use client';

import { TradingViewWidget } from './TradingViewWidget';

interface TickerTapeProps {
  className?: string;
}

export function TickerTape({ className }: TickerTapeProps) {
  return (
    <TradingViewWidget
      className={className}
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
      config={{
        symbols: [
          { proName: 'TSX:TXCX', title: 'S&P/TSX' },
          { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
          { proName: 'NASDAQ:NDX', title: 'NASDAQ 100' },
          { proName: 'FX_IDC:USDCAD', title: 'USD/CAD' },
          { proName: 'TSX:RY', title: 'Royale' },
          { proName: 'TSX:TD', title: 'TD' },
          { proName: 'TSX:ENB', title: 'Enbridge' },
          { proName: 'TSX:CNR', title: 'CN Rail' },
          { proName: 'TSX:BAM', title: 'Brookfield' },
          { proName: 'TSX:SU', title: 'Suncor' },
          { proName: 'AMEX:GLD', title: 'Or' },
          { proName: 'TVC:USOIL', title: 'Pétrole' },
        ],
        showSymbolLogo: true,
        isTransparent: false,
        displayMode: 'adaptive',
        colorTheme: 'light',
        locale: 'fr',
      }}
    />
  );
}
