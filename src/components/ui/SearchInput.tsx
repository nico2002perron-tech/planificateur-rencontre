'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { Search, X } from 'lucide-react';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          ref={ref}
          value={value}
          className={cn(
            'w-full pl-10 pr-9 py-2.5 rounded-[var(--radius-pill)] border border-gray-200 bg-white',
            'text-sm text-text-main placeholder:text-text-light',
            'transition-all duration-200',
            'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none',
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100"
          >
            <X className="h-3.5 w-3.5 text-text-muted" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
