'use client';

import { cn } from '@/lib/utils/cn';

interface CurrencyToggleProps {
  value: 'CAD' | 'USD';
  onChange: (currency: 'CAD' | 'USD') => void;
}

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5">
      {(['CAD', 'USD'] as const).map((currency) => (
        <button
          key={currency}
          onClick={() => onChange(currency)}
          className={cn(
            'px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200',
            value === currency
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-text-muted hover:text-text-main'
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
