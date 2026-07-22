'use client';

import { useState } from 'react';
import { duoColor } from './constants';

export function StockAvatar({ symbol, size = 44 }: { symbol: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const ticker = symbol.replace('.TO', '').replace('.V', '').replace('.CN', '');
  const color = duoColor(ticker);
  // Proportions selon la taille : sous 36 px, bordure fine et coins serrés
  // (une bordure de 3 px mangerait un avatar de 28 px).
  const small = size < 36;
  const frame = small ? 'rounded-xl border-[2px]' : 'rounded-2xl border-[3px]';

  if (!imgError) {
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`}
          alt={ticker}
          width={size}
          height={size}
          className={`${frame} object-contain bg-white`}
          style={{ borderColor: color + '40' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${frame} flex items-center justify-center flex-shrink-0`}
      style={{
        width: size, height: size,
        backgroundColor: color + '18',
        borderColor: color + '50',
        boxShadow: small ? undefined : `0 3px 0 0 ${color}30`,
      }}
    >
      <span className="font-extrabold" style={{ color, fontSize: size * 0.32 }}>
        {ticker.slice(0, 3)}
      </span>
    </div>
  );
}
