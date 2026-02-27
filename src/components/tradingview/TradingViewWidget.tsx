'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  scriptSrc: string;
  config: Record<string, unknown>;
  className?: string;
}

function TradingViewWidgetBase({ scriptSrc, config, className }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [scriptSrc, JSON.stringify(config)]);

  return (
    <div className={`tradingview-widget-container ${className || ''}`} ref={containerRef} />
  );
}

export const TradingViewWidget = memo(TradingViewWidgetBase);
