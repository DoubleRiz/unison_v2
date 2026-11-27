import React from 'react';
import { SETLIST_ICONS } from '../constants/setlistIcons';

interface SetlistIconPickerProps {
  value: string;
  onChange: (name: string) => void;
  labelledBy?: string;
}

/** Grille d'icônes sélectionnables (radiogroup) pour une setlist. */
export const SetlistIconPicker: React.FC<SetlistIconPickerProps> = ({ value, onChange, labelledBy }) => (
  <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : 'Icône'} className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
    {SETLIST_ICONS.map(({ name, label, Icon }) => {
      const selected = value === name;
      return (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={label}
          title={label}
          onClick={() => onChange(name)}
          className={`h-11 inline-flex items-center justify-center rounded-md border transition-colors ${selected
            ? 'border-cyan-600 bg-cyan-100 text-cyan-600 dark:border-cyan-400 dark:bg-cyan-900 dark:text-cyan-400'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-500'}`}
        >
          <Icon size={20} />
        </button>
      );
    })}
  </div>
);
