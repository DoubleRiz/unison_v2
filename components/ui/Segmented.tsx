import React from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<NoInfer<T>>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Segmented control from the mockups: outlined group, active item tinted with an accent underline. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className = '' }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`inline-flex p-0.5 border border-slate-300 dark:border-slate-700 rounded-md ${className}`}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`${size === 'sm' ? 'h-[30px]' : 'h-8'} px-2.5 rounded text-sm font-semibold whitespace-nowrap transition-colors ${
              active
                ? 'bg-cyan-100 text-cyan-700 shadow-[inset_0_-2px_0_#2440D6] dark:bg-cyan-900 dark:text-cyan-300 dark:shadow-[inset_0_-2px_0_#93A5FF]'
                : 'text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
